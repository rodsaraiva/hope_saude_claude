import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PatientSetupPage from '../page';
import * as api from '@/lib/profile-setup-api';

jest.mock('@/lib/profile-setup-api');
const mocked = api as jest.Mocked<typeof api>;

// Mock window.location.href (jsdom navigation)
const originalLocation = window.location;
beforeAll(() => {
  delete (window as unknown as { location?: Location }).location;
  (window as unknown as { location: { href: string } }).location = { href: '' } as Location;
});
afterAll(() => {
  (window as unknown as { location: Location }).location = originalLocation;
});

describe('PatientSetupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = '';
  });

  it('renderiza campos CPF, celular e histórico (opcional)', () => {
    render(<PatientSetupPage />);
    expect(screen.getByLabelText(/CPF/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Celular/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Histórico médico/i)).toBeInTheDocument();
  });

  it('bloqueia submit com CPF inválido', async () => {
    render(<PatientSetupPage />);
    await userEvent.type(screen.getByLabelText(/CPF/i), '111');
    await userEvent.type(screen.getByLabelText(/Celular/i), '11999999999');
    await userEvent.click(screen.getByRole('button', { name: /Finalizar setup/i }));

    // Erro deve aparecer, API não é chamada
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mocked.postPatientSetup).not.toHaveBeenCalled();
  });

  it('bloqueia submit sem celular (campo vazio)', async () => {
    render(<PatientSetupPage />);
    await userEvent.type(screen.getByLabelText(/CPF/i), '12345678909');
    // Celular vazio
    await userEvent.click(screen.getByRole('button', { name: /Finalizar setup/i }));

    // Campo required do HTML bloqueia o submit antes de chegar ao handler
    expect(mocked.postPatientSetup).not.toHaveBeenCalled();
  });

  it('envia payload com dígitos de CPF e redireciona em sucesso', async () => {
    mocked.postPatientSetup.mockResolvedValue(undefined);

    render(<PatientSetupPage />);
    await userEvent.type(screen.getByLabelText(/CPF/i), '12345678909');
    await userEvent.type(screen.getByLabelText(/Celular/i), '11999999999');
    await userEvent.type(screen.getByLabelText(/Histórico médico/i), 'Nenhum');
    await userEvent.click(screen.getByRole('button', { name: /Finalizar setup/i }));

    await waitFor(() => {
      expect(mocked.postPatientSetup).toHaveBeenCalledWith({
        cpf: '12345678909',
        phone: '11999999999',
        medicalHistory: 'Nenhum',
      });
    });
    expect(window.location.href).toBe('/profile');
  });

  it('exibe mensagem quando API retorna erro', async () => {
    mocked.postPatientSetup.mockRejectedValue(new Error('CPF já cadastrado'));

    render(<PatientSetupPage />);
    await userEvent.type(screen.getByLabelText(/CPF/i), '12345678909');
    await userEvent.type(screen.getByLabelText(/Celular/i), '11999999999');
    await userEvent.click(screen.getByRole('button', { name: /Finalizar setup/i }));

    await waitFor(() => {
      expect(screen.getByText(/CPF já cadastrado/i)).toBeInTheDocument();
    });
  });
});
