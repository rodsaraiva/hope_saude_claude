import type { ServerClient } from 'postmark';
import type { MailProvider, MailSendResult, OutgoingEmail } from './mail-provider.interface';

export interface PostmarkMailProviderDeps {
  client: ServerClient;
  from: string;
  messageStream: string;
}

export class PostmarkMailProvider implements MailProvider {
  constructor(private readonly deps: PostmarkMailProviderDeps) {}

  async send(message: OutgoingEmail): Promise<MailSendResult> {
    const response = await this.deps.client.sendEmail({
      From: this.deps.from,
      To: message.to,
      Subject: message.subject,
      HtmlBody: message.htmlBody,
      TextBody: message.textBody,
      Tag: message.tag,
      MessageStream: message.messageStream ?? this.deps.messageStream,
    });
    return { providerMessageId: response.MessageID };
  }
}
