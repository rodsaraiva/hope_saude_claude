import React from 'react';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCancelAppointment, useRescheduleAppointment } from '../use-cancel-appointment';
import * as api from '@/lib/doctor-dashboard-api';

jest.mock('@/lib/doctor-dashboard-api');
const mocked = api as jest.Mocked<typeof api>;

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

describe('useCancelAppointment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancela e invalida a lista de consultas', async () => {
    const { client, wrapper } = makeWrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    mocked.cancelAppointment.mockResolvedValue({ id: 1, status: 'CANCELLED' } as any);

    const { result } = renderHook(() => useCancelAppointment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 1, reason: 'desisti' });
    });

    expect(mocked.cancelAppointment).toHaveBeenCalledWith(1, 'desisti');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['appointments', 'me'] });
  });
});

describe('useRescheduleAppointment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reagenda e invalida a lista de consultas', async () => {
    const { client, wrapper } = makeWrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    mocked.rescheduleAppointment.mockResolvedValue({ id: 2, status: 'CONFIRMED' } as any);

    const { result } = renderHook(() => useRescheduleAppointment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 1, newDate: '2026-07-01T10:00:00.000Z' });
    });

    expect(mocked.rescheduleAppointment).toHaveBeenCalledWith(1, '2026-07-01T10:00:00.000Z');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['appointments', 'me'] });
  });
});
