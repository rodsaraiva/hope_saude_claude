'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, FileText, History, ShieldCheck, Pill } from 'lucide-react';
import { ProfileSidebar } from '@/components/profile/ProfileSidebar';
import { RegistrationDetails } from '@/components/profile/RegistrationDetails';
import { PrescriptionsList } from '@/components/profile/PrescriptionsList';
import { MedicalRecordsList } from '@/components/profile/MedicalRecordsList';
import { UpcomingAppointmentsCard } from '@/components/profile/UpcomingAppointmentsCard';
import { AppointmentsHistoryCard } from '@/components/profile/AppointmentsHistoryCard';
import { splitAppointmentsByDate } from '@/lib/appointment-helpers';
import { useAuthMe } from '@/lib/query/use-auth-me';
import { useProfileMe } from '@/lib/query/use-profile-me';
import { useAppointmentsMe } from '@/lib/query/use-appointments-me';
import { useMedicalRecords } from '@/lib/query/use-medical-records';
import { usePrescriptions } from '@/lib/query/use-prescriptions';
import { useDoctorsList } from '@/lib/query/use-doctors';
import { useCancelAppointment } from '@/lib/query/use-cancel-appointment';
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
  const cancelAppointment = useCancelAppointment();

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

            {account.role === 'PATIENT' && <MedicalRecordsList records={medicalRecords} />}

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

            <UpcomingAppointmentsCard
              upcoming={upcoming}
              userRole={account.role}
              doctorNames={doctorNames}
              onCancel={(id) => {
                if (window.confirm('Tem certeza que deseja cancelar esta consulta?')) {
                  cancelAppointment.mutate({ id });
                }
              }}
            />

            <AppointmentsHistoryCard
              history={history}
              userRole={account.role}
              doctorNames={doctorNames}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
