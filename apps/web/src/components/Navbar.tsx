'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const syncAuth = () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setIsLoggedIn(true);
          setUserRole(payload.role);
        } catch {
          setIsLoggedIn(false);
          setUserRole(null);
        }
      } else {
        setIsLoggedIn(false);
        setUserRole(null);
      }
    };

    syncAuth();
    window.addEventListener('storage', syncAuth);
    return () => window.removeEventListener('storage', syncAuth);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 text-lg font-bold text-white shadow-sm"
            aria-hidden
          >
            H
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Hope Saúde
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-4" aria-label="Principal">
          {isLoggedIn ? (
            <>
              {userRole === 'PATIENT' && (
                <Link
                  href="/dashboard/patient/doctors"
                  className="text-sm font-semibold text-sky-600 transition hover:text-sky-700"
                >
                  Agendar
                </Link>
              )}
              <Link
                href="/profile"
                className="text-sm font-semibold text-sky-600 transition hover:text-sky-700"
              >
                Meu perfil
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-slate-600 transition hover:text-sky-700 sm:inline"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
