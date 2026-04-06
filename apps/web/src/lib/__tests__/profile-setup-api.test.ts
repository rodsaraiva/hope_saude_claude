import { postDoctorSetup, postPatientSetup } from '../profile-setup-api';
import { api } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  api: {
    post: jest.fn(),
  },
}));

describe('profile-setup-api', () => {
  beforeEach(() => {
    jest.mocked(api.post).mockReset();
  });

  it('postDoctorSetup envia POST para /profile/doctor/setup', async () => {
    jest.mocked(api.post).mockResolvedValue({ ok: true });
    await postDoctorSetup({ specialty: 'Psiquiatria', crm: '123', bio: 'x' });
    expect(api.post).toHaveBeenCalledWith('/profile/doctor/setup', {
      specialty: 'Psiquiatria',
      crm: '123',
      bio: 'x',
    });
  });

  it('postPatientSetup envia POST para /profile/patient/setup', async () => {
    jest.mocked(api.post).mockResolvedValue({});
    await postPatientSetup({ cpf: '12345678909', phone: '11999999999', medicalHistory: undefined });
    expect(api.post).toHaveBeenCalledWith('/profile/patient/setup', {
      cpf: '12345678909',
      phone: '11999999999',
      medicalHistory: undefined,
    });
  });
});
