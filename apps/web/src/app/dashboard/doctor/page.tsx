'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import {
  getProfileMeSafe,
  fetchAppointmentsMe,
} from '@/lib/doctor-dashboard-api';

export default function DoctorDashboard() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [appointments, setAppointments] = useState<Array<Record<string, unknown>>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadError(null);
      try {
        const profResult = await getProfileMeSafe() as any;
        if (cancelled) return;
        if (profResult.notFound) {
          window.location.href = '/setup/doctor';
          return;
        }

        const prof = profResult.profile as Record<string, unknown>;
        setProfile(prof);

        const apptsRaw = await fetchAppointmentsMe();
        if (cancelled) return;
        const appts = Array.isArray(apptsRaw) ? apptsRaw : [];
        setAppointments(appts as Array<Record<string, unknown>>);
      } catch {
        if (!cancelled) {
          setLoadError('Não foi possível carregar o painel. Verifique sua conexão e tente novamente.');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduled = useMemo(() => {
    return [...appointments]
      .filter((a) => a.status === 'CONFIRMED')
      .sort((a, b) => new Date(String(a.date)).getTime() - new Date(String(b.date)).getTime());
  }, [appointments]);

  if (!profile && !loadError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-slate-600">
        <Loader2 className="h-10 w-10 animate-spin text-sky-600" aria-hidden />
        <p className="text-sm font-medium">Carregando painel…</p>
      </div>
    );
  }

  if (loadError && !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-800" role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  const userName =
    (profile as { user?: { name?: string } })?.user?.name || 'Médico';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {loadError ? (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
          aria-live="polite"
        >
          {loadError}
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-sky-600">Área do especialista</p>
            <h1 className="text-2xl font-bold text-slate-900">Painel do médico</h1>
            <p className="mt-1 text-slate-600">Bem-vindo, Dr. {userName}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                <Calendar className="h-5 w-5 text-sky-600" aria-hidden />
                Próximas Consultas
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {scheduled.length > 0 ? (
                  scheduled.slice(0, 4).map((appt) => (
                    <div
                      key={appt.id as number}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Confirmada
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          ID: #{appt.id as number}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {new Date(String(appt.date)).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                      <p className="text-xs font-medium text-slate-600">
                        Horário: {new Date(String(appt.date)).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <div className="mt-4">
                        <a
                          href={`/video/${appt.id as number}`}
                          className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 py-2 text-xs font-bold text-white transition hover:bg-sky-700"
                        >
                          Entrar na Chamada
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="sm:col-span-2 py-12 text-center">
                    <p className="text-sm italic text-slate-500">Nenhuma consulta agendada para os próximos dias.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Resumo da Semana</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Consultas realizadas</span>
                    <span className="font-bold text-slate-900">0</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">Agendamentos para hoje</span>
                    <span className="font-bold text-slate-900">
                      {scheduled.filter(a => {
                        const d = new Date(String(a.date));
                        const today = new Date();
                        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
                      }).length}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Configurações Rápidas</h3>
                <Link 
                  href="/agenda"
                  className="w-full text-left text-sm text-sky-600 hover:text-sky-700 font-medium"
                >
                  Gerenciar horários disponíveis →
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
                <Clock className="h-5 w-5 text-emerald-600" aria-hidden />
                Histórico Recente
              </h2>
              <div className="space-y-3">
                {scheduled.length > 4 ? (
                  scheduled.slice(4, 10).map((appt) => (
                    <div
                      key={appt.id as number}
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {new Date(String(appt.date)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Finalizada</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic text-slate-500">Sem histórico adicional.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
