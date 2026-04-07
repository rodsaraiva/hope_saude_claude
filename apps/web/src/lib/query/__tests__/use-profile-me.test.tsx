import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfileMe } from '../use-profile-me';
import * as api from '@/lib/doctor-dashboard-api';

jest.mock('@/lib/doctor-dashboard-api');

const mocked = api as jest.Mocked<typeof api>;

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useProfileMe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna data com perfil quando getProfileMeSafe responde com sucesso', async () => {
    mocked.getProfileMeSafe.mockResolvedValue({ profile: { id: 1, name: 'Dr X' } });

    const { result } = renderHook(() => useProfileMe(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ profile: { id: 1, name: 'Dr X' } });
  });

  it('retorna data com notFound:true quando perfil não existe', async () => {
    mocked.getProfileMeSafe.mockResolvedValue({ notFound: true });

    const { result } = renderHook(() => useProfileMe(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ notFound: true });
  });

  it('expõe error quando a chamada lança', async () => {
    mocked.getProfileMeSafe.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useProfileMe(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('boom');
  });
});
