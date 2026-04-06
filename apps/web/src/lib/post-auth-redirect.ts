/**
 * Decide para onde enviar o usuário após login ou cadastro com sessão (SRP, testável sem DOM).
 */
export function getPostAuthRedirectPath(accessToken: string): string {
  const payload = JSON.parse(atob(accessToken.split('.')[1])) as { role?: string };
  return payload.role === 'DOCTOR' ? '/dashboard/doctor' : '/';
}

/** Persiste o token e navega para o destino pós-autenticação (browser apenas). */
export function persistSessionAndRedirect(accessToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', accessToken);
  window.location.href = getPostAuthRedirectPath(accessToken);
}
