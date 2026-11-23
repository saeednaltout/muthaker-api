import { Injectable } from '@nestjs/common';

import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CleanupRunDto, OutboxRunDto } from './cron.dto';

/** Keep revoked/expired refresh tokens this long for reuse detection and audits. */
const TOKEN_RETENTION_MS = 7 * 86_400_000;

@Injectable()
export class CronService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /** Drains due outbox jobs. Also keeps the free Supabase project from pausing (DB activity). */
  async runOutbox(now = new Date()): Promise<OutboxRunDto> {
    const result = await this.outbox.processDue(now);
    const purged = await this.outbox.purgeDone(14, now);
    return { ...result, purged };
  }

  /** Deletes expired auth tokens. */
  async runCleanup(now = new Date()): Promise<CleanupRunDto> {
    const cutoff = new Date(now.getTime() - TOKEN_RETENTION_MS);
    const [refresh, verification] = await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    ]);
    return { refreshTokens: refresh.count, verificationTokens: verification.count };
  }
}
