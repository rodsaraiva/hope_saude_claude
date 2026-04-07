'use client';

import ProfileAvatar from '@/components/ProfileAvatar';

interface Props {
  userId: number | null;
  displayName: string;
  roleLabel: string;
}

/**
 * Sidebar de identidade do perfil — avatar, nome e role.
 * Sem state, recebe tudo via props para fácil testabilidade.
 * Quando userId é null (sessão ainda carregando), usa 0 como sentinela —
 * o ProfileAvatar apenas o utiliza para chave de localStorage.
 */
export function ProfileSidebar({ userId, displayName, roleLabel }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm lg:w-72">
      <ProfileAvatar userId={userId ?? 0} displayName={displayName} size="lg" />
      <div className="text-center">
        <p className="text-xl font-semibold text-slate-900">{displayName}</p>
        <p className="mt-1 inline-flex rounded-full bg-sky-50 px-3 py-0.5 text-xs font-medium text-sky-800">
          {roleLabel}
        </p>
      </div>
      <p className="text-center text-xs text-slate-500">
        A foto é salva neste navegador. Para sincronizar em outro dispositivo, enviaremos uma
        atualização futura.
      </p>
    </div>
  );
}
