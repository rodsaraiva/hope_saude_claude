import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from './query-keys';

export interface AuthMeUser {
  id: number;
  email: string;
  name: string;
  role: 'DOCTOR' | 'PATIENT' | string;
}

/**
 * Dados da conta autenticada (GET /auth/me).
 * Encapsula a lógica de "usuário corrente" — é a fonte de verdade
 * para role/id no frontend. Desabilitado até o token estar disponível.
 */
export function useAuthMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['auth', 'me'] as const,
    queryFn: () => api.get<AuthMeUser>('/auth/me'),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}
