import { useQuery } from '@tanstack/react-query';
import { getProfileMeSafe } from '@/lib/doctor-dashboard-api';
import { queryKeys } from './query-keys';

/**
 * Hook reativo para o perfil do usuário autenticado.
 * Encapsula getProfileMeSafe() (que distingue 404 de erros reais).
 */
export function useProfileMe() {
  return useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: () => getProfileMeSafe(),
    staleTime: 30_000,
  });
}
