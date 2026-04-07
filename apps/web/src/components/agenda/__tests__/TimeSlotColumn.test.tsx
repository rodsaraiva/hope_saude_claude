import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimeSlotColumn } from '../TimeSlotColumn';

describe('TimeSlotColumn', () => {
  it('renderiza apenas horas cheias (8:00, 9:00) visíveis', () => {
    render(<TimeSlotColumn slots={['08:00', '08:15', '08:30', '08:45', '09:00']} />);
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    // intermediários existem como elementos mas sem texto visível
    expect(screen.queryByText('08:15')).not.toBeInTheDocument();
  });

  it('renderiza n slots (mesmo que vazios)', () => {
    const slots = ['08:00', '08:15', '08:30', '08:45'];
    const { container } = render(<TimeSlotColumn slots={slots} />);
    // 4 elementos de slot no total
    expect(container.querySelectorAll('.h-4.border-b').length).toBe(4);
  });
});
