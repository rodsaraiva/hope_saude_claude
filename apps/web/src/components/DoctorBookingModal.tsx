'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Calendar, Clock, X, ChevronRight, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { fetchDoctorAvailableSlots, type AvailableSlotsResponse } from '@/lib/patient-booking-api';

type DoctorRow = {
  id: number;
  userId: number;
  specialty: string;
  availability: string | null;
  user?: { name: string };
  consultationModels?: Array<{
    id: number;
    name: string;
    durationMinutes: number;
    price: number;
  }>;
};

type Props = {
  doctor: DoctorRow;
  onClose: () => void;
  onBook: (doctorUserId: number, dateIso: string, consultationModelId?: number) => Promise<void>;
};

function defaultRangeIso(): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 21);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function DoctorBookingModal({ doctor, onClose, onBook }: Props) {
  const models = doctor.consultationModels || [];
  const hasModels = models.length > 0;
  const [selectedModelId, setSelectedModelId] = useState<number | null>(
    hasModels ? models[0].id : null,
  );

  const [data, setData] = useState<AvailableSlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId),
    [models, selectedModelId],
  );
  const durationMinutes = selectedModel?.durationMinutes;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = defaultRangeIso();
        const res = await fetchDoctorAvailableSlots(doctor.userId, from, to, durationMinutes);
        if (!cancelled) {
          setData(res);
          // Auto-seleciona o primeiro dia com horários
          if (res.slots.length > 0) {
            const firstDate = format(parseISO(res.slots[0].start), 'yyyy-MM-dd');
            setSelectedDateStr(firstDate);
          } else {
            setSelectedDateStr(null);
          }
        }
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar os horários disponíveis.');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [doctor.userId, durationMinutes]);

  const tz = data?.timeZone ?? 'America/Sao_Paulo';

  const groupedSlots = useMemo(() => {
    if (!data) return {};
    const groups: Record<string, typeof data.slots> = {};
    data.slots.forEach((slot) => {
      const d = format(parseISO(slot.start), 'yyyy-MM-dd');
      if (!groups[d]) groups[d] = [];
      groups[d].push(slot);
    });
    return groups;
  }, [data]);

  const availableDates = useMemo(() => Object.keys(groupedSlots).sort(), [groupedSlots]);
  const slotsForSelectedDate = selectedDateStr ? groupedSlots[selectedDateStr] || [] : [];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    // ESC já fecha via useEffect; click no backdrop é apenas convenience visual
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="flex flex-col w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Agendar Consulta</h3>
            <p className="text-xs text-slate-500 font-medium">
              Dr. {doctor?.user?.name || 'Médico'} • {doctor.specialty}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 1. Modalidade de Consulta */}
          {hasModels && (
            <section>
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500">
                  1
                </div>
                Escolha a modalidade
              </h4>
              <div className="space-y-2">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModelId(model.id)}
                    className={`group relative flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                      selectedModelId === model.id
                        ? 'border-sky-500 bg-sky-50/50 ring-1 ring-sky-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                          selectedModelId === model.id
                            ? 'border-sky-500 bg-sky-500 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selectedModelId === model.id && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <span
                          className={`block font-bold text-sm ${selectedModelId === model.id ? 'text-sky-900' : 'text-slate-700'}`}
                        >
                          {model.name}
                        </span>
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {model.durationMinutes} minutos
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-bold ${selectedModelId === model.id ? 'text-sky-700' : 'text-slate-900'}`}
                    >
                      R$ {model.price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 2. Data e Hora */}
          <section className={loading ? 'opacity-50 pointer-events-none' : ''}>
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500">
                2
              </div>
              Escolha o melhor horário
            </h4>

            {loading ? (
              <div className="flex py-10 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
              </div>
            ) : error ? (
              <div className="rounded-xl bg-red-50 p-4 text-center">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            ) : data && data.slots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-800">Sem horários livres</p>
                <p className="text-xs text-slate-500 mt-1">
                  Tente outra modalidade ou volte mais tarde.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Date Selector */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                  {availableDates.map((dateStr) => {
                    const date = parseISO(dateStr);
                    const isSelected = dateStr === selectedDateStr;
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDateStr(dateStr)}
                        className={`flex min-w-[64px] flex-col items-center rounded-xl border py-2.5 px-2 transition-all ${
                          isSelected
                            ? 'border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50'
                        }`}
                      >
                        <span
                          className={`text-[9px] font-bold uppercase ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}
                        >
                          {format(date, 'eee', { locale: ptBR })}
                        </span>
                        <span className="text-base font-bold mt-0.5">{format(date, 'dd')}</span>
                        <span
                          className={`text-[9px] font-medium uppercase mt-0.5 ${isSelected ? 'text-sky-100' : 'text-slate-500'}`}
                        >
                          {format(date, 'MMM', { locale: ptBR }).replace('.', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Time Grid with Scroll */}
                <div className="relative">
                  <div className="grid grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {slotsForSelectedDate.map((slot) => {
                      const start = parseISO(slot.start);
                      const timeLabel = format(start, 'HH:mm');
                      return (
                        <button
                          key={slot.start}
                          onClick={() =>
                            onBook(doctor.userId, slot.start, selectedModelId || undefined)
                          }
                          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 hover:border-sky-500 hover:bg-sky-50 hover:shadow-sm transition-all active:scale-95 group"
                        >
                          <span className="text-sm font-bold text-slate-700 group-hover:text-sky-700">
                            {timeLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium group-hover:text-sky-600">
                            Selecionar
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {slotsForSelectedDate.length > 9 && (
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-tight">
              Fuso: {tz.replace('_', ' ')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors px-4 py-2"
          >
            Cancelar
          </button>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
