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
  },
} as const;
