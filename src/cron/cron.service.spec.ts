import { mock, mockDeep } from 'jest-mock-extended';

import type { OutboxService } from '../outbox/outbox.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CronService } from './cron.service';

describe('CronService', () => {
  const prisma = mockDeep<PrismaService>();
  const outbox = mock<OutboxService>();
  const service = new CronService(prisma, outbox);
  const now = new Date('2026-03-01T00:00:00Z');

  it('runOutbox processes due jobs and purges old ones', async () => {
    outbox.processDue.mockResolvedValue({ processed: 2, succeeded: 1, failed: 1 });
    outbox.purgeDone.mockResolvedValue(5);
    await expect(service.runOutbox(now)).resolves.toEqual({
      processed: 2,
      succeeded: 1,
      failed: 1,
      purged: 5,
    });
    expect(outbox.processDue).toHaveBeenCalledWith(now);
  });

  it('runCleanup deletes tokens expired more than 7 days ago', async () => {
    prisma.$transaction.mockResolvedValue([{ count: 4 }, { count: 2 }] as never);
    await expect(service.runCleanup(now)).resolves.toEqual({
      refreshTokens: 4,
      verificationTokens: 2,
    });
    const cutoff = new Date(now.getTime() - 7 * 86_400_000);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: cutoff } },
    });
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: cutoff } },
    });
  });
});
