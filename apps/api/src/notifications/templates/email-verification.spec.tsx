import { renderTemplate } from './renderer';
import { EmailVerificationEmail } from './email-verification';

describe('EmailVerificationEmail', () => {
  it('renderiza html com nome e link de verificação', async () => {
    const out = await renderTemplate(
      EmailVerificationEmail({
        userName: 'João',
        verifyUrl: 'https://hope.test/verify?token=xyz',
      }),
    );
    expect(out.html).toContain('João');
    expect(out.html).toContain('https://hope.test/verify?token=xyz');
    expect(out.html).toContain('confirmar seu email');
    expect(out.html).toMatchSnapshot();
  });
});
