import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailOutboxRepository, OutboxRow } from './email-outbox.repository';
import { MAIL_PROVIDER, MailProvider } from '../providers/mail-provider.interface';
import { renderTemplate } from '../templates/renderer';
import { PasswordResetEmail } from '../templates/password-reset';
import { EmailVerificationEmail } from '../templates/email-verification';

const MAX_ATTEMPTS = 5;

interface OutboxPayload {
  userName: string;
  url: string;
}

@Injectable()
export class EmailOutboxWorker {
  private readonly logger = new Logger(EmailOutboxWorker.name);

  constructor(
    private readonly outbox: EmailOutboxRepository,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
  ) {}

  @Cron('* * * * *')
  async processOnce(): Promise<void> {
    const rows = await this.outbox.findRetryable({ maxAttempts: MAX_ATTEMPTS, now: new Date() });
    for (const row of rows) {
      await this.deliverRow(row);
    }
  }

  private async deliverRow(row: OutboxRow): Promise<void> {
    let rendered: { html: string; text: string };
    try {
      rendered = await this.render(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.outbox.markFailed(row.id, message);
      return;
    }

    try {
      const result = await this.provider.send({
        to: row.to,
        subject: row.subject,
        htmlBody: rendered.html,
        textBody: rendered.text,
        tag: row.tag,
      });
      await this.outbox.markSent(row.id, result.providerMessageId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({
        msg: 'outbox send failed',
        outboxId: row.id,
        tag: row.tag,
        error: message,
      });
      await this.outbox.markFailed(row.id, message);
    }
  }

  private async render(row: OutboxRow): Promise<{ html: string; text: string }> {
    const payload = JSON.parse(row.payload ?? '{}') as OutboxPayload;
    if (row.tag === 'password-reset') {
      return renderTemplate(
        PasswordResetEmail({ userName: payload.userName, resetUrl: payload.url }),
      );
    }
    if (row.tag === 'email-verification') {
      return renderTemplate(
        EmailVerificationEmail({ userName: payload.userName, verifyUrl: payload.url }),
      );
    }
    throw new Error(`tag de e-mail desconhecida: ${row.tag}`);
  }
}
