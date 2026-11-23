import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import type { Env } from './config/env.schema';
import { APP_VERSION } from './version';

export const API_PREFIX = 'api';

/**
 * Everything that must be identical for the real server, Vercel, e2e tests and the
 * OpenAPI generator. Do not configure the app anywhere else.
 */
export function configureApp(app: NestExpressApplication, opts: { logger?: boolean } = {}): void {
  const config = app.get(ConfigService<Env, true>);

  if (opts.logger !== false) app.useLogger(app.get(Logger));

  // Vercel / proxies set X-Forwarded-For; needed for correct req.ip (rate limiting).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.enableShutdownHooks();
}

export function buildOpenApiDocument(app: NestExpressApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Muthaker API')
    .setDescription(
      'REST API of Muthaker («مُذاكِر»). Errors always use ' +
        '`{ statusCode, code, message, details?, requestId }`.',
    )
    .setVersion(APP_VERSION)
    .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie', name: 'access_token' }, 'cookie')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'CRON_SECRET' }, 'cron')
    .addServer('http://localhost:4000', 'Local');

  const document = SwaggerModule.createDocument(app, builder.build(), {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });
  return cleanupOpenApiDoc(document);
}

/** Swagger UI at /api/docs, JSON at /api/docs-json. Disabled in production. */
export function setupSwagger(app: NestExpressApplication): void {
  const config = app.get(ConfigService<Env, true>);
  if (config.get('NODE_ENV', { infer: true }) === 'production') return;
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: `${API_PREFIX}/docs-json`,
  });
}
