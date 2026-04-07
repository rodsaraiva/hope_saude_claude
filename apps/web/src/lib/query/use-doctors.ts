import { useQuery } from '@tanstack/react-query';
import { fetchDoctors, fetchDoctorByUserId } from '@/lib/doctors-api';
import { fetchDoctorAvailableSlots } from '@/lib/patient-booking-api';
import { queryKeys } from './query-keys';

export function useDoctorsList(specialty?: string) {
  return useQuery({
    queryKey: queryKeys.doctors.list(specialty),
    queryFn: () => fetchDoctors(specialty),
    staleTime: 60_000,
  });
}

export function useDoctorDetail(userId: number | null) {
  return useQuery({
    queryKey: queryKeys.doctors.detail(userId ?? 0),
    queryFn: () => fetchDoctorByUserId(userId as number),
    enabled: userId != null,
    staleTime: 60_000,
  });
}

export function useDoctorAvailableSlots(params: {
  userId: number | null;
  from: string;
  to: string;
  timeZone: string;
  durationMinutes?: number;
  enabled?: boolean;
}) {
  const { userId, from, to, timeZone, durationMinutes, enabled = true } = params;
  return useQuery({
    queryKey: queryKeys.doctors.availableSlots(userId ?? 0, from, to, timeZone, durationMinutes),
    queryFn: () => fetchDoctorAvailableSlots(userId as number, from, to, durationMinutes),
    enabled: enabled && userId != null && !!from && !!to,
    staleTime: 30_000,
  });
}
