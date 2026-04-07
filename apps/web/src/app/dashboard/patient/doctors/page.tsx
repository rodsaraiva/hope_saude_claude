'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Stethoscope, Calendar } from 'lucide-react';
import DoctorBookingModal from '@/components/DoctorBookingModal';
import PatientSetupModal from '@/components/PatientSetupModal';
import PaymentModal from '@/components/PaymentModal';
import { useDoctorsList } from '@/lib/query/use-doctors';
import type { PublicDoctor } from '@/lib/doctors-api';

type DoctorRow = PublicDoctor;

export default function PatientDoctorsListPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [query, setQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [selected, setSelected] = useState<DoctorRow | null>(null);
  const [bookMsg, setBookMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  // Guarda de auth — só PATIENT
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

  const { data: doctors = [], isLoading } = useDoctorsList(
    authorized ? specialtyFilter || undefined : undefined,
  );
  const loading = !authorized || isLoading;

  const specialties = useMemo(() => {
    const s = new Set<string>();
    doctors.forEach((d) => {
      if (d.specialty) s.add(d.specialty);
    });
    return Array.from(s).sort();
  }, [doctors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors.filter((d) => {
      if (specialtyFilter && d.specialty !== specialtyFilter) return false;
      if (!q) return true;
      const name = (d.user?.name || '').toLowerCase();
      const spec = (d.specialty || '').toLowerCase();
      return name.includes(q) || spec.includes(q);
    });
  }, [doctors, query, specialtyFilter]);

  const handleBook = async (
    doctorUserId: number,
    dateIso: string,
    consultationModelId?: number,
  ) => {
    setBookMsg(null);
    setSelected(null);
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
        Carregando especialistas…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-sky-600">Agendamento</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Escolha seu especialista
          </h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Veja a lista de médicos disponíveis, filtre por nome ou especialidade e escolha com quem
            deseja marcar sua consulta.
          </p>
        </div>
        <Link href="/profile" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
          ← Voltar ao perfil
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

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar por nome ou especialidade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none ring-sky-500 focus:border-sky-400 focus:ring-2"
            aria-label="Buscar médico"
          />
        </div>
        <div className="flex items-center gap-2 sm:w-64">
          <label htmlFor="spec-filter" className="sr-only">
            Filtrar por especialidade
          </label>
          <select
            id="spec-filter"
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Todas as especialidades</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <Stethoscope className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 font-medium text-slate-700">Nenhum médico encontrado</p>
          <p className="mt-1 text-sm text-slate-500">
            Ajuste a busca ou o filtro de especialidade.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((doctor) => (
            <li key={doctor.id}>
              <article className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:border-sky-100 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Stethoscope className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-slate-900">
                      Dr. {doctor?.user?.name || 'Médico'}
                    </h2>
                    <p className="text-sm text-slate-600">{doctor.specialty}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-1 flex-col justify-end gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {(() => {
                      if (!doctor.availability) return 'Sem horários cadastrados';
                      try {
                        const slots = JSON.parse(doctor.availability) as unknown[];
                        return Array.isArray(slots)
                          ? `${slots.length} horário(s) na agenda`
                          : 'Sem horários cadastrados';
                      } catch {
                        return 'Sem horários cadastrados';
                      }
                    })()}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/doctors/${doctor.userId}`}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ver perfil
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSelected(doctor)}
                      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      Escolher horário
                    </button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <DoctorBookingModal
          doctor={selected}
          onClose={() => setSelected(null)}
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
