import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMedicalRecords,
  useCreateMedicalRecord,
  useUpdateMedicalRecord,
  useSignMedicalRecord,
} from '../use-medical-records';
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

describe('useMedicalRecords', () => {
  beforeEach(() => jest.clearAllMocks());

  it('desabilita query quando patientId é null', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMedicalRecords(null), { wrapper });
    expect(mocked.fetchMedicalRecords).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('busca prontuários quando patientId é fornecido', async () => {
    mocked.fetchMedicalRecords.mockResolvedValue([
      { id: 1, content: 'a' } as any,
      { id: 2, content: 'b' } as any,
    ]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMedicalRecords(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocked.fetchMedicalRecords).toHaveBeenCalledWith(5);
    expect(result.current.data).toHaveLength(2);
  });
});

describe('useCreateMedicalRecord', () => {
  it('invalida a lista do paciente em sucesso', async () => {
    const { client, wrapper } = makeWrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    mocked.createMedicalRecord.mockResolvedValue({
      id: 10,
      patientId: 5,
    } as any);

    const { result } = renderHook(() => useCreateMedicalRecord(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        patientId: 5,
        content: 'texto',
      });
    });

    expect(mocked.createMedicalRecord).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['medical-records', 'by-patient', 5],
    });
  });
});

describe('useUpdateMedicalRecord', () => {
  it('passa id/content/reason e invalida cache', async () => {
    const { client, wrapper } = makeWrapper();
    const spy = jest.spyOn(client, 'invalidateQueries');
    mocked.updateMedicalRecord.mockResolvedValue({ id: 1, patientId: 7 } as any);

    const { result } = renderHook(() => useUpdateMedicalRecord(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, content: 'new', reason: 'typo' });
    });

    expect(mocked.updateMedicalRecord).toHaveBeenCalledWith(1, 'new', 'typo');
    expect(spy).toHaveBeenCalledWith({
      queryKey: ['medical-records', 'by-patient', 7],
    });
  });
});

describe('useSignMedicalRecord', () => {
  it('assina e invalida cache', async () => {
    const { wrapper } = makeWrapper();
    mocked.signMedicalRecord.mockResolvedValue({ id: 1, patientId: 9 } as any);

    const { result } = renderHook(() => useSignMedicalRecord(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, authData: { code: 'x' } });
    });

    expect(mocked.signMedicalRecord).toHaveBeenCalledWith(1, { code: 'x' });
  });
});
