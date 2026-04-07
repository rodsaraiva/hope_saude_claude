import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgendaHeader } from '../AgendaHeader';

describe('AgendaHeader', () => {
  it('renderiza o título e a chamada secundária', () => {
    render(<AgendaHeader />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Agenda de Disponibilidade/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Área do especialista/i)).toBeInTheDocument();
    expect(screen.getByText(/Configure os horários/i)).toBeInTheDocument();
  });
});
