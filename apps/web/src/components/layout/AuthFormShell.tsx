import type { ReactNode } from 'react';

export type AuthFormShellProps = {
  title: string;
  titleHighlight?: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Layout compartilhado para login, cadastro e telas de setup (SRP + reutilização).
 */
export function AuthFormShell({ title, titleHighlight, subtitle, children, footer }: AuthFormShellProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {title}
            {titleHighlight != null && titleHighlight !== '' && (
              <>
                {' '}
                <span className="text-sky-600">{titleHighlight}</span>
              </>
            )}
          </h1>
          <p className="mt-2 text-slate-600">{subtitle}</p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
          {children}
          {footer != null && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-6 text-center text-sm text-slate-600">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
