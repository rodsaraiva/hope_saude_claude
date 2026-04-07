'use client';

import { FileText, Pill } from 'lucide-react';
import { format, addMinutes, parseISO } from 'date-fns';

export interface AppointmentSlotData {
  id: number;
  patientId: number;
  date: string;
  durationMinutes: number;
  patient?: { name?: string };
}

interface Props {
  appt: AppointmentSlotData;
  slotHeightPx: number;
  onOpenRecord: (info: { id: number; name: string; appointmentId: number }) => void;
  onOpenPrescription: (info: { id: number; name: string; appointmentId: number }) => void;
}

/**
 * Card de consulta confirmada na grade semanal.
 * Posicionamento absoluto calculado a partir do início do dia em minutos.
 * Teclado: Enter/Space abre o prontuário. Botões internos (FileText/Pill)
 * abrem prontuário ou receita com stopPropagation.
 */
export function AppointmentSlotCell({
  appt,
  slotHeightPx,
  onOpenRecord,
  onOpenPrescription,
}: Props) {
  const start = parseISO(appt.date);
  const end = addMinutes(start, appt.durationMinutes);
  const startStr = format(start, 'HH:mm');
  const endStr = format(end, 'HH:mm');

  const startTotalMinutes = start.getHours() * 60 + start.getMinutes();
  const top = (startTotalMinutes / 15) * slotHeightPx;
  const durationSlots = appt.durationMinutes / 15;
  const height = durationSlots * slotHeightPx - 4;

  const patientInfo = {
    id: appt.patientId,
    name: appt.patient?.name || 'Paciente',
    appointmentId: appt.id,
  };

  const handleOpenRecord = () => onOpenRecord(patientInfo);

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`Abrir prontuário de ${appt.patient?.name || 'paciente'}`}
      onClick={handleOpenRecord}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenRecord();
        }
      }}
      className="absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-emerald-200 bg-emerald-100/90 p-1.5 shadow-sm z-30 ring-1 ring-inset ring-emerald-300/30 cursor-pointer hover:bg-emerald-200/90 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
      style={{
        top: `${top + 1}px`,
        height: `${height}px`,
        borderLeftWidth: '4px',
        borderLeftColor: '#059669',
      }}
      title={`Consulta: ${appt.patient?.name || 'Paciente'} (Clique para abrir prontuário)`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[9px] font-bold leading-none text-emerald-900 truncate">
          {appt.patient?.name || 'Consulta'}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenRecord(patientInfo);
            }}
            className="p-0.5 hover:bg-emerald-200 rounded text-emerald-700"
            title="Abrir Prontuário"
            aria-label="Abrir Prontuário"
          >
            <FileText size={10} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenPrescription(patientInfo);
            }}
            className="p-0.5 hover:bg-emerald-200 rounded text-emerald-700"
            title="Emitir Receita"
            aria-label="Emitir Receita"
          >
            <Pill size={10} aria-hidden />
          </button>
        </div>
      </div>
      <p className="mt-0.5 text-[9px] font-medium text-emerald-700 leading-none">
        {startStr} - {endStr}
      </p>
      {height > 30 && (
        <p className="mt-1 text-[8px] font-bold text-emerald-600/80 uppercase tracking-tight">
          Consulta
        </p>
      )}
    </div>
  );
}
