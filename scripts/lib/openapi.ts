import './placeholder-env';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OpenAPIObject } from '@nestjs/swagger';

import { AppModule } from '../../src/app.module';
import { buildOpenApiDocument, configureApp } from '../../src/app.setup';

/** Builds the OpenAPI document WITHOUT listening and WITHOUT a DB connection (Prisma is lazy). */
export async function createOpenApiDocument(): Promise<OpenAPIObject> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureApp(app, { logger: false });
  await app.init();
  const document = buildOpenApiDocument(app);
  await app.close();
  return document;
}
