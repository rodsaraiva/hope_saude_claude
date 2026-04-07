'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Camera } from 'lucide-react';
import { getStoredAvatarDataUrl, setStoredAvatarDataUrl } from '@/lib/local-avatar';

type Props = {
  userId: number;
  displayName: string;
  size?: 'md' | 'lg';
  readOnly?: boolean;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileAvatar({
  userId,
  displayName,
  size = 'lg',
  readOnly = false,
}: Props) {
  const inputId = useId();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    setSrc(getStoredAvatarDataUrl(userId));
  }, [userId]);

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setStoredAvatarDataUrl(userId, dataUrl);
        setSrc(dataUrl);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [userId],
  );

  const dim = size === 'lg' ? 'h-32 w-32 text-3xl' : 'h-24 w-24 text-2xl';

  return (
    <div className="relative shrink-0">
      <div
        className={`relative overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-sky-100 to-teal-100 shadow-lg ring-2 ring-slate-100 ${dim} flex items-center justify-center font-bold text-sky-800`}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{initialsFromName(displayName)}</span>
        )}
      </div>
      {!readOnly && (
        <>
          <label
            htmlFor={inputId}
            className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-sky-600 text-white shadow-md transition hover:bg-sky-700"
            title="Alterar foto de perfil"
          >
            <Camera className="h-4 w-4" aria-hidden />
            <span className="sr-only">Alterar foto de perfil</span>
          </label>
          <input id={inputId} type="file" accept="image/*" className="sr-only" onChange={onPick} />
        </>
      )}
    </div>
  );
}
