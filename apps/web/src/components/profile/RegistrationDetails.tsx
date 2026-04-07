import { User, Mail, FileText, Phone, Stethoscope, Hash } from 'lucide-react';

interface Props {
  name: string;
  email: string;
  userRole: 'DOCTOR' | 'PATIENT' | string;
  phone?: string | null;
  medicalHistory?: string | null;
  specialty?: string | null;
  crm?: string | null;
  bio?: string | null;
  missingExtendedProfile: boolean;
}

/**
 * Bloco "Dados de cadastro" do perfil.
 * Stateless — recebe todos os dados via props. Branches por role.
 */
export function RegistrationDetails({
  name,
  email,
  userRole,
  phone,
  medicalHistory,
  specialty,
  crm,
  bio,
  missingExtendedProfile,
}: Props) {
  const displayOrPlaceholder = (value: string | null | undefined) =>
    value?.trim() ? value : missingExtendedProfile ? '—' : 'Não informado';

  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
      aria-labelledby="cadastro-heading"
    >
      <h2
        id="cadastro-heading"
        className="flex items-center gap-2 text-lg font-semibold text-slate-900"
      >
        <User className="h-5 w-5 text-sky-600" aria-hidden />
        Dados de cadastro
      </h2>
      <dl className="mt-6 space-y-4">
        <div className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">E-mail</dt>
            <dd className="text-slate-900">{email}</dd>
          </div>
        </div>

        <div className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Nome completo
            </dt>
            <dd className="text-slate-900">{name}</dd>
          </div>
        </div>

        {userRole === 'PATIENT' && (
          <>
            <div className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Telefone
                </dt>
                <dd className="text-slate-900">{displayOrPlaceholder(phone)}</dd>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50/80 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Histórico clínico (resumo)
              </dt>
              <dd className="mt-1 text-sm text-slate-800">
                {displayOrPlaceholder(medicalHistory)}
              </dd>
            </div>
          </>
        )}

        {userRole === 'DOCTOR' && (
          <>
            <div className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
              <Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Especialidade
                </dt>
                <dd className="text-slate-900">{specialty ?? '—'}</dd>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
              <Hash className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">CRM</dt>
                <dd className="text-slate-900">{crm ?? '—'}</dd>
              </div>
            </div>
            {bio && (
              <div className="rounded-xl bg-slate-50/80 px-4 py-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Biografia
                </dt>
                <dd className="mt-1 text-sm text-slate-800">{bio}</dd>
              </div>
            )}
          </>
        )}
      </dl>
    </section>
  );
}
