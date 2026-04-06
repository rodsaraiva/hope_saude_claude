import { render, screen, waitFor } from '@testing-library/react';
import DoctorDashboard from '../src/app/dashboard/doctor/page';
import { getProfileMeSafe, fetchAppointmentsMe } from '../src/lib/doctor-dashboard-api';

jest.mock('../src/lib/doctor-dashboard-api', () => ({
  getProfileMeSafe: jest.fn(),
  fetchAppointmentsMe: jest.fn(),
}));

describe('DoctorDashboard - Layout and Overview', () => {
  const mockProfile = {
    profile: {
      user: { name: 'João' },
    }
  };

  const mockAppointments = [
    { id: 1, date: new Date().toISOString(), status: 'CONFIRMED' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getProfileMeSafe as jest.Mock).mockResolvedValue(mockProfile);
    (fetchAppointmentsMe as jest.Mock).mockResolvedValue(mockAppointments);
  });

  it('deve exibir o nome do médico e resumo das consultas', async () => {
    render(<DoctorDashboard />);

    await waitFor(() => expect(screen.getByText(/Dr. João/)).toBeInTheDocument());
    expect(screen.getByText('Próximas Consultas')).toBeInTheDocument();
    expect(screen.getByText('Resumo da Semana')).toBeInTheDocument();
  });

  it('deve ter um link para gerenciar a agenda', async () => {
    render(<DoctorDashboard />);

    await waitFor(() => expect(screen.getByText('Gerenciar horários disponíveis →')).toBeInTheDocument());
    const agendaLink = screen.getByText('Gerenciar horários disponíveis →');
    expect(agendaLink.closest('a')).toHaveAttribute('href', '/agenda');
  });
});
