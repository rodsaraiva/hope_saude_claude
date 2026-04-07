'use client';

import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

interface Props {
  baseDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewSlot: () => void;
}

/**
 * Barra superior do calendário (título, botão "Novo horário", navegação semanal).
 * Stateless — recebe baseDate e callbacks via props para facilitar testes.
 */
export function CalendarToolbar({ baseDate, onPrev, onNext, onToday, onNewSlot }: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 p-6">
      <div className="flex items-center gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <CalendarIcon className="h-5 w-5 text-sky-600" aria-hidden />
          Grade de Horários
        </h2>
        <button
          type="button"
          onClick={onNewSlot}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-95"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo horário
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToday}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
        >
          Hoje
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <span
            className="min-w-[140px] text-center text-base font-bold text-slate-800 capitalize"
            aria-live="polite"
          >
            {format(baseDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button
            type="button"
            onClick={onNext}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
