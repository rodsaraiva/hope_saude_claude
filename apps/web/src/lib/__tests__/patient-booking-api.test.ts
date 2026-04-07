import { fetchDoctorAvailableSlots } from '../patient-booking-api';
import { api } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  api: {
    get: jest.fn(),
  },
}));

describe('patient-booking-api', () => {
  beforeEach(() => {
    jest.mocked(api.get).mockReset();
  });

  it('fetchDoctorAvailableSlots chama GET com query params', async () => {
    const payload = {
      timeZone: 'America/Sao_Paulo',
      slots: [{ start: '2026-04-07T17:00:00.000Z', end: '2026-04-07T18:00:00.000Z' }],
    };
    jest.mocked(api.get).mockResolvedValue(payload);

    const r = await fetchDoctorAvailableSlots(
      3,
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T23:59:59.999Z',
    );

    expect(api.get).toHaveBeenCalledWith('/profile/doctors/3/available-slots', {
      params: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
    });
    expect(r).toEqual(payload);
  });
});
