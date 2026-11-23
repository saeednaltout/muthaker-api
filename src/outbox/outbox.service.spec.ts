import { mockDeep } from 'jest-mock-extended';

import type { Outbox } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { MAX_ATTEMPTS, OutboxService } from './outbox.service';

const NOW = new Date('2026-01-01T00:00:00Z');

function job(partial: Partial<Outbox> = {}): Outbox {
  return {
    id: 'j1',
    type: 'mail.send',
    payload: { a: 1 },
    status: 'PROCESSING',
    attempts: 0,
    runAt: NOW,
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe('OutboxService', () => {
  const prisma = mockDeep<PrismaService>();
  let service: OutboxService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OutboxService(prisma);
  });

  it('enqueues a job', async () => {
    await service.enqueue('mail.send', { a: 1 });
    expect(prisma.outbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'mail.send', payload: { a: 1 }, attempts: 0 }),
    });
  });

  it('returns early when nothing is due', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(service.processDue(NOW)).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
    expect(prisma.outbox.findMany).not.toHaveBeenCalled();
  });

  it('runs the handler and marks the job DONE', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    service.registerHandler('mail.send', handler);
    prisma.$queryRaw.mockResolvedValue([{ id: 'j1' }]);
    prisma.outbox.findMany.mockResolvedValue([job()]);

    const result = await service.processDue(NOW);

    expect(handler).toHaveBeenCalledWith({ a: 1 });
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(prisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { status: 'DONE', attempts: 1, lastError: null },
    });
  });

  it('reschedules failures with backoff', async () => {
    service.registerHandler('mail.send', jest.fn().mockRejectedValue(new Error('smtp')));
    prisma.$queryRaw.mockResolvedValue([{ id: 'j1' }]);
    prisma.outbox.findMany.mockResolvedValue([job({ attempts: 0 })]);

    const result = await service.processDue(NOW);

    expect(result.failed).toBe(1);
    expect(prisma.outbox.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: {
        status: 'PENDING',
        attempts: 1,
        lastError: 'smtp',
        runAt: new Date(NOW.getTime() + 60_000),
      },
    });
  });

  it('marks the job FAILED after the last attempt', async () => {
    service.registerHandler('mail.send', jest.fn().mockRejectedValue('boom'));
    prisma.$queryRaw.mockResolvedValue([{ id: 'j1' }]);
    prisma.outbox.findMany.mockResolvedValue([job({ attempts: MAX_ATTEMPTS - 1 })]);

    await service.processDue(NOW);

    expect(prisma.outbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', attempts: MAX_ATTEMPTS }),
      }),
    );
  });

  it('fails jobs without a registered handler', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'j1' }]);
    prisma.outbox.findMany.mockResolvedValue([job({ type: 'nope' })]);
    const result = await service.processDue(NOW);
    expect(result.failed).toBe(1);
    expect(prisma.outbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastError: 'No outbox handler for type "nope"' }),
      }),
    );
  });

  it('purges DONE jobs older than N days', async () => {
    prisma.outbox.deleteMany.mockResolvedValue({ count: 3 });
    await expect(service.purgeDone(14, NOW)).resolves.toBe(3);
    expect(prisma.outbox.deleteMany).toHaveBeenCalledWith({
      where: { status: 'DONE', updatedAt: { lt: new Date(NOW.getTime() - 14 * 86_400_000) } },
    });
  });
});
