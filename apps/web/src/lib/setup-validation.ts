/** Validações puras para telas de setup (SRP: regras separadas da UI). */

export function validateDoctorSetupFields(specialty: string, crm: string): string | null {
  if (!specialty?.trim()) {
    return 'A especialidade é obrigatória.';
  }
  if (!crm?.trim()) {
    return 'O CRM é obrigatório.';
  }
  return null;
}

export function validatePatientCpfDigits(digits: string): string | null {
  if (digits.length !== 11) {
    return 'O CPF deve conter 11 dígitos.';
  }
  return null;
}

export function validatePatientPhone(phone: string): string | null {
  if (!phone?.trim()) {
    return 'O telefone de contato é obrigatório.';
  }
  return null;
}
