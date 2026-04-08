import { SmtpMailProvider } from './smtp.provider';
import type { Transporter } from 'nodemailer';

describe('SmtpMailProvider', () => {
  const makeTransporter = (sendMailImpl: jest.Mock) =>
    ({ sendMail: sendMailImpl }) as unknown as Transporter;

  it('envia email e retorna providerMessageId', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc-123' });
    const provider = new SmtpMailProvider({
      transporter: makeTransporter(sendMail),
      from: 'Hope <no-reply@hope.test>',
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Olá',
      htmlBody: '<p>oi</p>',
      textBody: 'oi',
      tag: 'password-reset',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Hope <no-reply@hope.test>',
      to: 'user@test.com',
      subject: 'Olá',
      html: '<p>oi</p>',
      text: 'oi',
      headers: { 'X-Tag': 'password-reset' },
    });
    expect(result).toEqual({ providerMessageId: 'abc-123' });
  });

  it('propaga erro do transporter', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('smtp down'));
    const provider = new SmtpMailProvider({
      transporter: makeTransporter(sendMail),
      from: 'Hope <no-reply@hope.test>',
    });

    await expect(
      provider.send({
        to: 'a@b.com',
        subject: 's',
        htmlBody: 'h',
        tag: 't',
      }),
    ).rejects.toThrow('smtp down');
  });
});
