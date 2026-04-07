import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CalendarToolbar } from '../CalendarToolbar';

describe('CalendarToolbar', () => {
  const setup = () => {
    const props = {
      baseDate: new Date('2026-04-15T12:00:00Z'),
      onPrev: jest.fn(),
      onNext: jest.fn(),
      onToday: jest.fn(),
      onNewSlot: jest.fn(),
    };
    render(<CalendarToolbar {...props} />);
    return props;
  };

  it('renderiza título do mês corrente em pt-BR', () => {
    setup();
    // April 2026 -> "abril 2026"
    expect(screen.getByText(/abril 2026/i)).toBeInTheDocument();
  });

  it('chama onPrev ao clicar em "Semana anterior"', async () => {
    const { onPrev } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Semana anterior/i }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('chama onNext ao clicar em "Próxima semana"', async () => {
    const { onNext } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Próxima semana/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('chama onToday ao clicar em "Hoje"', async () => {
    const { onToday } = setup();
    await userEvent.click(screen.getByRole('button', { name: /^Hoje$/i }));
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('chama onNewSlot ao clicar em "Novo horário"', async () => {
    const { onNewSlot } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Novo horário/i }));
    expect(onNewSlot).toHaveBeenCalledTimes(1);
  });
});
