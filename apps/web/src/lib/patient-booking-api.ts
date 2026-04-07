import { api } from '@/lib/api-client';

export type AvailableSlotsResponse = {
  timeZone: string;
  slots: { start: string; end: string }[];
};

export async function fetchDoctorAvailableSlots(
  doctorUserId: number,
  fromIso: string,
  toIso: string,
  durationMinutes?: number,
): Promise<AvailableSlotsResponse> {
  const params: Record<string, any> = { from: fromIso, to: toIso };
  if (durationMinutes) params.durationMinutes = durationMinutes;

  return api.get<AvailableSlotsResponse>(`/profile/doctors/${doctorUserId}/available-slots`, {
    params,
  });
}
