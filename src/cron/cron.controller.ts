import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';

import { Public } from '../common/decorators';
import { ErrorResponseDto } from '../common/errors/error-response.schema';
import { CronSecretGuard } from '../common/guards/cron-secret.guard';
import { CleanupRunDto, OutboxRunDto } from './cron.dto';
import { CronService } from './cron.service';

/**
 * Scheduled jobs exposed as HTTP endpoints (Vercel Hobby cron runs only once a day).
 * Called every 5 minutes by cron-job.org with `Authorization: Bearer <CRON_SECRET>`.
 */
@ApiTags('internal')
@ApiBearerAuth('cron')
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@Controller('internal/cron')
@Public()
@SkipThrottle()
@UseGuards(CronSecretGuard)
export class CronController {
  constructor(private readonly cron: CronService) {}

  @Post('outbox')
  @ApiOperation({ summary: 'Process due outbox jobs (emails, ...)', operationId: 'runOutboxCron' })
  @ZodResponse({ status: 200, type: OutboxRunDto })
  runOutbox() {
    return this.cron.runOutbox();
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Delete expired auth tokens', operationId: 'runCleanupCron' })
  @ZodResponse({ status: 200, type: CleanupRunDto })
  runCleanup() {
    return this.cron.runCleanup();
  }
}
