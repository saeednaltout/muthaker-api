import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { waitUntil } from '@vercel/functions';
import { createTransport, type Transporter } from 'nodemailer';

import type { Env } from '../config/env.schema';
import { Prisma } from '../generated/prisma/client';
import { OutboxService } from '../outbox/outbox.service';
import { MailRenderer } from './mail.renderer';
import { MAIL_OUTBOX_TYPE, type MailMessage, type MailTemplateName } from './mail.types';

/**
 * Nodemailer over plain SMTP. The provider is chosen ONLY by SMTP_* env vars
 * (Mailpit locally, Gmail SMTP + App Password in prod, any relay later — no code change).
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly outbox: OutboxService,
    private readonly renderer: MailRenderer = new MailRenderer(),
  ) {
    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASS', { infer: true });
    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  onModuleInit(): void {
    // Retries of failed sends come back through the outbox cron.
    this.outbox.registerHandler(MAIL_OUTBOX_TYPE, (payload) =>
      this.send(payload as unknown as MailMessage),
    );
  }

  /** Sends now and throws on failure. */
  async send<T extends MailTemplateName>(message: MailMessage<T>): Promise<void> {
    const { subject, html, text } = this.renderer.render(
      message.template,
      message.locale,
      message.data,
    );
    await this.transporter.sendMail({ from: this.from, to: message.to, subject, html, text });
  }

  /**
   * Fire-and-forget: the HTTP response is not delayed. On Vercel, `waitUntil` keeps the
   * function alive until the send finishes. Failures are stored in the outbox for retry.
   */
  sendInBackground<T extends MailTemplateName>(message: MailMessage<T>): Promise<void> {
    const task = this.send(message).catch(async (err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn({ template: message.template }, `Mail failed, queued for retry: ${reason}`);
      try {
        await this.outbox.enqueue(MAIL_OUTBOX_TYPE, message as unknown as Prisma.InputJsonValue, {
          lastError: reason,
          attempts: 1,
          runAt: new Date(Date.now() + 60_000),
        });
      } catch (queueErr) {
        this.logger.error({ err: queueErr }, 'Could not enqueue failed mail');
      }
    });
    waitUntil(task);
    return task;
  }
}
