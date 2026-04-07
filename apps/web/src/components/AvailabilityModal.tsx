'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, RotateCcw, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { Modal } from './ui/Modal';
import { TIME_SLOTS } from '@/lib/slot-utils';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    date: string;
    start: string;
    end: string;
    recurrence: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
    isRecurrenceChecked: boolean;
  }) => void;
  isLoading?: boolean;
  initialData?: {
    date: string;
    start: string;
    end: string;
    recurrence: 'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY';
    isRecurrenceChecked: boolean;
  };
  isEditing?: boolean;
}

export function AvailabilityModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  initialData,
  isEditing,
}: AvailabilityModalProps) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('09:00');
  const [recurrence, setRecurrence] = useState<
    'NONE' | 'WEEKLY' | 'DAILY' | 'WEEKDAYS' | 'BIWEEKLY'
  >('NONE');
  const [isRecurrenceChecked, setIsRecurrenceChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialData) {
      setDate(initialData.date);
      setStart(initialData.start);
      setEnd(initialData.end);
      setRecurrence(initialData.recurrence);
      setIsRecurrenceChecked(initialData.isRecurrenceChecked);
      setError(null);
    }
  }, [isOpen, initialData]);

  const validate = () => {
    if (!date) return 'Selecione uma data';
    if (start >= end) return 'A hora de fim deve ser após a hora de início';
    return null;
  };

  const handleConfirm = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    onConfirm({ date, start, end, recurrence, isRecurrenceChecked });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Disponibilidade' : 'Nova Disponibilidade'}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-3 font-bold text-slate-600 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? 'Atualizar' : 'Adicionar'}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="slot-date"
            className="flex items-center gap-2 text-sm font-bold text-slate-700"
          >
            <Calendar className="h-4 w-4 text-sky-600" />
            Data
          </label>
          <input
            id="slot-date"
            type="date"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="slot-start"
              className="flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <Clock className="h-4 w-4 text-sky-600" />
              Início
            </label>
            <select
              id="slot-start"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setError(null);
              }}
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="slot-end"
              className="flex items-center gap-2 text-sm font-bold text-slate-700"
            >
              <Clock className="h-4 w-4 text-sky-600" />
              Fim
            </label>
            <select
              id="slot-end"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setError(null);
              }}
            >
              {[...TIME_SLOTS, '24:00'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all overflow-hidden">
          <button
            type="button"
            onClick={() => setIsRecurrenceChecked(!isRecurrenceChecked)}
            className="flex w-full items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            aria-pressed={isRecurrenceChecked}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${isRecurrenceChecked ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400'}`}
              >
                <RotateCcw className="h-5 w-5" />
              </div>
              <span className="text-sm font-bold text-slate-700">Repetir este horário</span>
            </div>

            <div className="relative inline-flex h-6 w-11 items-center transition-colors focus:outline-none">
              <div
                className={`h-6 w-11 rounded-full transition-colors ${isRecurrenceChecked ? 'bg-sky-600' : 'bg-slate-200'}`}
              ></div>
              <div
                className={`absolute left-1 h-4 w-4 rounded-full bg-white transition-transform ${isRecurrenceChecked ? 'translate-x-5' : 'translate-x-0'}`}
              ></div>
            </div>
          </button>

          {isRecurrenceChecked && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-in slide-in-from-top-2 duration-300">
              <label
                htmlFor="slot-recurrence"
                className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
              >
                Frequência
              </label>
              <div className="relative">
                <select
                  id="slot-recurrence"
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  value={recurrence}
                  onChange={(e) => setNewRecurrence(e.target.value as any)}
                >
                  <option value="WEEKLY">Semanalmente</option>
                  <option value="DAILY">Todos os dias (Seg-Dom)</option>
                  <option value="WEEKDAYS">Dias de semana (Seg-Sex)</option>
                  <option value="BIWEEKLY">A cada duas semanas</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <ChevronRight className="h-4 w-4 rotate-90" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );

  function setNewRecurrence(val: any) {
    setRecurrence(val);
  }
}
