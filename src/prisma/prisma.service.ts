import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { Env } from '../config/env.schema';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 client over node-postgres (`@prisma/adapter-pg`).
 *
 * Serverless-friendly: NO eager `$connect()` in onModuleInit. The pool connects lazily on the
 * first query, so cold starts (and OpenAPI generation) never touch the database.
 * In production DATABASE_URL points to the Supabase transaction pooler (port 6543).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      // Small pool: Vercel runs many short-lived instances; the pooler does the real pooling.
      max: config.get('NODE_ENV', { infer: true }) === 'production' ? 3 : 10,
    });
    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Cheap liveness probe used by /health. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
