import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePrescriptions, useCreatePrescription, useSignPrescription } from '../use-prescriptions';
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

describe('usePrescriptions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('desabilita quando patientId é null', () => {
    const { wrapper } = makeWrapper();
    renderHook(() => usePrescriptions(null), { wrapper });
    expect(mocked.fetchPrescriptions).not.toHaveBeenCalled();
  });

  it('busca e retorna prescrições', async () => {
    mocked.fetchPrescriptions.mockResolvedValue([{ id: 1, medications: '[]' } as any]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePrescriptions(3), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useCreatePrescription', () => {
  it('cria e invalida cache', async () => {
    const { client, wrapper } = makeWrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    mocked.createPrescription.mockResolvedValue({ id: 5, patientId: 8 } as any);

    const { result } = renderHook(() => useCreatePrescription(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ patientId: 8, medications: '[]' });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['prescriptions', 'by-patient', 8] });
  });
});

describe('useSignPrescription', () => {
  it('assina via id + authData', async () => {
    const { wrapper } = makeWrapper();
    mocked.signPrescription.mockResolvedValue({ id: 5, patientId: 8 } as any);

    const { result } = renderHook(() => useSignPrescription(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 5, authData: { code: 'abc' } });
    });
    expect(mocked.signPrescription).toHaveBeenCalledWith(5, { code: 'abc' });
  });
});
