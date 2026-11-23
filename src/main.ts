import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import type { Env } from './config/env.schema';

/**
 * Entry point for both environments:
 * - locally: a long-running server on PORT (default 4000);
 * - on Vercel: zero-config NestJS detection uses `src/main.ts`; `listen()` is handled by
 *   the platform (Fluid compute).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);
  setupSwagger(app);
  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  await app.listen(process.env.PORT ?? port);
}

void bootstrap();
