import request from 'supertest';

import { MAIL_OUTBOX_TYPE } from '../src/mail/mail.types';
import { API, createTestApp, type TestApp } from './helpers/app';
import { resetDatabase } from './helpers/db';
import { createStudent } from './helpers/factories';
import { clearMailpit, getMailHtml, waitForMail } from './helpers/mailpit';
import { TEST_ENV } from './test-env';

const AUTH = `Bearer ${process.env.CRON_SECRET ?? TEST_ENV.CRON_SECRET}`;

describe('Internal cron (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetDatabase(t.prisma));
  afterAll(() => t.close());

  describe.each(['outbox', 'cleanup'])('POST /internal/cron/%s', (job) => {
    const url = `${API}/internal/cron/${job}`;

    it('401 without Authorization', async () => {
      const res = await request(t.server).post(url).expect(401);
      expect(res.body.code).toBe('CRON_UNAUTHORIZED');
    });

    it('401 with a wrong secret', async () => {
      await request(t.server).post(url).set('Authorization', 'Bearer wrong').expect(401);
    });

    it('404 for GET (method not routed)', async () => {
      await request(t.server).get(url).set('Authorization', AUTH).expect(404);
    });

    it('200 with the right secret', async () => {
      await request(t.server).post(url).set('Authorization', AUTH).expect(200);
    });
  });

  it('outbox: delivers a queued mail through SMTP (Mailpit) and marks it DONE', async () => {
    await clearMailpit();
    const to = 'outbox-e2e@example.test';
    await t.prisma.outbox.create({
      data: {
        type: MAIL_OUTBOX_TYPE,
        payload: {
          to,
          template: 'verify-email',
          locale: 'ar',
          data: { name: 'طالب', url: 'http://localhost:3000/verify?t=x' },
        },
      },
    });

    const res = await request(t.server)
      .post(`${API}/internal/cron/outbox`)
      .set('Authorization', AUTH)
      .expect(200);
    expect(res.body).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });

    const mail = await waitForMail(to);
    expect(mail.Subject).toContain('مُذاكِر');
    expect(await getMailHtml(mail.ID)).toContain('dir="rtl"');
    expect(await t.prisma.outbox.findFirstOrThrow()).toMatchObject({ status: 'DONE', attempts: 1 });
  });

  it('outbox: unknown job types are retried later, not lost', async () => {
    await t.prisma.outbox.create({ data: { type: 'unknown.job', payload: {} } });
    const res = await request(t.server)
      .post(`${API}/internal/cron/outbox`)
      .set('Authorization', AUTH)
      .expect(200);
    expect(res.body).toMatchObject({ processed: 1, failed: 1 });
    const job = await t.prisma.outbox.findFirstOrThrow();
    expect(job.status).toBe('PENDING');
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('cleanup: deletes tokens expired for more than 7 days, keeps recent ones', async () => {
    const user = await createStudent(t.prisma);
    const old = new Date(Date.now() - 8 * 86_400_000);
    const recent = new Date(Date.now() - 86_400_000);
    await t.prisma.refreshToken.createMany({
      data: [
        { userId: user.id, tokenHash: 'old', familyId: crypto.randomUUID(), expiresAt: old },
        { userId: user.id, tokenHash: 'recent', familyId: crypto.randomUUID(), expiresAt: recent },
      ],
    });
    const res = await request(t.server)
      .post(`${API}/internal/cron/cleanup`)
      .set('Authorization', AUTH)
      .expect(200);
    expect(res.body).toEqual({ refreshTokens: 1, verificationTokens: 0 });
    expect(await t.prisma.refreshToken.count()).toBe(1);
  });
});
