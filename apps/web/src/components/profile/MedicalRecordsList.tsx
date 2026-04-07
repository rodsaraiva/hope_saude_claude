'use client';

import { FileText, Clock, ShieldCheck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import type { MedicalRecord } from '@/lib/doctor-dashboard-api';

interface Props {
  records: MedicalRecord[];
}

/**
 * Lista de prontuários do paciente em "Meu perfil".
 * Renderiza cada prontuário com autor, data, conteúdo HTML e selo
 * de assinatura digital quando aplicável. Stateless.
 *
 * OBS: `content` é HTML do Tiptap — usamos dangerouslySetInnerHTML.
 * O conteúdo vem do backend já sanitizado via ValidationPipe +
 * decriptado (LGPD).
 */
export function MedicalRecordsList({ records }: Props) {
  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
      aria-labelledby="prontuario-heading"
    >
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2
          id="prontuario-heading"
          className="flex items-center gap-2 text-lg font-semibold text-slate-900"
        >
          <FileText className="h-5 w-5 text-sky-600" aria-hidden />
          Meu Prontuário
        </h2>
      </div>

      <div className="space-y-4">
        {records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <p className="text-sm text-slate-500">Nenhuma evolução registrada ainda.</p>
          </div>
        ) : (
          records.map((record) => (
            <div
              key={record.id}
              className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  <span className="text-xs font-bold text-slate-600">
                    {format(parseISO(record.createdAt), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                    Dr. {record.doctor?.name ?? 'Médico'}
                  </span>
                  {record.status === 'SIGNED' && (
                    <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                      ASSINADO DIGITALMENTE
                    </div>
                  )}
                </div>
              </div>
              <div
                className="prose prose-sm prose-slate max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: record.content }}
              />
              {record.status === 'SIGNED' && record.signedHash && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[8px] font-mono text-slate-400">
                  <span>Hash de Integridade: {record.signedHash}</span>
                  <span>
                    Assinado em:{' '}
                    {record.signatureDate
                      ? format(parseISO(record.signatureDate), 'dd/MM/yyyy HH:mm')
                      : '—'}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <p className="mt-4 text-[10px] text-center text-slate-400 font-medium">
        Apenas você e os médicos com quem você tem consulta podem acessar estes registros.
      </p>
    </section>
  );
}
