'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Stethoscope, Hash, FileText, Loader2 } from 'lucide-react';
import { AuthFormShell } from '@/components/layout/AuthFormShell';
import { validateDoctorSetupFields } from '@/lib/setup-validation';
import { postDoctorSetup } from '@/lib/profile-setup-api';

export default function DoctorSetupPage() {
  const [specialty, setSpecialty] = useState('');
  const [crm, setCrm] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateDoctorSetupFields(specialty, crm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);
    try {
      await postDoctorSetup({
        specialty: specialty.trim(),
        crm: crm.trim(),
        bio: bio.trim() || undefined,
      });
      window.location.href = '/dashboard/doctor';
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Erro ao configurar perfil. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormShell
      title="Configuração"
      titleHighlight="médica"
      subtitle="Complete seus dados para começar a atender pacientes na plataforma."
      footer={
        <p>
          Precisa sair?{' '}
          <Link href="/" className="font-semibold text-sky-600 hover:text-sky-700">
            Voltar ao início
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
          <label htmlFor="setup-specialty" className="text-sm font-semibold text-slate-700">
            Especialidade
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Stethoscope className="h-4 w-4 text-slate-400" aria-hidden />
            </div>
            <input
              id="setup-specialty"
              type="text"
              required
              autoComplete="organization-title"
              placeholder="Ex.: Psiquiatria"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="setup-crm" className="text-sm font-semibold text-slate-700">
            CRM
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Hash className="h-4 w-4 text-slate-400" aria-hidden />
            </div>
            <input
              id="setup-crm"
              type="text"
              required
              placeholder="Número do conselho"
              value={crm}
              onChange={(e) => setCrm(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="setup-bio" className="text-sm font-semibold text-slate-700">
            Biografia <span className="font-normal text-slate-500">(opcional)</span>
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-3">
              <FileText className="h-4 w-4 text-slate-400" aria-hidden />
            </div>
            <textarea
              id="setup-bio"
              rows={4}
              placeholder="Conte um pouco sobre sua experiência e forma de atuar."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
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
