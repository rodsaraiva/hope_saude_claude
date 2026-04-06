import {
  getProfileMeSafe,
  fetchAppointmentsMe,
  saveDoctorAvailability,
  createConsultationModel,
  updateConsultationModel,
  deleteConsultationModel,
} from '../doctor-dashboard-api';
import { api } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('doctor-dashboard-api', () => {
  beforeEach(() => {
    jest.mocked(api.get).mockReset();
    jest.mocked(api.post).mockReset();
  });

  describe('getProfileMeSafe', () => {
    it('retorna profile quando OK', async () => {
      jest.mocked(api.get).mockResolvedValue({ user: { name: 'Dr' } });
      const r = await getProfileMeSafe();
      expect('profile' in r && r.profile).toEqual({ user: { name: 'Dr' } });
    });

    it('retorna notFound em 404', async () => {
      const err = Object.assign(new Error('Not Found'), { status: 404 });
      jest.mocked(api.get).mockRejectedValue(err);
      const r = await getProfileMeSafe();
      expect(r).toEqual({ notFound: true });
    });

    it('propaga outros erros', async () => {
      jest.mocked(api.get).mockRejectedValue(Object.assign(new Error('x'), { status: 500 }));
      await expect(getProfileMeSafe()).rejects.toMatchObject({ status: 500 });
    });
  });

  it('fetchAppointmentsMe chama GET /appointments/me', async () => {
    jest.mocked(api.get).mockResolvedValue([]);
    await fetchAppointmentsMe();
    expect(api.get).toHaveBeenCalledWith('/appointments/me');
  });

  it('saveDoctorAvailability envia JSON stringificado', async () => {
    jest.mocked(api.post).mockResolvedValue({});
    await saveDoctorAvailability('[{"day":"Segunda"}]');
    expect(api.post).toHaveBeenCalledWith('/profile/doctor/availability', {
      availability: '[{"day":"Segunda"}]',
    });
  });

  describe('Consultation Models API', () => {
    it('createConsultationModel', async () => {
      jest.mocked(api.post).mockResolvedValue({ id: 1 });
      await createConsultationModel({ name: 'A', durationMinutes: 30, price: 50 });
      expect(api.post).toHaveBeenCalledWith('/profile/doctor/consultation-models', { name: 'A', durationMinutes: 30, price: 50 });
    });

    it('updateConsultationModel', async () => {
      jest.mocked(api.post).mockResolvedValue({ id: 1 });
      await updateConsultationModel(1, { name: 'B', durationMinutes: 45, price: 100 });
      expect(api.post).toHaveBeenCalledWith('/profile/doctor/consultation-models/1', { name: 'B', durationMinutes: 45, price: 100 });
    });

    it('deleteConsultationModel', async () => {
      jest.mocked(api.post).mockResolvedValue({});
      await deleteConsultationModel(1);
      expect(api.post).toHaveBeenCalledWith('/profile/doctor/consultation-models/1/delete');
    });
  });
});
