import { Inject, Injectable } from '@nestjs/common';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import { MAIL_PROVIDER, MailProvider } from './providers/mail-provider.interface';

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
  constructor(
    private readonly outbox: EmailOutboxRepository,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
  ) {}

  async sendPasswordReset(params: SendPasswordResetParams): Promise<void> {
    await this.enqueue({
      to: params.to,
      subject: 'Redefinição de senha — Hope Saúde',
      tag: 'password-reset',
      userName: params.userName,
      url: params.resetUrl,
    });
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    await this.enqueue({
      to: params.to,
      subject: 'Confirme seu email — Hope Saúde',
      tag: 'email-verification',
      userName: params.userName,
      url: params.verifyUrl,
    });
  }

  private async enqueue(input: {
    to: string;
    subject: string;
    tag: string;
    userName: string;
    url: string;
  }): Promise<void> {
    await this.outbox.createPending({
      to: input.to,
      subject: input.subject,
      tag: input.tag,
      payload: JSON.stringify({ userName: input.userName, url: input.url }),
    });
  }
}
