'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CreditCard,
  Shield,
  Sparkles,
  UserCircle2,
  Video,
} from 'lucide-react';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role);
      } catch (e) {
        setIsLoggedIn(false);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(14,165,233,0.18),transparent)]"
            aria-hidden
          />
          <div className="mx-auto max-w-6xl text-center md:text-left">
            <p className="mb-4 inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800">
              Telepsiquiatria com privacidade e cuidado humano
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1] md:mx-0">
              Cuidado mental à distância,{' '}
              <span className="bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent">
                com a mesma seriedade do consultório
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:mx-0">
              Agende consultas com psiquiatras credenciados, realize videochamadas seguras e pague de
              forma simples — tudo em um só lugar, pensado para pacientes e profissionais.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              {isLoggedIn ? (
                <Link
                  href={userRole === 'DOCTOR' ? '/dashboard/doctor' : '/dashboard/patient'}
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-700"
                >
                  Acessar meu painel de controle
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-sky-600/20 transition hover:bg-sky-700"
                  >
                    Começar agora
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-800 transition hover:border-sky-300 hover:text-sky-800"
                  >
                    Já tenho conta
                  </Link>
                </>
              )}
            </div>
            <ul className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-500 md:justify-start">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
                Atendimento 100% online
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
                Perfis para paciente e médico
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
                Pagamento integrado à consulta
              </li>
            </ul>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
              Por que usar a Hope Saúde?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
              Uma plataforma focada em saúde mental: menos atrito no agendamento, mais tempo para o
              que importa — você e seu bem-estar.
            </p>
            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Consultas por vídeo',
                  desc: 'Sala de videochamada integrada à plataforma, para você não precisar de apps extras para a consulta.',
                  Icon: Video,
                },
                {
                  title: 'Agenda do médico',
                  desc: 'Profissionais definem disponibilidade; pacientes escolhem horários de forma clara e organizada.',
                  Icon: CalendarDays,
                },
                {
                  title: 'Pagamento na plataforma',
                  desc: 'Fluxo de pagamento associado à consulta, com transparência para paciente e médico.',
                  Icon: CreditCard,
                },
                {
                  title: 'Acesso por perfil',
                  desc: 'Experiências distintas para quem busca atendimento e para quem oferece o cuidado especializado.',
                  Icon: UserCircle2,
                },
                {
                  title: 'Privacidade em primeiro lugar',
                  desc: 'Desenho pensado para dados sensíveis de saúde, com boas práticas de segurança e conformidade.',
                  Icon: Shield,
                },
                {
                  title: 'Evolução contínua',
                  desc: 'Base preparada para novas funcionalidades: prontuário, mensagens e integrações futuras.',
                  Icon: Sparkles,
                },
              ].map(({ title, desc, Icon }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-100 bg-[#f8fafc] p-6 shadow-sm transition hover:border-sky-100 hover:shadow-md"
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-3xl bg-gradient-to-br from-sky-600 via-sky-700 to-teal-700 px-6 py-14 text-center shadow-xl sm:px-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Pronto para dar o próximo passo no seu cuidado?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sky-100">
              Crie sua conta em poucos minutos. Se você é médico, cadastre-se para disponibilizar
              horários e atender com segurança.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex rounded-full bg-white px-6 py-3 text-base font-semibold text-sky-700 shadow-lg transition hover:bg-sky-50"
              >
                Cadastrar-me
              </Link>
              <Link
                href="/login"
                className="inline-flex rounded-full border-2 border-white/40 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Acessar conta
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              H
            </span>
            <span className="text-sm font-semibold text-slate-900">Hope Saúde</span>
          </div>
          <p className="text-center text-xs text-slate-500 sm:text-left">
            Plataforma de telepsiquiatria. O acompanhamento médico não substitui emergências — em
            crise, procure serviços de urgência ou CVV (188).
          </p>
          <div className="flex gap-6 text-xs font-medium text-slate-500">
            <Link href="/login" className="hover:text-sky-600">
              Entrar
            </Link>
            <Link href="/register" className="hover:text-sky-600">
              Cadastro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
