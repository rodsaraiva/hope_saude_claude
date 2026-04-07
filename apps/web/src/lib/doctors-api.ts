import { api } from '@/lib/api-client';
import type { ConsultationModel } from '@/lib/doctor-dashboard-api';

/**
 * Tipos do domínio público de médicos (listagem e detalhe).
 * O backend retorna um DoctorProfile com `user` populado.
 */
export interface PublicDoctor {
  id: number;
  userId: number;
  specialty: string;
  crm: string;
  bio?: string | null;
  availability?: string | null;
  user?: {
    name: string;
    email: string;
  };
  consultationModels?: ConsultationModel[];
}

export async function fetchDoctors(specialty?: string): Promise<PublicDoctor[]> {
  const params: Record<string, string> = {};
  if (specialty) params.specialty = specialty;
  return api.get<PublicDoctor[]>('/profile/doctors', { params });
}

export async function fetchDoctorByUserId(userId: number): Promise<PublicDoctor> {
  return api.get<PublicDoctor>(`/profile/doctors/${userId}`);
}
