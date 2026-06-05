import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UpcomingAppointmentsCard } from '../UpcomingAppointmentsCard';

const baseAppt = {
  id: 1,
  patientId: 20,
  doctorId: 5,
  date: '2026-07-01T10:00:00.000Z',
  status: 'CONFIRMED',
};

describe('UpcomingAppointmentsCard — cancelar', () => {
  it('mostra botão Cancelar em consulta CONFIRMED e chama onCancel com o id', () => {
    const onCancel = jest.fn();
    render(
      <UpcomingAppointmentsCard
        upcoming={[baseAppt]}
        userRole="PATIENT"
        doctorNames={{ 5: 'Ana' }}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledWith(1);
  });

  it('não mostra botão Cancelar em consulta CANCELLED', () => {
    render(
      <UpcomingAppointmentsCard
        upcoming={[{ ...baseAppt, status: 'CANCELLED' }]}
        userRole="PATIENT"
        doctorNames={{ 5: 'Ana' }}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });
});
