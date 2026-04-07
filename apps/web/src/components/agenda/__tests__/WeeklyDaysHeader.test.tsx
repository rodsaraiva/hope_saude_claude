import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WeeklyDaysHeader } from '../WeeklyDaysHeader';
import { addDays } from 'date-fns';

describe('WeeklyDaysHeader', () => {
  it('renderiza a label "Hora" fixa', () => {
    render(<WeeklyDaysHeader days={[new Date('2026-04-06')]} />);
    expect(screen.getByText('Hora')).toBeInTheDocument();
  });

  it('renderiza 7 dias da semana', () => {
    const start = new Date('2026-04-06');
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const { container } = render(<WeeklyDaysHeader days={days} />);
    // 8 colunas: 1 "Hora" + 7 dias
    expect(container.querySelectorAll('.grid-cols-8 > div').length).toBe(8);
  });

  it('destaca o dia de hoje em sky-600', () => {
    const today = new Date();
    const { container } = render(<WeeklyDaysHeader days={[today]} />);
    // Deve haver ao menos um elemento com bg-sky-50/50
    expect(container.querySelector('.bg-sky-50\\/50')).toBeTruthy();
  });
});
