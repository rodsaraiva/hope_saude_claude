import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RegisterPage from '../page';
import { api } from '@/lib/api-client';
import * as redirect from '@/lib/post-auth-redirect';

jest.mock('@/lib/api-client');
jest.mock('@/lib/post-auth-redirect');

const mockedApi = api as jest.Mocked<typeof api>;
const mockedRedirect = redirect as jest.Mocked<typeof redirect>;

describe('RegisterPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renderiza campos de nome, e-mail, senha, role e botão cadastrar', () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar minha conta/i })).toBeInTheDocument();
  });

  it('envia POST /auth/register com role PATIENT por default', async () => {
    mockedApi.post.mockResolvedValue({ access_token: 'token-new' });

    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Maria Silva');
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'maria@x.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /Criar minha conta/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', {
        name: 'Maria Silva',
        email: 'maria@x.com',
        password: 'senha123',
        role: 'PATIENT',
      });
    });
    expect(mockedRedirect.persistSessionAndRedirect).toHaveBeenCalledWith('token-new');
  });

  it('alterna role para DOCTOR ao clicar no botão', async () => {
    mockedApi.post.mockResolvedValue({ access_token: 'tok' });

    render(<RegisterPage />);
    // Botões de role são os primeiros com texto "Paciente" / "Médico"
    await userEvent.click(screen.getByRole('button', { name: /Médico/i }));

    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'Dr. X');
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'dr@x.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /Criar minha conta/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({ role: 'DOCTOR' }),
      );
    });
  });

  it('exibe mensagem específica quando e-mail já existe (400 + email)', async () => {
    mockedApi.post.mockRejectedValue({
      status: 400,
      data: { message: 'email already in use' },
      message: 'bad request',
    });

    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'X');
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'dup@x.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /Criar minha conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/já está em uso/i)).toBeInTheDocument();
    });
    expect(mockedRedirect.persistSessionAndRedirect).not.toHaveBeenCalled();
  });

  it('exibe erro genérico em falha de rede', async () => {
    mockedApi.post.mockRejectedValue({ message: 'Network error' });

    render(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/Nome completo/i), 'X');
    await userEvent.type(screen.getByLabelText(/E-mail/i), 'x@x.com');
    await userEvent.type(screen.getByLabelText(/Senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /Criar minha conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });
});
