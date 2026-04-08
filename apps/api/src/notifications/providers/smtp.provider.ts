import type { Transporter } from 'nodemailer';
import type { MailProvider, MailSendResult, OutgoingEmail } from './mail-provider.interface';

export interface SmtpMailProviderDeps {
  transporter: Transporter;
  from: string;
}

export class SmtpMailProvider implements MailProvider {
  constructor(private readonly deps: SmtpMailProviderDeps) {}

  async send(message: OutgoingEmail): Promise<MailSendResult> {
    const info = await this.deps.transporter.sendMail({
      from: this.deps.from,
      to: message.to,
      subject: message.subject,
      html: message.htmlBody,
      text: message.textBody,
      headers: { 'X-Tag': message.tag },
    });
    return { providerMessageId: info.messageId };
  }
}
