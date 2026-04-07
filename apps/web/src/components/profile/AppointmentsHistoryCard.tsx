'use client';

import { History } from 'lucide-react';
import type { AppointmentRow } from './UpcomingAppointmentsCard';

interface Props {
  history: AppointmentRow[];
  userRole: 'DOCTOR' | 'PATIENT' | string;
  doctorNames: Record<number, string>;
}

/**
 * Histórico de consultas passadas. Scroll vertical (max-h-80).
 */
export function AppointmentsHistoryCard({ history, userRole, doctorNames }: Props) {
  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
      aria-labelledby="historico-heading"
    >
      <h2
        id="historico-heading"
        className="flex items-center gap-2 text-lg font-semibold text-slate-900"
      >
        <History className="h-5 w-5 text-slate-500" aria-hidden />
        Histórico
      </h2>
      <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {history.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
            Nenhuma consulta anterior registrada.
          </li>
        )}
        {history.map((appt) => (
          <li
            key={appt.id}
            className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-slate-800">{new Date(appt.date).toLocaleString('pt-BR')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {userRole === 'PATIENT' && (
                <span className="text-slate-600">Dr. {doctorNames[appt.doctorId] ?? '—'}</span>
              )}
              {userRole === 'DOCTOR' && (
                <span className="text-slate-600">Paciente ID {appt.patientId}</span>
              )}
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                {appt.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
