import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LoginPage from '../page';
import { api } from '@/lib/api-client';
import * as redirect from '@/lib/post-auth-redirect';

jest.mock('@/lib/api-client');
jest.mock('@/lib/post-auth-redirect');

const mockedApi = api as jest.Mocked<typeof api>;
const mockedRedirect = redirect as jest.Mocked<typeof redirect>;

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fillForm = async (email: string, password: string) => {
    await userEvent.type(screen.getByLabelText(/E-mail/i), email);
    await userEvent.type(screen.getByLabelText(/Senha/i), password);
  };

  it('renderiza inputs de e-mail e senha e botão entrar', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
  });

  it('faz POST /auth/login com credenciais e persiste sessão em sucesso', async () => {
    mockedApi.post.mockResolvedValue({ access_token: 'jwt-xyz' });

    render(<LoginPage />);
    await fillForm('user@x.com', '123456');
    await userEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'user@x.com',
        password: '123456',
      });
      expect(mockedRedirect.persistSessionAndRedirect).toHaveBeenCalledWith('jwt-xyz');
    });
  });

  it('exibe mensagem amigável quando o servidor retorna 401', async () => {
    mockedApi.post.mockRejectedValue({ status: 401, message: 'Unauthorized' });

    render(<LoginPage />);
    await fillForm('user@x.com', 'errada');
    await userEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/E-mail ou senha incorretos/i)).toBeInTheDocument();
    });
    expect(mockedRedirect.persistSessionAndRedirect).not.toHaveBeenCalled();
  });

  it('exibe erro genérico quando o servidor falha sem 401', async () => {
    mockedApi.post.mockRejectedValue({ message: 'Network down' });

    render(<LoginPage />);
    await fillForm('user@x.com', '123456');
    await userEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network down/i)).toBeInTheDocument();
    });
  });

  it('alterna visibilidade da senha ao clicar no toggle', async () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText(/Senha/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // O botão de toggle não tem texto — usamos parent do ícone via querySelector
    // ou clicamos no botão dentro da div password (último button antes do submit).
    const toggleButtons = screen.getAllByRole('button');
    // Os buttons na ordem: toggle eye, submit. Pegamos o primeiro tipo button (não submit).
    const toggle = toggleButtons.find((b) => b.getAttribute('type') === 'button');
    expect(toggle).toBeDefined();
    await userEvent.click(toggle!);
    expect(passwordInput.type).toBe('text');
  });
});
