import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  /** Pass to supertest: `request(t.server)`. */
  server: ReturnType<NestExpressApplication['getHttpServer']>;
  close: () => Promise<void>;
}

/** Boots the full app exactly like main.ts (same configureApp), without listening on a port. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, { logger: false });
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    server: app.getHttpServer(),
    close: () => app.close(),
  };
}

export const API = '/api/v1';
