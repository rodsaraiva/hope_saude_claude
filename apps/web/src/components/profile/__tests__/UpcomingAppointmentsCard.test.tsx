import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UpcomingAppointmentsCard } from '../UpcomingAppointmentsCard';

const mkAppt = (overrides = {}) => ({
  id: 1,
  patientId: 10,
  doctorId: 5,
  date: '2027-01-15T14:00:00.000Z',
  status: 'CONFIRMED',
  ...overrides,
});

describe('UpcomingAppointmentsCard', () => {
  it('placeholder quando lista vazia', () => {
    render(<UpcomingAppointmentsCard upcoming={[]} userRole="PATIENT" doctorNames={{}} />);
    expect(screen.getByText(/Nenhuma consulta futura agendada/i)).toBeInTheDocument();
  });

  it('PATIENT: mostra "Com Dr. Nome" via doctorNames', () => {
    render(
      <UpcomingAppointmentsCard
        upcoming={[mkAppt()]}
        userRole="PATIENT"
        doctorNames={{ 5: 'Ana' }}
      />,
    );
    expect(screen.getByText(/Com Dr\. Ana/)).toBeInTheDocument();
  });

  it('DOCTOR: mostra "Paciente (ID N)" em vez do nome do médico', () => {
    render(
      <UpcomingAppointmentsCard
        upcoming={[mkAppt()]}
        userRole="DOCTOR"
        doctorNames={{ 5: 'Ana' }}
      />,
    );
    expect(screen.getByText(/Paciente \(ID 10\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Com Dr\./)).not.toBeInTheDocument();
  });

  it('mostra botão "Entrar na consulta" apenas quando CONFIRMED', () => {
    render(
      <UpcomingAppointmentsCard
        upcoming={[mkAppt({ id: 1, status: 'CONFIRMED' }), mkAppt({ id: 2, status: 'PENDING' })]}
        userRole="PATIENT"
        doctorNames={{}}
      />,
    );
    const links = screen.getAllByRole('link', { name: /Entrar na consulta/i });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/video/1');
  });

  it('aplica classes de status diferentes (CONFIRMED/PENDING/outros)', () => {
    const { container } = render(
      <UpcomingAppointmentsCard
        upcoming={[
          mkAppt({ id: 1, status: 'CONFIRMED' }),
          mkAppt({ id: 2, status: 'PENDING' }),
          mkAppt({ id: 3, status: 'CANCELLED' }),
        ]}
        userRole="PATIENT"
        doctorNames={{}}
      />,
    );
    expect(container.querySelector('.bg-green-100')).toBeTruthy();
    expect(container.querySelector('.bg-amber-100')).toBeTruthy();
    expect(container.querySelector('.bg-slate-100')).toBeTruthy();
  });
});
