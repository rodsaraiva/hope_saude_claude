import { format, isSameDay } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

interface Props {
  days: Date[];
}

/**
 * Linha sticky do topo do grid com os 7 dias da semana atual.
 * Stateless. Hoje é destacado em sky-600.
 */
export function WeeklyDaysHeader({ days }: Props) {
  return (
    <div className="sticky top-0 z-50 grid grid-cols-8 border-b border-slate-100 bg-white shadow-sm">
      <div className="border-r border-slate-100 p-4 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
        Hora
      </div>
      {days.map((date) => {
        const today = isSameDay(date, new Date());
        const dayName = format(date, 'EEEE', { locale: ptBR });
        const dayNum = format(date, 'd');
        return (
          <div
            key={date.toISOString()}
            className={`border-r border-slate-100 p-4 text-center transition ${
              today ? 'bg-sky-50/50' : 'bg-slate-50'
            }`}
          >
            <div
              className={`text-xs font-bold uppercase tracking-wider ${
                today ? 'text-sky-600' : 'text-slate-500'
              }`}
            >
              {dayName.split('-')[0].substring(0, 3)}
            </div>
            <div className={`mt-1 text-xl font-bold ${today ? 'text-sky-600' : 'text-slate-900'}`}>
              {dayNum}
            </div>
          </div>
        );
      })}
    </div>
  );
}
