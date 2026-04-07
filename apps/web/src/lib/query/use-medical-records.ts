import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  signMedicalRecord,
  type MedicalRecord,
} from '@/lib/doctor-dashboard-api';
import { queryKeys } from './query-keys';

/**
 * Lista prontuários de um paciente.
 * - Quando `patientId` é null → query desativada (loading state controlado).
 */
export function useMedicalRecords(patientId: number | null) {
  return useQuery({
    queryKey: queryKeys.medicalRecords.byPatient(patientId ?? 0),
    queryFn: () => fetchMedicalRecords(patientId as number),
    enabled: patientId != null,
    staleTime: 15_000,
  });
}

export function useCreateMedicalRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMedicalRecord,
    onSuccess: (record: MedicalRecord) => {
      qc.invalidateQueries({
        queryKey: queryKeys.medicalRecords.byPatient(record.patientId),
      });
    },
  });
}

export function useUpdateMedicalRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content, reason }: { id: number; content: string; reason?: string }) =>
      updateMedicalRecord(id, content, reason),
    onSuccess: (record: MedicalRecord) => {
      qc.invalidateQueries({
        queryKey: queryKeys.medicalRecords.byPatient(record.patientId),
      });
    },
  });
}

export function useSignMedicalRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, authData }: { id: number; authData?: unknown }) =>
      signMedicalRecord(id, authData),
    onSuccess: (record: MedicalRecord) => {
      qc.invalidateQueries({
        queryKey: queryKeys.medicalRecords.byPatient(record.patientId),
      });
    },
  });
}
