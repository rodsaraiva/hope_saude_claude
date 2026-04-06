import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DoctorAgenda from '../src/app/agenda/page';
import { getProfileMeSafe, fetchAppointmentsMe } from '../src/lib/doctor-dashboard-api';
import { format, addMinutes, addDays } from 'date-fns';

jest.mock('../src/lib/doctor-dashboard-api', () => ({
  getProfileMeSafe: jest.fn(),
  fetchAppointmentsMe: jest.fn(),
  saveDoctorAvailability: jest.fn(),
}));

jest.mock('../src/hooks/useGridSelection', () => ({
  useGridSelection: () => ({
    selection: null,
    handleMouseDown: jest.fn(),
    handleMouseEnter: jest.fn(),
    handleMouseUp: jest.fn(),
  }),
}));

describe('DoctorAgenda - Appointments display', () => {
  const mockProfile = {
    profile: {
      user: { name: 'Dr. João' },
      availability: '[]',
    }
  };

  const mockAppointments = [
    {
      id: 1,
      date: '2026-04-03T10:00:00.000Z', // Use a fixed time in UTC
      durationMinutes: 60,
      patient: { name: 'Maria Silva' },
      status: 'CONFIRMED',
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Force a specific date to match currentWeekDays logic if needed,
    // but the component uses new Date() which we can't easily mock here
    // without more setup. Let's just make sure the mock date is "today"
    // relative to the test runner.
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    mockAppointments[0].date = today.toISOString();

    (getProfileMeSafe as jest.Mock).mockResolvedValue(mockProfile);
    (fetchAppointmentsMe as jest.Mock).mockResolvedValue(mockAppointments);
  });

  it('deve carregar e exibir consultas confirmadas na agenda', async () => {
    render(<DoctorAgenda />);

    await waitFor(() => {
      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    });

    const start = new Date(mockAppointments[0].date);
    const startStr = format(start, 'HH:mm');
    const endStr = format(addMinutes(start, 60), 'HH:mm');

    expect(screen.getByText(new RegExp(`${startStr} - ${endStr}`))).toBeInTheDocument();
    expect(screen.getByText('Consulta')).toBeInTheDocument();
  });

  it('deve exibir consultas de outra semana ao navegar no calendário', async () => {
    const nextWeekDate = addDays(new Date(), 7);
    const mockAppointments = [
      {
        id: 2,
        date: nextWeekDate.toISOString(),
        durationMinutes: 30,
        patient: { name: 'Roberto Carlos' },
        status: 'CONFIRMED',
      }
    ];
    (fetchAppointmentsMe as jest.Mock).mockResolvedValue(mockAppointments);

    render(<DoctorAgenda />);

    // Inicialmente não deve mostrar Roberto (está na próxima semana)
    await waitFor(() => {
      expect(screen.queryByText('Roberto Carlos')).not.toBeInTheDocument();
    });

    // Clica em "Próxima semana"
    const nextBtn = screen.getByLabelText('Próxima semana');
    fireEvent.click(nextBtn);

    // Agora deve aparecer
    await waitFor(() => {
      expect(screen.getByText('Roberto Carlos')).toBeInTheDocument();
    });
  });
});
