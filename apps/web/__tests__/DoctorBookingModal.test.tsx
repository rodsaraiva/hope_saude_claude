import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DoctorBookingModal from '../src/components/DoctorBookingModal';
import * as bookingApi from '../src/lib/patient-booking-api';
import { format, parseISO } from 'date-fns';

jest.mock('../src/lib/patient-booking-api');

const mockDoctor = {
  id: 1,
  userId: 10,
  specialty: 'Cardiologia',
  availability: '[]',
  user: { name: 'João Silva' },
};

describe('DoctorBookingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve carregar e exibir horários agrupados por data', async () => {
    const mockSlots = [
      { start: '2026-05-01T08:00:00Z', end: '2026-05-01T09:00:00Z' },
      { start: '2026-05-02T14:00:00Z', end: '2026-05-02T15:00:00Z' },
    ];

    (bookingApi.fetchDoctorAvailableSlots as jest.Mock).mockResolvedValue({
      timeZone: 'UTC',
      slots: mockSlots,
    });

    render(
      <DoctorBookingModal
        doctor={mockDoctor}
        onClose={jest.fn()}
        onBook={jest.fn()}
      />
    );

    // O loader não tem texto agora, mas podemos esperar ele sumir
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument(); // Se tivesse role="status", mas não coloquei.
      // Vamos apenas esperar os dias aparecerem
      expect(screen.getByText('01')).toBeInTheDocument();
    });

    expect(screen.getByText('02')).toBeInTheDocument();

    // O primeiro dia deve estar selecionado por padrão, então deve mostrar o horário dele
    const expectedTime1 = format(parseISO(mockSlots[0].start), 'HH:mm');
    expect(screen.getByText(expectedTime1)).toBeInTheDocument();

    // Clica no segundo dia
    fireEvent.click(screen.getByText('02'));

    // Agora deve mostrar o horário do segundo dia
    const expectedTime2 = format(parseISO(mockSlots[1].start), 'HH:mm');
    expect(screen.getByText(expectedTime2)).toBeInTheDocument();
  });

  it('deve chamar onBook ao clicar em um horário', async () => {
    const onBook = jest.fn().mockResolvedValue(undefined);
    const mockSlots = [{ start: '2026-05-01T08:00:00Z', end: '2026-05-01T09:00:00Z' }];

    (bookingApi.fetchDoctorAvailableSlots as jest.Mock).mockResolvedValue({
      timeZone: 'UTC',
      slots: mockSlots,
    });

    render(
      <DoctorBookingModal
        doctor={mockDoctor}
        onClose={jest.fn()}
        onBook={onBook}
      />
    );

    const expectedTime = format(parseISO(mockSlots[0].start), 'HH:mm');

    await waitFor(() => {
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(expectedTime));
    
    expect(onBook).toHaveBeenCalledWith(mockDoctor.userId, '2026-05-01T08:00:00Z', undefined);
  });

  it('deve exibir erro se a API falhar', async () => {
    (bookingApi.fetchDoctorAvailableSlots as jest.Mock).mockRejectedValue(new Error('Falha'));

    render(
      <DoctorBookingModal
        doctor={mockDoctor}
        onClose={jest.fn()}
        onBook={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível carregar os horários/i)).toBeInTheDocument();
    });
  });

  it('deve fechar ao clicar no fundo (overlay)', async () => {
    const onClose = jest.fn();
    (bookingApi.fetchDoctorAvailableSlots as jest.Mock).mockResolvedValue({
      timeZone: 'UTC',
      slots: [],
    });

    render(
      <DoctorBookingModal
        doctor={mockDoctor}
        onClose={onClose}
        onBook={jest.fn()}
      />
    );

    // O fundo do modal (overlay) é o elemento com role="dialog"
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('deve fechar ao pressionar a tecla Escape', async () => {
    const onClose = jest.fn();
    (bookingApi.fetchDoctorAvailableSlots as jest.Mock).mockResolvedValue({
      timeZone: 'UTC',
      slots: [],
    });

    render(
      <DoctorBookingModal
        doctor={mockDoctor}
        onClose={onClose}
        onBook={jest.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('deve recarregar horários ao mudar o modelo de consulta', async () => {
    const doctorWithModels = {
      ...mockDoctor,
      consultationModels: [
        { id: 1, name: 'Curta', durationMinutes: 30, price: 100 },
        { id: 2, name: 'Longa', durationMinutes: 60, price: 200 },
      ],
    };

    (bookingApi.fetchDoctorAvailableSlots as jest.Mock).mockResolvedValue({
      timeZone: 'UTC',
      slots: [],
    });

    render(
      <DoctorBookingModal
        doctor={doctorWithModels}
        onClose={jest.fn()}
        onBook={jest.fn()}
      />
    );

    // Deve carregar inicialmente com o primeiro modelo (30 min)
    await waitFor(() => {
      expect(bookingApi.fetchDoctorAvailableSlots).toHaveBeenCalledWith(
        mockDoctor.userId,
        expect.any(String),
        expect.any(String),
        30
      );
    });

    // Clica no segundo modelo (60 min)
    fireEvent.click(screen.getByText('Longa'));

    // Deve chamar a API novamente com 60 min
    await waitFor(() => {
      expect(bookingApi.fetchDoctorAvailableSlots).toHaveBeenLastCalledWith(
        mockDoctor.userId,
        expect.any(String),
        expect.any(String),
        60
      );
    });
  });
});
