'use client';

import { useState } from 'react';
import Link from 'next/link';
import { User, Mail, Lock, Eye, EyeOff, Loader2, UserPlus, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api-client';
import { persistSessionAndRedirect } from '@/lib/post-auth-redirect';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'PATIENT' | 'DOCTOR'>('PATIENT');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const data = await api.post<any>('/auth/register', {
        name,
        email,
        password,
        role,
      });

      if (data.access_token) {
        persistSessionAndRedirect(data.access_token);
        return;
      }
      setError('Não foi possível completar o cadastro. Verifique os dados.');
    } catch (err: any) {
      if (err.status === 400 && err.data?.message?.includes('email')) {
        setError('Este e-mail já está em uso por outro usuário.');
      } else {
        setError(err.message || 'Erro ao realizar cadastro. Tente novamente mais tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Criar sua <span className="text-sky-600">conta</span>
          </h1>
          <p className="mt-2 text-slate-600">
            Junte-se à Hope Saúde e tenha acesso à melhor telepsiquiatria
          </p>
        </div>

        {/* Register Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
          <form onSubmit={handleRegister} className="p-8 space-y-6">
            {error && (
              <div className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {/* Role Selection */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700">Eu sou um:</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('PATIENT')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    role === 'PATIENT'
                      ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm'
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <UserPlus
                    className={`h-6 w-6 ${role === 'PATIENT' ? 'text-sky-600' : 'text-slate-400'}`}
                  />
                  <span className="text-sm font-bold">Paciente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('DOCTOR')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    role === 'DOCTOR'
                      ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm'
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Stethoscope
                    className={`h-6 w-6 ${role === 'DOCTOR' ? 'text-sky-600' : 'text-slate-400'}`}
                  />
                  <span className="text-sm font-bold">Médico</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Name Field */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="Como deseja ser chamado?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-slate-700">
                  E-mail
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Crie uma senha segura
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-sky-600 py-3 text-sm font-bold text-white transition-all hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:opacity-70"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Criar minha conta'}
            </button>
          </form>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-6 text-center">
            <p className="text-sm text-slate-600">
              Já possui uma conta?{' '}
              <Link href="/login" className="font-bold text-sky-600 hover:text-sky-700">
                Fazer login
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Ao se cadastrar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
