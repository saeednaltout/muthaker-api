import { mock } from 'jest-mock-extended';

import { testConfig } from '../../test/unit/config';
import type { OutboxService } from '../outbox/outbox.service';
import { MailRenderer } from './mail.renderer';
import { MailService } from './mail.service';
import { MAIL_OUTBOX_TYPE, type MailMessage } from './mail.types';

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail })) }));

const message: MailMessage<'verify-email'> = {
  to: 'student@example.test',
  template: 'verify-email',
  locale: 'ar',
  data: { name: 'سارة', url: 'https://app.test/verify?t=abc&x=1' },
};

describe('MailRenderer', () => {
  const renderer = new MailRenderer();

  it('renders Arabic templates RTL with the Arabic subject', () => {
    const out = renderer.render('verify-email', 'ar', message.data);
    expect(out.subject).toContain('مُذاكِر');
    expect(out.html).toContain('dir="rtl"');
    expect(out.html).toContain('lang="ar"');
    expect(out.html).toContain('سارة');
    expect(out.text).toContain('https://app.test/verify?t=abc&x=1');
  });

  it('renders English templates LTR', () => {
    const out = renderer.render('reset-password', 'en', { name: 'Sam', url: 'https://x.test' });
    expect(out.subject).toBe('Reset your Muthaker password');
    expect(out.html).toContain('dir="ltr"');
    expect(out.html).toContain('Hi Sam');
  });

  it('escapes user-provided values', () => {
    const out = renderer.render('verify-email', 'en', { name: '<script>x</script>', url: 'u' });
    expect(out.html).not.toContain('<script>x</script>');
    expect(out.html).toContain('&lt;script&gt;');
  });

  it('fails on missing variables (strict mode)', () => {
    expect(() => renderer.render('verify-email', 'en', { name: 'x' })).toThrow();
  });
});

describe('MailService', () => {
  const outbox = mock<OutboxService>();
  let service: MailService;

  beforeEach(() => {
    sendMail.mockReset();
    service = new MailService(testConfig(), outbox, new MailRenderer());
  });

  it('sends a rendered mail from MAIL_FROM', async () => {
    sendMail.mockResolvedValue({});
    await service.send(message);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Muthaker Test <test@muthaker.local>',
        to: message.to,
        subject: expect.stringContaining('مُذاكِر'),
        html: expect.stringContaining('dir="rtl"'),
      }),
    );
  });

  it('registers an outbox handler for retries', async () => {
    service.onModuleInit();
    expect(outbox.registerHandler).toHaveBeenCalledWith(MAIL_OUTBOX_TYPE, expect.any(Function));
    const handler = outbox.registerHandler.mock.calls[0]?.[1];
    sendMail.mockResolvedValue({});
    await handler?.(message as never);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('sendInBackground: does not throw and queues failures in the outbox', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));
    await expect(service.sendInBackground(message)).resolves.toBeUndefined();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      MAIL_OUTBOX_TYPE,
      message,
      expect.objectContaining({ lastError: 'SMTP down', attempts: 1 }),
    );
  });

  it('sendInBackground: swallows outbox failures too', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));
    outbox.enqueue.mockRejectedValueOnce(new Error('DB down'));
    await expect(service.sendInBackground(message)).resolves.toBeUndefined();
  });

  it('sendInBackground: no outbox entry on success', async () => {
    outbox.enqueue.mockClear();
    sendMail.mockResolvedValue({});
    await service.sendInBackground(message);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
