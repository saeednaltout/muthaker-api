import { randomUUID } from 'node:crypto';

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { type Env, validateEnv } from './config/env.schema';
import { CronModule } from './cron/cron.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { OutboxModule } from './outbox/outbox.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        return {
          pinoHttp: {
            level:
              config.get('LOG_LEVEL', { infer: true }) ??
              (nodeEnv === 'production' ? 'info' : nodeEnv === 'test' ? 'silent' : 'debug'),
            // Reuse a sane incoming x-request-id, otherwise generate one; echo it back.
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const incoming = req.headers['x-request-id'];
              const id =
                typeof incoming === 'string' && REQUEST_ID_RE.test(incoming)
                  ? incoming
                  : randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            customProps: (req: IncomingMessage) => ({ requestId: (req as { id?: unknown }).id }),
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                '*.password',
                '*.token',
              ],
              censor: '[redacted]',
            },
            autoLogging: {
              ignore: (req: IncomingMessage) => req.url?.endsWith('/health') ?? false,
            },
            transport:
              nodeEnv === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
                : undefined,
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const redisUrl = config.get('REDIS_URL', { infer: true });
        return {
          throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
          // Redis (local container / Upstash) when configured; in-memory fallback otherwise.
          storage: redisUrl
            ? new ThrottlerStorageRedisService(redisUrl, { maxRetriesPerRequest: 2 })
            : undefined,
          skipIf: () => config.get('NODE_ENV', { infer: true }) === 'test',
        };
      },
    }),

    PrismaModule,
    OutboxModule,
    StorageModule,
    MailModule,
    HealthModule,
    CronModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
