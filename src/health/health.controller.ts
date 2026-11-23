import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodResponse } from 'nestjs-zod';

import { Public } from '../common/decorators';
import { HealthDto } from './health.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness and database check', operationId: 'getHealth' })
  @ZodResponse({ status: 200, type: HealthDto })
  check() {
    return this.health.check();
  }
}
