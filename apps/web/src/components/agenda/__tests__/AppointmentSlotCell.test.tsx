import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AppointmentSlotCell } from '../AppointmentSlotCell';

const buildAppt = (overrides = {}) => ({
  id: 1,
  patientId: 10,
  date: '2026-04-15T14:00:00.000Z',
  durationMinutes: 30,
  patient: { name: 'João Silva' },
  ...overrides,
});

describe('AppointmentSlotCell', () => {
  const setup = (overrides = {}) => {
    const onOpenRecord = jest.fn();
    const onOpenPrescription = jest.fn();
    render(
      <AppointmentSlotCell
        appt={buildAppt(overrides)}
        slotHeightPx={16}
        onOpenRecord={onOpenRecord}
        onOpenPrescription={onOpenPrescription}
      />,
    );
    return { onOpenRecord, onOpenPrescription };
  };

  it('renderiza nome do paciente e intervalo de horário', () => {
    setup();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    // Horário formatado HH:mm — depende do timezone; basta existir um pattern HH:mm - HH:mm
    const match = screen.getByText(/\d{2}:\d{2} - \d{2}:\d{2}/);
    expect(match).toBeInTheDocument();
  });

  it('click no card dispara onOpenRecord com dados do paciente', async () => {
    const { onOpenRecord } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Abrir prontuário de João Silva/i }));
    expect(onOpenRecord).toHaveBeenCalledWith({
      id: 10,
      name: 'João Silva',
      appointmentId: 1,
    });
  });

  it('Enter no card dispara onOpenRecord (a11y teclado)', async () => {
    const { onOpenRecord } = setup();
    const card = screen.getByRole('button', { name: /Abrir prontuário de João Silva/i });
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpenRecord).toHaveBeenCalledTimes(1);
  });

  it('botão FileText interno dispara onOpenRecord e não propaga', async () => {
    const { onOpenRecord } = setup();
    await userEvent.click(screen.getByRole('button', { name: /^Abrir Prontuário$/i }));
    // Apenas uma invocação — não propagou para o card pai
    expect(onOpenRecord).toHaveBeenCalledTimes(1);
  });

  it('botão Pill interno dispara onOpenPrescription sem abrir record', async () => {
    const { onOpenRecord, onOpenPrescription } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Emitir Receita/i }));
    expect(onOpenPrescription).toHaveBeenCalledTimes(1);
    expect(onOpenRecord).not.toHaveBeenCalled();
  });

  it('mostra "Consulta" quando altura é suficiente (height > 30)', () => {
    // durationMinutes 30 + slotHeight 16 = 2*16 - 4 = 28... ajustamos
    render(
      <AppointmentSlotCell
        appt={buildAppt({ durationMinutes: 60 })}
        slotHeightPx={16}
        onOpenRecord={jest.fn()}
        onOpenPrescription={jest.fn()}
      />,
    );
    // 4 slots * 16 - 4 = 60 > 30 → mostra "Consulta"
    const consultaBadge = screen.getByText('Consulta', { selector: 'p' });
    expect(consultaBadge).toBeInTheDocument();
  });

  it('omite label "Consulta" em slots muito pequenos', () => {
    // fallback patient, duration pequena
    render(
      <AppointmentSlotCell
        appt={buildAppt({ durationMinutes: 15, patient: { name: 'Ana' } })}
        slotHeightPx={2}
        onOpenRecord={jest.fn()}
        onOpenPrescription={jest.fn()}
      />,
    );
    // height = 1 * 2 - 4 = -2 → não renderiza o <p>Consulta</p>
    expect(screen.queryByText('Consulta', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('fallback "Paciente" quando name ausente', () => {
    setup({ patient: undefined });
    expect(
      screen.getByRole('button', { name: /Abrir prontuário de paciente/i }),
    ).toBeInTheDocument();
  });
});
