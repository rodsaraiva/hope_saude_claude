import { api } from '@/lib/api-client';

export type DoctorSetupBody = {
  specialty: string;
  crm: string;
  bio?: string;
};

export type PatientSetupBody = {
  cpf: string;
  phone: string;
  medicalHistory?: string;
};

/** Contrato fino para setup de perfil (facilita testes e DIP). */
export async function postDoctorSetup(body: DoctorSetupBody): Promise<unknown> {
  return api.post('/profile/doctor/setup', body);
}

export async function postPatientSetup(body: PatientSetupBody): Promise<unknown> {
  return api.post('/profile/patient/setup', body);
}
