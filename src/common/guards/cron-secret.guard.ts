import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { Env } from '../../config/env.schema';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import { safeEqual } from '../utils/safe-equal';

/** Protects /internal/cron/* with `Authorization: Bearer <CRON_SECRET>` (constant-time). */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<Request>().headers.authorization ?? '';
    const expected = `Bearer ${this.config.get('CRON_SECRET', { infer: true })}`;
    if (!safeEqual(header, expected)) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.CRON_UNAUTHORIZED,
        'Invalid cron secret',
      );
    }
    return true;
  }
}
