import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelAppointment, rescheduleAppointment } from '@/lib/doctor-dashboard-api';
import { queryKeys } from './query-keys';

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => cancelAppointment(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.appointments.me });
    },
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, newDate }: { id: number; newDate: string }) =>
      rescheduleAppointment(id, newDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.appointments.me });
    },
  });
}
