export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface OutgoingEmail {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  tag: string;
  messageStream?: string;
}

export interface MailSendResult {
  providerMessageId: string;
}

export interface MailProvider {
  send(message: OutgoingEmail): Promise<MailSendResult>;
}
