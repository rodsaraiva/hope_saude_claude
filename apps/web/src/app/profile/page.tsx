'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, FileText, History, ShieldCheck, Pill } from 'lucide-react';
import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import { RegistrationDetails } from '@/components/profile/RegistrationDetails';
import { PrescriptionsList } from '@/components/profile/PrescriptionsList';
import { splitAppointmentsByDate } from '@/lib/appointment-helpers';
import { type MedicalRecord, type Prescription } from '@/lib/doctor-dashboard-api';
import { useAuthMe } from '@/lib/query/use-auth-me';
import { useProfileMe } from '@/lib/query/use-profile-me';
import { useAppointmentsMe } from '@/lib/query/use-appointments-me';
import { useMedicalRecords } from '@/lib/query/use-medical-records';
import { usePrescriptions } from '@/lib/query/use-prescriptions';
import { useDoctorsList } from '@/lib/query/use-doctors';
import { format, parseISO } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

type ProfilePayload = {
  id: number;
  userId?: number;
  user?: { name: string; email: string };
  specialty?: string;
  crm?: string;
  bio?: string | null;
  availability?: string | null;
  phone?: string | null;
  medicalHistory?: string | null;
};

export default function UserProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  // 1. Extrai userId do JWT local (não é uma chamada ao servidor)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const p = JSON.parse(atob(token.split('.')[1])) as { sub?: number; role?: string };
      const uid = p.sub ?? 0;
      if (!uid || !p.role) throw new Error('invalid');
      setUserId(uid);
      setTokenReady(true);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  // 2. Queries reativas (só disparam após o token ser validado)
  const { data: account, isLoading: accountLoading } = useAuthMe({ enabled: tokenReady });
  const { data: profileResult, isLoading: profileLoading } = useProfileMe();
  const { data: appointmentsRaw } = useAppointmentsMe({ enabled: tokenReady });
  const isPatient = account?.role === 'PATIENT';
  const { data: medicalRecords = [] } = useMedicalRecords(isPatient ? (account?.id ?? null) : null);
  const { data: prescriptions = [] } = usePrescriptions(isPatient ? (account?.id ?? null) : null);
  const { data: doctors = [] } = useDoctorsList();

  // Normaliza o shape do profile/me (o hook retorna {profile}|{notFound:true})
  const profileExtended: ProfilePayload | null = useMemo(() => {
    if (!profileResult) return null;
    if ('notFound' in profileResult) return null;
    return profileResult.profile as ProfilePayload;
  }, [profileResult]);

  const appointments = useMemo(
    () =>
      (Array.isArray(appointmentsRaw) ? appointmentsRaw : []) as Array<{
        id: number;
        patientId: number;
        doctorId: number;
        date: string;
        status: string;
      }>,
    [appointmentsRaw],
  );

  const doctorNames = useMemo(() => {
    const map: Record<number, string> = {};
    for (const d of doctors as Array<{ userId: number; user?: { name: string } }>) {
      map[d.userId] = d.user?.name ?? 'Médico';
    }
    return map;
  }, [doctors]);

  const loading = accountLoading || profileLoading;

  const { upcoming, history } = useMemo(
    () => splitAppointmentsByDate(appointments),
    [appointments],
  );

  const displayName = (profileExtended?.user?.name || account?.name || '').trim() || 'Usuário';
  const email = profileExtended?.user?.email ?? account?.email ?? '—';

  const availabilitySlots = useMemo(() => {
    if (!profileExtended?.availability) return [];
    try {
      return JSON.parse(profileExtended.availability) as Array<{
        day: string;
        start: string;
        end: string;
      }>;
    } catch {
      return [];
    }
  }, [profileExtended]);

  if (!userId || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-600">
        Carregando perfil…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-slate-800">Sessão inválida ou API indisponível</p>
        <p className="mt-2 text-slate-600">Faça login novamente.</p>
        <Link
          href="/login"
          className="mt-6 inline-block font-semibold text-sky-600 hover:text-sky-700"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  const dashboardHref =
    account.role === 'DOCTOR' ? '/dashboard/doctor' : '/dashboard/patient/doctors';
  const roleLabel = account.role === 'DOCTOR' ? 'Médico' : 'Paciente';
  const missingExtendedProfile = profileExtended === null;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16 pt-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-600">Conta</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Meu perfil</h1>
          </div>
          <Link
            href={dashboardHref}
            className="text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            ← Área de trabalho
          </Link>
        </div>

        {missingExtendedProfile && account.role === 'DOCTOR' && (
          <div
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">Cadastro profissional incompleto</p>
            <p className="mt-1 text-amber-900/90">
              Informe especialidade e CRM para concluir seu perfil e aparecer para os pacientes.
            </p>
            <Link
              href="/setup/doctor"
              className="mt-3 inline-block font-semibold text-amber-900 underline hover:text-amber-950"
            >
              Completar cadastro médico →
            </Link>
          </div>
        )}

        {missingExtendedProfile && account.role === 'PATIENT' && (
          <div
            className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
            role="status"
          >
            <p className="font-medium">Perfil de paciente incompleto</p>
            <p className="mt-1 text-sky-900/90">
              Complete seus dados de contato para facilitar o atendimento.
            </p>
            <Link
              href="/setup/patient"
              className="mt-3 inline-block font-semibold text-sky-800 underline hover:text-sky-950"
            >
              Completar dados do paciente →
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <ProfileSidebar userId={userId} displayName={displayName} roleLabel={roleLabel} />

          <div className="min-w-0 flex-1 space-y-8">
            <RegistrationDetails
              name={account.name}
              email={email}
              userRole={account.role}
              phone={profileExtended?.phone}
              medicalHistory={profileExtended?.medicalHistory}
              specialty={profileExtended?.specialty}
              crm={profileExtended?.crm}
              bio={profileExtended?.bio}
              missingExtendedProfile={missingExtendedProfile}
            />

            {account.role === 'PATIENT' && (
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
                  {/*
                    Busca por content desabilitada após criptografia em repouso (LGPD).
                    Será reativada quando houver índice de busca server-side
                    (Postgres FTS ou hash determinístico via HMAC).
                  */}
                </div>

                <div className="space-y-4">
                  {medicalRecords.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                      <p className="text-sm text-slate-500">Nenhuma evolução registrada ainda.</p>
                    </div>
                  ) : (
                    medicalRecords.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
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
                                <ShieldCheck className="h-2.5 w-2.5" />
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
                              {format(parseISO(record.signatureDate!), 'dd/MM/yyyy HH:mm')}
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
            )}

            {account.role === 'PATIENT' && (
              <PrescriptionsList
                prescriptions={prescriptions}
                doctorNames={doctorNames}
                onPrint={() => window.print()}
              />
            )}

            {account.role === 'DOCTOR' && (
              <section
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
                aria-labelledby="disponibilidade-heading"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="disponibilidade-heading"
                    className="flex items-center gap-2 text-lg font-semibold text-slate-900"
                  >
                    <Calendar className="h-5 w-5 text-sky-600" aria-hidden />
                    Disponibilidade
                  </h2>
                  <Link
                    href="/dashboard/doctor"
                    className="text-sm font-semibold text-sky-600 hover:text-sky-700"
                  >
                    Gerenciar agenda →
                  </Link>
                </div>
                <div className="mt-6">
                  {availabilitySlots.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                      Você ainda não definiu seus horários de atendimento.
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {availabilitySlots.map((slot, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{slot.day}</p>
                            <p className="text-xs text-slate-500">
                              {slot.start} - {slot.end}
                            </p>
                          </div>
                          <Clock className="h-4 w-4 text-slate-300" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

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
                        {account.role === 'PATIENT' && (
                          <p className="text-sm text-slate-600">
                            Com Dr. {doctorNames[appt.doctorId] ?? '—'}
                          </p>
                        )}
                        {account.role === 'DOCTOR' && (
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
                    <span className="text-slate-800">
                      {new Date(appt.date).toLocaleString('pt-BR')}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {account.role === 'PATIENT' && (
                        <span className="text-slate-600">
                          Dr. {doctorNames[appt.doctorId] ?? '—'}
                        </span>
                      )}
                      {account.role === 'DOCTOR' && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
