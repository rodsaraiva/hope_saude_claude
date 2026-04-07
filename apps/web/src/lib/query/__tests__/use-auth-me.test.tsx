import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthMe } from '../use-auth-me';
import { api } from '@/lib/api-client';

jest.mock('@/lib/api-client');
const mocked = api as jest.Mocked<typeof api>;

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useAuthMe', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busca /auth/me e retorna o usuário', async () => {
    mocked.get.mockResolvedValue({
      id: 5,
      email: 'u@x.com',
      name: 'U',
      role: 'PATIENT',
    });
    const { result } = renderHook(() => useAuthMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocked.get).toHaveBeenCalledWith('/auth/me');
    expect(result.current.data?.id).toBe(5);
  });

  it('desabilita quando enabled:false', () => {
    renderHook(() => useAuthMe({ enabled: false }), { wrapper });
    expect(mocked.get).not.toHaveBeenCalled();
  });

  it('expõe erro quando a API falha', async () => {
    mocked.get.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useAuthMe(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
