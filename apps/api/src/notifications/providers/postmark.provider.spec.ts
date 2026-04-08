import { PostmarkMailProvider } from './postmark.provider';

describe('PostmarkMailProvider', () => {
  const makeClient = (sendEmailImpl: jest.Mock) =>
    ({ sendEmail: sendEmailImpl }) as unknown as import('postmark').ServerClient;

  it('envia via SDK do Postmark e retorna providerMessageId', async () => {
    const sendEmail = jest.fn().mockResolvedValue({ MessageID: 'pm-999' });
    const provider = new PostmarkMailProvider({
      client: makeClient(sendEmail),
      from: 'Hope <no-reply@hope.test>',
      messageStream: 'outbound',
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Olá',
      htmlBody: '<p>oi</p>',
      textBody: 'oi',
      tag: 'password-reset',
    });

    expect(sendEmail).toHaveBeenCalledWith({
      From: 'Hope <no-reply@hope.test>',
      To: 'user@test.com',
      Subject: 'Olá',
      HtmlBody: '<p>oi</p>',
      TextBody: 'oi',
      Tag: 'password-reset',
      MessageStream: 'outbound',
    });
    expect(result).toEqual({ providerMessageId: 'pm-999' });
  });

  it('propaga erro da API', async () => {
    const sendEmail = jest.fn().mockRejectedValue(new Error('rate limited'));
    const provider = new PostmarkMailProvider({
      client: makeClient(sendEmail),
      from: 'f@f.com',
      messageStream: 'outbound',
    });
    await expect(
      provider.send({ to: 'a@b.com', subject: 's', htmlBody: 'h', tag: 't' }),
    ).rejects.toThrow('rate limited');
  });
});
