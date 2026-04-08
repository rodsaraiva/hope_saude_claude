import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import { MAIL_PROVIDER, MailProvider } from './providers/mail-provider.interface';
import { renderTemplate } from './templates/renderer';
import { PasswordResetEmail } from './templates/password-reset';
import { EmailVerificationEmail } from './templates/email-verification';

export interface SendPasswordResetParams {
  to: string;
  userName: string;
  resetUrl: string;
}

export interface SendEmailVerificationParams {
  to: string;
  userName: string;
  verifyUrl: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly outbox: EmailOutboxRepository,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
  ) {}

  async sendPasswordReset(params: SendPasswordResetParams): Promise<void> {
    const subject = 'Redefinição de senha — Hope Saúde';
    const rendered = await renderTemplate(
      PasswordResetEmail({ userName: params.userName, resetUrl: params.resetUrl }),
    );
    await this.deliver({
      to: params.to,
      subject,
      tag: 'password-reset',
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    const subject = 'Confirme seu email — Hope Saúde';
    const rendered = await renderTemplate(
      EmailVerificationEmail({ userName: params.userName, verifyUrl: params.verifyUrl }),
    );
    await this.deliver({
      to: params.to,
      subject,
      tag: 'email-verification',
      html: rendered.html,
      text: rendered.text,
    });
  }

  private async deliver(input: {
    to: string;
    subject: string;
    tag: string;
    html: string;
    text: string;
  }): Promise<void> {
    const outboxId = await this.outbox.createPending({
      to: input.to,
      subject: input.subject,
      tag: input.tag,
    });

    try {
      const result = await this.provider.send({
        to: input.to,
        subject: input.subject,
        htmlBody: input.html,
        textBody: input.text,
        tag: input.tag,
      });
      await this.outbox.markSent(outboxId, result.providerMessageId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({
        msg: 'email send failed',
        outboxId,
        tag: input.tag,
        error: message,
      });
      await this.outbox.markFailed(outboxId, message);
    }
  }
}
