import { api } from '@/lib/api-client';

export async function getProfileMeSafe(): Promise<{ profile: unknown } | { notFound: true }> {
  try {
    const profile = await api.get<unknown>('/profile/me');
    return { profile };
  } catch (e: unknown) {
    const status = (e as { status?: number }).status;
    if (status === 404) {
      return { notFound: true };
    }
    throw e;
  }
}

export async function fetchAppointmentsMe(): Promise<unknown> {
  return api.get('/appointments/me');
}

export async function saveDoctorAvailability(availabilityJson: string): Promise<unknown> {
  return api.post('/profile/doctor/availability', { availability: availabilityJson });
}

export type ConsultationModel = {
  id: number;
  name: string;
  durationMinutes: number;
  price: number;
};

export async function createConsultationModel(data: Omit<ConsultationModel, 'id'>): Promise<ConsultationModel> {
  return api.post('/profile/doctor/consultation-models', data);
}

export async function updateConsultationModel(id: number, data: Omit<ConsultationModel, 'id'>): Promise<ConsultationModel> {
  return api.post(`/profile/doctor/consultation-models/${id}`, data);
}

export async function deleteConsultationModel(id: number): Promise<void> {
  return api.post(`/profile/doctor/consultation-models/${id}/delete`);
}

export type MedicalRecordAudit = {
  id: number;
  content: string;
  changedByUserId: number;
  changedAt: string;
  reason?: string;
};

export type MedicalRecord = {
  id: number;
  patientId: number;
  doctorId: number;
  appointmentId?: number;
  content: string;
  status: 'DRAFT' | 'SIGNED';
  type: string;
  createdAt: string;
  updatedAt: string;
  signature?: string;
  signatureDate?: string;
  signedHash?: string;
  signerUserId?: number;
  audits?: MedicalRecordAudit[];
  doctor?: {
    name: string;
  };
};

export async function fetchMedicalRecords(patientId: number, search?: string): Promise<MedicalRecord[]> {
  const params = search ? { search } : {};
  return api.get(`/medical-records/patient/${patientId}`, { params });
}

export async function createMedicalRecord(data: {
  patientId: number;
  appointmentId?: number;
  content: string;
  type?: string;
}): Promise<MedicalRecord> {
  return api.post('/medical-records', data);
}

export async function updateMedicalRecord(id: number, content: string, reason?: string): Promise<MedicalRecord> {
  return api.patch(`/medical-records/${id}`, { content, reason });
}

export async function signMedicalRecord(id: number, authData?: any): Promise<MedicalRecord> {
  return api.post(`/medical-records/${id}/sign`, { authData });
}

export type Medication = {
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
};

export type Prescription = {
  id: number;
  patientId: number;
  doctorId: number;
  appointmentId?: number;
  medications: string; // JSON string of Medication[]
  observations?: string;
  status: 'DRAFT' | 'SIGNED';
  createdAt: string;
  updatedAt: string;
  signature?: string;
  signatureDate?: string;
  signedHash?: string;
};

export async function fetchPrescriptions(patientId: number): Promise<Prescription[]> {
  return api.get(`/prescriptions/patient/${patientId}`);
}

export async function createPrescription(data: {
  patientId: number;
  appointmentId?: number;
  medications: string;
  observations?: string;
}): Promise<Prescription> {
  return api.post('/prescriptions', data);
}

export async function updatePrescription(id: number, data: { medications: string; observations?: string }): Promise<Prescription> {
  return api.patch(`/prescriptions/${id}`, data);
}

export async function signPrescription(id: number, authData?: any): Promise<Prescription> {
  return api.post(`/prescriptions/${id}/sign`, { authData });
}

export function getLacunaAuthorizeUrl(recordId: number, type: 'medical-record' | 'prescription' = 'medical-record'): string {
  // O Lacuna Rest PKI usa um fluxo OAuth2 genérico que suporta BirdID, VidaaS, SafeID, etc.
  const endpoint = process.env.NEXT_PUBLIC_LACUNA_AUTHORIZE_URL || 'https://pki.rest/cloud-signature/authorize';
  const redirectUri = process.env.NEXT_PUBLIC_LACUNA_REDIRECT_URI || `${window.location.origin}/signature/callback`;
  const state = encodeURIComponent(JSON.stringify({ recordId, type }));
  
  return `${endpoint}?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=signature_session&state=${state}`;
}
