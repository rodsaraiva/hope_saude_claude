import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppointmentsHistoryCard } from '../AppointmentsHistoryCard';

const mkAppt = (overrides = {}) => ({
  id: 1,
  patientId: 10,
  doctorId: 5,
  date: '2025-01-15T14:00:00.000Z',
  status: 'COMPLETED',
  ...overrides,
});

describe('AppointmentsHistoryCard', () => {
  it('placeholder quando lista vazia', () => {
    render(<AppointmentsHistoryCard history={[]} userRole="PATIENT" doctorNames={{}} />);
    expect(screen.getByText(/Nenhuma consulta anterior/i)).toBeInTheDocument();
  });

  it('PATIENT: mostra nome do médico', () => {
    render(
      <AppointmentsHistoryCard
        history={[mkAppt()]}
        userRole="PATIENT"
        doctorNames={{ 5: 'Carlos' }}
      />,
    );
    expect(screen.getByText(/Dr\. Carlos/)).toBeInTheDocument();
  });

  it('DOCTOR: mostra "Paciente ID N"', () => {
    render(<AppointmentsHistoryCard history={[mkAppt()]} userRole="DOCTOR" doctorNames={{}} />);
    expect(screen.getByText(/Paciente ID 10/)).toBeInTheDocument();
  });

  it('lista múltiplos itens', () => {
    render(
      <AppointmentsHistoryCard
        history={[mkAppt({ id: 1 }), mkAppt({ id: 2 }), mkAppt({ id: 3 })]}
        userRole="PATIENT"
        doctorNames={{ 5: 'Ana' }}
      />,
    );
    expect(screen.getAllByText(/COMPLETED/)).toHaveLength(3);
  });
});
