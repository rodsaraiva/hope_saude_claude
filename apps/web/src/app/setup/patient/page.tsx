'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CreditCard, Phone, FileText, Loader2 } from 'lucide-react';
import { AuthFormShell } from '@/components/layout/AuthFormShell';
import { formatCpf, digitsOnlyCpf } from '@/lib/cpf-format';
import { validatePatientCpfDigits, validatePatientPhone } from '@/lib/setup-validation';
import { postPatientSetup } from '@/lib/profile-setup-api';

export default function PatientSetupPage() {
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = digitsOnlyCpf(cpf);
    const cpfErr = validatePatientCpfDigits(rawCpf);
    if (cpfErr) {
      setError(cpfErr);
      return;
    }
    const phoneErr = validatePatientPhone(phone);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    setError('');
    setLoading(true);
    try {
      await postPatientSetup({
        cpf: rawCpf,
        phone: phone.trim(),
        medicalHistory: medicalHistory.trim() || undefined,
      });
      window.location.href = '/profile';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar perfil. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormShell
      title="Seu"
      titleHighlight="cadastro"
      subtitle="Precisamos do CPF e do celular para pagamentos e confirmação de consultas."
      footer={
        <p>
          Já concluiu?{' '}
          <Link href="/profile" className="font-semibold text-sky-600 hover:text-sky-700">
            Ir para o perfil
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-8" noValidate>
        {error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="patient-cpf" className="text-sm font-semibold text-slate-700">
            CPF
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CreditCard className="h-4 w-4 text-slate-400" aria-hidden />
            </div>
            <input
              id="patient-cpf"
              type="text"
              required
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="patient-phone" className="text-sm font-semibold text-slate-700">
            Celular
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Phone className="h-4 w-4 text-slate-400" aria-hidden />
            </div>
            <input
              id="patient-phone"
              type="tel"
              required
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
              autoComplete="tel"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="patient-history" className="text-sm font-semibold text-slate-700">
            Histórico médico <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-3">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden />
            </div>
            <textarea
              id="patient-history"
              rows={3}
              placeholder="Informações que ajudem o especialista no primeiro atendimento."
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
              className="block w-full resize-y rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-sky-600 py-3 text-sm font-bold text-white transition-all hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : 'Finalizar setup'}
        </button>
      </form>
    </AuthFormShell>
  );
}
