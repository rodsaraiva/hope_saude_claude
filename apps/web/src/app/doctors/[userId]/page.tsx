'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, Stethoscope, User, Mail, Hash } from 'lucide-react';
import DoctorBookingModal from '@/components/DoctorBookingModal';
import ProfileAvatar from '@/components/ProfileAvatar';
import PatientSetupModal from '@/components/PatientSetupModal';
import PaymentModal from '@/components/PaymentModal';
import { useDoctorDetail } from '@/lib/query/use-doctors';

export default function PublicDoctorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userIdParam = typeof params?.userId === 'string' ? params.userId : '';
  const doctorUserId = useMemo(() => {
    const uid = parseInt(userIdParam, 10);
    return Number.isNaN(uid) ? null : uid;
  }, [userIdParam]);

  const [authorized, setAuthorized] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bookMsg, setBookMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Guarda de auth client-side (só PATIENT pode acessar esta página)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'PATIENT') {
        router.replace('/');
        return;
      }
      setAuthorized(true);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  const {
    data: doctor,
    isLoading: doctorLoading,
    isError: doctorError,
  } = useDoctorDetail(authorized ? doctorUserId : null);

  const loading = !authorized || doctorLoading;
  const notFound = (authorized && doctorUserId === null) || doctorError;

  const slots = useMemo(() => {
    if (!doctor?.availability) return [];
    try {
      const parsed = JSON.parse(doctor.availability) as Array<{
        day: string;
        start: string;
        end: string;
      }>;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [doctor?.availability]);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentContext, setPaymentContext] = useState<{
    doctorUserId: number;
    dateIso: string;
    consultationModelId?: number;
  } | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<{
    doctorUserId: number;
    dateIso: string;
    consultationModelId?: number;
  } | null>(null);

  const handleBook = async (
    doctorUserId: number,
    dateIso: string,
    consultationModelId?: number,
  ) => {
    setBookMsg(null);
    setModalOpen(false);
    setPaymentContext({ doctorUserId, dateIso, consultationModelId });
    setPaymentModalOpen(true);
  };

  const handleSetupSuccess = () => {
    setSetupModalOpen(false);
    if (pendingBooking) {
      setPaymentContext(pendingBooking);
      setPaymentModalOpen(true);
      setPendingBooking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Carregando perfil…
      </div>
    );
  }

  if (notFound || !doctor) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Médico não encontrado</h1>
        <p className="mt-2 text-slate-600">
          Não foi possível localizar este especialista. Verifique o link ou volte à lista.
        </p>
        <Link
          href="/dashboard/patient/doctors"
          className="mt-6 inline-block text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          ← Voltar à lista de especialistas
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16 pt-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-600">Perfil do especialista</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Dr. {doctor.user?.name || 'Médico'}
            </h1>
          </div>
          <Link
            href="/dashboard/patient/doctors"
            className="text-sm font-semibold text-sky-600 hover:text-sky-700"
          >
            ← Voltar à lista
          </Link>
        </div>

        {bookMsg && (
          <div
            className={
              bookMsg.type === 'success'
                ? 'mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
                : 'mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900'
            }
            role="status"
          >
            {bookMsg.text}
          </div>
        )}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm lg:w-72">
            <ProfileAvatar
              userId={doctor.userId}
              displayName={doctor.user?.name || 'Médico'}
              size="lg"
              readOnly={true}
            />
            <div className="text-center">
              <p className="text-xl font-semibold text-slate-900">
                Dr. {doctor.user?.name || 'Médico'}
              </p>
              <p className="mt-1 inline-flex rounded-full bg-sky-50 px-3 py-0.5 text-xs font-medium text-sky-800">
                Especialista
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-8">
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
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      E-mail
                    </dt>
                    <dd className="text-slate-900">{doctor.user?.email || '—'}</dd>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
                  <Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Especialidade
                    </dt>
                    <dd className="text-slate-900">{doctor.specialty || '—'}</dd>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
                  <Hash className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      CRM
                    </dt>
                    <dd className="text-slate-900">{doctor.crm || '—'}</dd>
                  </div>
                </div>
                {doctor.bio?.trim() && (
                  <div className="rounded-xl bg-slate-50/80 px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Biografia
                    </dt>
                    <dd className="mt-1 text-sm text-slate-800">{doctor.bio}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              aria-labelledby="disponibilidade-public-heading"
            >
              <h2
                id="disponibilidade-public-heading"
                className="flex items-center gap-2 text-lg font-semibold text-slate-900"
              >
                <Calendar className="h-5 w-5 text-sky-600" aria-hidden />
                Disponibilidade
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Horários em que o especialista costuma atender (agende pelo botão abaixo).
              </p>
              {slots.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500">
                  Nenhum horário cadastrado no momento.
                </p>
              ) : (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {slots.map((slot, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-slate-900">{slot.day}</span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {slot.start} – {slot.end}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              aria-labelledby="agenda-heading"
            >
              <h2 id="agenda-heading" className="text-lg font-semibold text-slate-900">
                Agendar consulta
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Escolha um horário disponível na agenda para enviar sua solicitação.
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                <Calendar className="h-4 w-4" aria-hidden />
                Ver horários e agendar
              </button>
            </section>
          </div>
        </div>
      </div>

      {modalOpen && (
        <DoctorBookingModal
          doctor={doctor}
          onClose={() => setModalOpen(false)}
          onBook={handleBook}
        />
      )}

      {setupModalOpen && (
        <PatientSetupModal
          onClose={() => setSetupModalOpen(false)}
          onSuccess={handleSetupSuccess}
        />
      )}

      {paymentModalOpen && paymentContext && (
        <PaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentContext(null);
          }}
          doctorUserId={paymentContext.doctorUserId}
          dateIso={paymentContext.dateIso}
          consultationModelId={paymentContext.consultationModelId}
          onMissingProfile={() => {
            setPaymentModalOpen(false);
            setPendingBooking({
              doctorUserId: paymentContext.doctorUserId,
              dateIso: paymentContext.dateIso,
              consultationModelId: paymentContext.consultationModelId,
            });
            setSetupModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
