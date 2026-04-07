import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppointmentsMe } from '../use-appointments-me';
import * as api from '@/lib/doctor-dashboard-api';

jest.mock('@/lib/doctor-dashboard-api');

const mocked = api as jest.Mocked<typeof api>;

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useAppointmentsMe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna lista de appointments do médico/paciente', async () => {
    mocked.fetchAppointmentsMe.mockResolvedValue([
      { id: 1, status: 'CONFIRMED' },
      { id: 2, status: 'CONFIRMED' },
    ]);

    const { result } = renderHook(() => useAppointmentsMe(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('respeita enabled:false não chamando o endpoint', async () => {
    const { result } = renderHook(() => useAppointmentsMe({ enabled: false }), { wrapper });

    // não dispara a chamada
    expect(mocked.fetchAppointmentsMe).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
