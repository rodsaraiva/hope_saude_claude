import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPrescriptions,
  createPrescription,
  updatePrescription,
  signPrescription,
  type Prescription,
} from '@/lib/doctor-dashboard-api';
import { queryKeys } from './query-keys';

export function usePrescriptions(patientId: number | null) {
  return useQuery({
    queryKey: queryKeys.prescriptions.byPatient(patientId ?? 0),
    queryFn: () => fetchPrescriptions(patientId as number),
    enabled: patientId != null,
    staleTime: 15_000,
  });
}

export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPrescription,
    onSuccess: (prescription: Prescription) => {
      qc.invalidateQueries({
        queryKey: queryKeys.prescriptions.byPatient(prescription.patientId),
      });
    },
  });
}

export function useUpdatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { medications: string; observations?: string };
    }) => updatePrescription(id, data),
    onSuccess: (prescription: Prescription) => {
      qc.invalidateQueries({
        queryKey: queryKeys.prescriptions.byPatient(prescription.patientId),
      });
    },
  });
}

export function useSignPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, authData }: { id: number; authData?: unknown }) =>
      signPrescription(id, authData),
    onSuccess: (prescription: Prescription) => {
      qc.invalidateQueries({
        queryKey: queryKeys.prescriptions.byPatient(prescription.patientId),
      });
    },
  });
}
