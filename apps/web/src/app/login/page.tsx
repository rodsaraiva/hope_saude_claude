'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api-client';
import { persistSessionAndRedirect } from '@/lib/post-auth-redirect';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const data = await api.post<any>('/auth/login', { email, password });
      
      if (data.access_token) {
        persistSessionAndRedirect(data.access_token);
        return;
      } else {
        setError('Falha na autenticação. Verifique suas credenciais.');
      }
    } catch (err: any) {
      if (err.status === 401) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err.message || 'Erro ao conectar com o servidor. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Hope <span className="text-sky-600">Saúde</span>
          </h1>
          <p className="mt-2 text-slate-600">Acesse sua conta para continuar</p>
        </div>

        {/* Login Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {error && (
              <div className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="space-y-4">
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
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                    Senha
                  </label>
                  <p className="text-xs text-slate-500" id="login-forgot-hint">
                    Esqueceu a senha?{' '}
                    <span className="text-slate-400">Recuperação em breve pelo suporte.</span>
                  </p>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
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
              className="group relative flex w-full items-center justify-center rounded-xl bg-sky-600 py-3 text-sm font-bold text-white transition-all hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/20 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Footer Card */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-6 text-center">
            <p className="text-sm text-slate-600">
              Ainda não tem uma conta?{' '}
              <Link href="/register" className="font-bold text-sky-600 hover:text-sky-700">
                Cadastre-se gratuitamente
              </Link>
            </p>
          </div>
        </div>

        {/* Safety Notice */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Protegido por criptografia de ponta a ponta. <br />
          &copy; 2026 Hope Saúde. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
