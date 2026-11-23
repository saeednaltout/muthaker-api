import { mockDeep } from 'jest-mock-extended';

import type { PrismaService } from '../prisma/prisma.service';
import { APP_VERSION } from '../version';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new HealthService(prisma);

  it('reports ok when the DB answers', async () => {
    prisma.ping.mockResolvedValue(true);
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      version: APP_VERSION,
    });
  });

  it('reports degraded when the DB is down', async () => {
    prisma.ping.mockResolvedValue(false);
    await expect(service.check()).resolves.toMatchObject({ status: 'degraded', db: 'down' });
  });
});
