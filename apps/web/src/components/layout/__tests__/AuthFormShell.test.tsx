import { render, screen } from '@testing-library/react';
import { AuthFormShell } from '../AuthFormShell';

describe('AuthFormShell', () => {
  it('renderiza título, destaque e subtítulo', () => {
    render(
      <AuthFormShell title="Configurar" titleHighlight="perfil" subtitle="Complete seus dados">
        <p>conteúdo</p>
      </AuthFormShell>,
    );
    expect(screen.getByRole('heading', { name: /Configurar perfil/i })).toBeTruthy();
    expect(screen.getByText('Complete seus dados')).toBeTruthy();
    expect(screen.getByText('conteúdo')).toBeTruthy();
  });

  it('renderiza footer quando informado', () => {
    render(
      <AuthFormShell title="T" subtitle="S" footer={<span>Rodapé</span>}>
        <div />
      </AuthFormShell>,
    );
    expect(screen.getByText('Rodapé')).toBeTruthy();
  });
});
