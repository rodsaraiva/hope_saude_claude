import { renderTemplate } from './renderer';
import { PasswordResetEmail } from './password-reset';

describe('PasswordResetEmail', () => {
  it('renderiza html com nome, link e CTA', async () => {
    const out = await renderTemplate(
      PasswordResetEmail({
        userName: 'Maria',
        resetUrl: 'https://hope.test/reset?token=abc',
      }),
    );
    expect(out.html).toContain('Maria');
    expect(out.html).toContain('https://hope.test/reset?token=abc');
    expect(out.html).toContain('redefinir sua senha');
    expect(out.html).toMatchSnapshot();
  });
});
