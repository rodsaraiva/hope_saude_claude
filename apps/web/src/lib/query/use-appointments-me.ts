import { useQuery } from '@tanstack/react-query';
import { fetchAppointmentsMe } from '@/lib/doctor-dashboard-api';
import { queryKeys } from './query-keys';

/**
 * Lista de consultas do usuário autenticado (médico ou paciente —
 * o backend resolve a partir do JWT).
 */
export function useAppointmentsMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.appointments.me,
    queryFn: () => fetchAppointmentsMe(),
    enabled: options?.enabled ?? true,
    staleTime: 15_000,
  });
}
