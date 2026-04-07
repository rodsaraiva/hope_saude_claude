/**
 * Catálogo central de query keys.
 * Centralizar evita typos e facilita invalidação cruzada.
 */
export const queryKeys = {
  profile: {
    me: ['profile', 'me'] as const,
  },
  appointments: {
    me: ['appointments', 'me'] as const,
  },
  doctors: {
    list: (specialty?: string) => ['doctors', 'list', { specialty }] as const,
    detail: (userId: number) => ['doctors', 'detail', userId] as const,
    availableSlots: (userId: number, from: string, to: string, tz: string, dur?: number) =>
      ['doctors', 'slots', userId, from, to, tz, dur] as const,
  },
  medicalRecords: {
    byPatient: (patientId: number) => ['medical-records', 'by-patient', patientId] as const,
  },
  prescriptions: {
    byPatient: (patientId: number) => ['prescriptions', 'by-patient', patientId] as const,
  },
} as const;
