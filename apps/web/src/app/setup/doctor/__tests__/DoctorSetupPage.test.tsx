import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DoctorSetupPage from '../page';
import * as api from '@/lib/profile-setup-api';

jest.mock('@/lib/profile-setup-api');
const mocked = api as jest.Mocked<typeof api>;

const originalLocation = window.location;
beforeAll(() => {
  delete (window as unknown as { location?: Location }).location;
  (window as unknown as { location: { href: string } }).location = { href: '' } as Location;
});
afterAll(() => {
  (window as unknown as { location: Location }).location = originalLocation;
});

describe('DoctorSetupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = '';
  });

  it('renderiza campos de especialidade, CRM e biografia', () => {
    render(<DoctorSetupPage />);
    expect(screen.getByLabelText(/Especialidade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CRM/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Biografia|Bio/i)).toBeInTheDocument();
  });

  it('bloqueia submit sem especialidade', async () => {
    render(<DoctorSetupPage />);
    await userEvent.type(screen.getByLabelText(/CRM/i), '123456-SP');
    await userEvent.click(screen.getByRole('button', { name: /Concluir|Finalizar|Continuar/i }));
    // Campo required do HTML
    expect(mocked.postDoctorSetup).not.toHaveBeenCalled();
  });

  it('envia payload e redireciona para dashboard em sucesso', async () => {
    mocked.postDoctorSetup.mockResolvedValue(undefined);

    render(<DoctorSetupPage />);
    await userEvent.type(screen.getByLabelText(/Especialidade/i), 'Psiquiatria');
    await userEvent.type(screen.getByLabelText(/CRM/i), '123456-SP');
    await userEvent.type(screen.getByLabelText(/Biografia|Bio/i), '10 anos de experiência');
    await userEvent.click(screen.getByRole('button', { name: /Concluir|Finalizar|Continuar/i }));

    await waitFor(() => {
      expect(mocked.postDoctorSetup).toHaveBeenCalledWith({
        specialty: 'Psiquiatria',
        crm: '123456-SP',
        bio: '10 anos de experiência',
      });
    });
    expect(window.location.href).toBe('/dashboard/doctor');
  });

  it('exibe erro quando API falha', async () => {
    mocked.postDoctorSetup.mockRejectedValue(new Error('CRM inválido'));

    render(<DoctorSetupPage />);
    await userEvent.type(screen.getByLabelText(/Especialidade/i), 'Psiquiatria');
    await userEvent.type(screen.getByLabelText(/CRM/i), 'xxx');
    await userEvent.click(screen.getByRole('button', { name: /Concluir|Finalizar|Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/CRM inválido/i)).toBeInTheDocument();
    });
  });
});
