import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { APP_VERSION } from '../version';
import type { HealthDto } from './health.dto';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthDto> {
    const dbUp = await this.prisma.ping();
    return { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down', version: APP_VERSION };
  }
}
