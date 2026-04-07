import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDoctorsList, useDoctorDetail, useDoctorAvailableSlots } from '../use-doctors';
import * as doctorsApi from '@/lib/doctors-api';
import * as bookingApi from '@/lib/patient-booking-api';

jest.mock('@/lib/doctors-api');
jest.mock('@/lib/patient-booking-api');

const mockedDoctors = doctorsApi as jest.Mocked<typeof doctorsApi>;
const mockedBooking = bookingApi as jest.Mocked<typeof bookingApi>;

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useDoctorsList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busca sem filtro de especialidade', async () => {
    mockedDoctors.fetchDoctors.mockResolvedValue([]);
    const { result } = renderHook(() => useDoctorsList(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDoctors.fetchDoctors).toHaveBeenCalledWith(undefined);
  });

  it('busca com filtro de especialidade', async () => {
    mockedDoctors.fetchDoctors.mockResolvedValue([]);
    const { result } = renderHook(() => useDoctorsList('Psiquiatria'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDoctors.fetchDoctors).toHaveBeenCalledWith('Psiquiatria');
  });
});

describe('useDoctorDetail', () => {
  it('desabilita quando userId é null', () => {
    renderHook(() => useDoctorDetail(null), { wrapper });
    expect(mockedDoctors.fetchDoctorByUserId).not.toHaveBeenCalled();
  });

  it('busca detalhe quando userId é fornecido', async () => {
    mockedDoctors.fetchDoctorByUserId.mockResolvedValue({ id: 1, userId: 42 } as any);
    const { result } = renderHook(() => useDoctorDetail(42), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedDoctors.fetchDoctorByUserId).toHaveBeenCalledWith(42);
  });
});

describe('useDoctorAvailableSlots', () => {
  beforeEach(() => jest.clearAllMocks());

  it('desabilita quando userId/from/to estão ausentes', () => {
    renderHook(
      () =>
        useDoctorAvailableSlots({
          userId: null,
          from: '',
          to: '',
          timeZone: 'America/Sao_Paulo',
        }),
      { wrapper },
    );
    expect(mockedBooking.fetchDoctorAvailableSlots).not.toHaveBeenCalled();
  });

  it('dispara a chamada com os argumentos corretos', async () => {
    mockedBooking.fetchDoctorAvailableSlots.mockResolvedValue({
      timeZone: 'America/Sao_Paulo',
      slots: [],
    });
    const { result } = renderHook(
      () =>
        useDoctorAvailableSlots({
          userId: 7,
          from: '2026-04-10T00:00:00Z',
          to: '2026-04-20T00:00:00Z',
          timeZone: 'America/Sao_Paulo',
          durationMinutes: 45,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedBooking.fetchDoctorAvailableSlots).toHaveBeenCalledWith(
      7,
      '2026-04-10T00:00:00Z',
      '2026-04-20T00:00:00Z',
      45,
    );
  });
});
