const key = (userId: number) => `hope_avatar_${userId}`;

export function getStoredAvatarDataUrl(userId: number): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key(userId));
}

export function setStoredAvatarDataUrl(userId: number, dataUrl: string | null): void {
  if (typeof window === 'undefined') return;
  if (dataUrl === null) localStorage.removeItem(key(userId));
  else localStorage.setItem(key(userId), dataUrl);
}
