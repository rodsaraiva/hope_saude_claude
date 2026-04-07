'use client';

import { Pill, Clock, ShieldCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import type { Prescription, Medication } from '@/lib/doctor-dashboard-api';

interface Props {
  prescriptions: Prescription[];
  doctorNames: Record<number, string>;
  onPrint?: () => void;
}

/**
 * Lista de receitas do paciente em "Meu perfil".
 * Renderiza grupos por receita, cada uma com seus medicamentos parseados
 * do JSON do campo `medications`. Selo "ASSINADA DIGITALMENTE" quando
 * `status === 'SIGNED'`.
 */
export function PrescriptionsList({ prescriptions, doctorNames, onPrint }: Props) {
  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
      aria-labelledby="receitas-heading"
    >
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2
          id="receitas-heading"
          className="flex items-center gap-2 text-lg font-semibold text-slate-900"
        >
          <Pill className="h-5 w-5 text-emerald-600" aria-hidden />
          Minhas Receitas
        </h2>
      </div>

      <div className="space-y-4">
        {prescriptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <p className="text-sm text-slate-500">Nenhuma receita encontrada.</p>
          </div>
        ) : (
          prescriptions.map((presc) => {
            let meds: Medication[] = [];
            try {
              meds = JSON.parse(presc.medications) as Medication[];
            } catch {
              meds = [];
            }
            return (
              <div
                key={presc.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    <span className="text-xs font-bold text-slate-600">
                      {format(parseISO(presc.createdAt), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Dr. {doctorNames[presc.doctorId] ?? 'Médico'}
                    </span>
                    {presc.status === 'SIGNED' && (
                      <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                        ASSINADA DIGITALMENTE
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {meds.map((m, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm"
                    >
                      <p className="text-sm font-bold text-slate-900">
                        {m.name} - {m.dosage}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">{m.frequency}</p>
                      {m.instructions && (
                        <p className="text-[10px] text-slate-500 italic mt-1">
                          Obs: {m.instructions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {presc.status === 'SIGNED' && presc.signedHash && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[8px] font-mono text-slate-400">
                    <span>Hash de Verificação: {presc.signedHash}</span>
                    <span>
                      Data:{' '}
                      {presc.signatureDate
                        ? format(parseISO(presc.signatureDate), 'dd/MM/yyyy HH:mm')
                        : '—'}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {onPrint && (
        <button
          type="button"
          className="w-full mt-4 py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-emerald-200 hover:text-emerald-500 transition-colors"
          onClick={onPrint}
        >
          IMPRIMIR RECEITAS
        </button>
      )}
    </section>
  );
}
