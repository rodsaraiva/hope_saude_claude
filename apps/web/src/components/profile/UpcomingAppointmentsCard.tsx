'use client';

import { Calendar, Clock } from 'lucide-react';

export interface AppointmentRow {
  id: number;
  patientId: number;
  doctorId: number;
  date: string;
  status: string;
}

interface Props {
  upcoming: AppointmentRow[];
  userRole: 'DOCTOR' | 'PATIENT' | string;
  doctorNames: Record<number, string>;
}

/**
 * Card "Próximas consultas" do perfil. Lista appointments futuros do
 * usuário corrente. PATIENT vê "Com Dr. X", DOCTOR vê "Paciente (ID N)".
 * Botão "Entrar na consulta" aparece apenas quando status=CONFIRMED.
 */
export function UpcomingAppointmentsCard({ upcoming, userRole, doctorNames }: Props) {
  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
      aria-labelledby="proximas-heading"
    >
      <h2
        id="proximas-heading"
        className="flex items-center gap-2 text-lg font-semibold text-slate-900"
      >
        <Calendar className="h-5 w-5 text-emerald-600" aria-hidden />
        Próximas consultas
      </h2>
      <ul className="mt-4 space-y-3">
        {upcoming.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
            Nenhuma consulta futura agendada.
          </li>
        )}
        {upcoming.map((appt) => (
          <li
            key={appt.id}
            className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-emerald-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <p className="font-medium text-slate-900">
                  {new Date(appt.date).toLocaleString('pt-BR')}
                </p>
                {userRole === 'PATIENT' && (
                  <p className="text-sm text-slate-600">
                    Com Dr. {doctorNames[appt.doctorId] ?? '—'}
                  </p>
                )}
                {userRole === 'DOCTOR' && (
                  <p className="text-sm text-slate-600">Paciente (ID {appt.patientId})</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  appt.status === 'CONFIRMED'
                    ? 'bg-green-100 text-green-800'
                    : appt.status === 'PENDING'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                {appt.status}
              </span>
              {appt.status === 'CONFIRMED' && (
                <a
                  href={`/video/${appt.id}`}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  Entrar na consulta
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
