import { Injectable, Logger } from '@nestjs/common';

import { OutboxStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type OutboxHandler = (payload: Prisma.JsonValue) => Promise<void>;

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/** Retry delays (ms) after attempt 1, 2, 3, ... The job is FAILED after MAX_ATTEMPTS. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const BATCH_SIZE = 20;
/** A PROCESSING job older than this is considered crashed and is picked up again. */
const STALE_LOCK_MS = 10 * 60_000;

/**
 * Durable job queue in Postgres. There are no long-running workers on Vercel, so jobs are
 * drained by /internal/cron/outbox (called every 5 minutes by cron-job.org).
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly handlers = new Map<string, OutboxHandler>();

  constructor(private readonly prisma: PrismaService) {}

  registerHandler(type: string, handler: OutboxHandler): void {
    this.handlers.set(type, handler);
  }

  async enqueue(
    type: string,
    payload: Prisma.InputJsonValue,
    opts: { runAt?: Date; lastError?: string; attempts?: number } = {},
  ): Promise<void> {
    await this.prisma.outbox.create({
      data: {
        type,
        payload,
        runAt: opts.runAt ?? new Date(),
        lastError: opts.lastError,
        attempts: opts.attempts ?? 0,
      },
    });
  }

  /** Claims due jobs atomically (FOR UPDATE SKIP LOCKED) and runs them. */
  async processDue(now = new Date()): Promise<ProcessResult> {
    const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "outbox" SET "status" = 'PROCESSING', "updated_at" = ${now}
      WHERE "id" IN (
        SELECT "id" FROM "outbox"
        WHERE ("status" = 'PENDING' AND "run_at" <= ${now})
           OR ("status" = 'PROCESSING' AND "updated_at" < ${staleBefore})
        ORDER BY "run_at"
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"`;

    const result: ProcessResult = { processed: claimed.length, succeeded: 0, failed: 0 };
    if (claimed.length === 0) return result;

    const jobs = await this.prisma.outbox.findMany({
      where: { id: { in: claimed.map((c) => c.id) } },
    });

    for (const job of jobs) {
      const attempts = job.attempts + 1;
      try {
        const handler = this.handlers.get(job.type);
        if (!handler) throw new Error(`No outbox handler for type "${job.type}"`);
        await handler(job.payload);
        await this.prisma.outbox.update({
          where: { id: job.id },
          data: { status: OutboxStatus.DONE, attempts, lastError: null },
        });
        result.succeeded++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const giveUp = attempts >= MAX_ATTEMPTS;
        const delay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] ?? 0;
        await this.prisma.outbox.update({
          where: { id: job.id },
          data: {
            status: giveUp ? OutboxStatus.FAILED : OutboxStatus.PENDING,
            attempts,
            lastError: message.slice(0, 1000),
            runAt: new Date(now.getTime() + delay),
          },
        });
        result.failed++;
        this.logger.warn({ jobId: job.id, type: job.type, attempts, giveUp }, message);
      }
    }
    return result;
  }

  /** Deletes finished jobs older than `days`. */
  async purgeDone(days = 14, now = new Date()): Promise<number> {
    const { count } = await this.prisma.outbox.deleteMany({
      where: {
        status: OutboxStatus.DONE,
        updatedAt: { lt: new Date(now.getTime() - days * 86_400_000) },
      },
    });
    return count;
  }
}
