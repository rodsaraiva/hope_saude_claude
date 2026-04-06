import {
  validateDoctorSetupFields,
  validatePatientCpfDigits,
  validatePatientPhone,
} from '../setup-validation';

describe('validateDoctorSetupFields', () => {
  it('retorna null quando válido', () => {
    expect(validateDoctorSetupFields('Psiquiatria', '123456')).toBeNull();
  });

  it('exige especialidade', () => {
    expect(validateDoctorSetupFields('', 'CRM')).toMatch(/especialidade/i);
    expect(validateDoctorSetupFields('   ', 'CRM')).toMatch(/especialidade/i);
  });

  it('exige CRM', () => {
    expect(validateDoctorSetupFields('Psiquiatria', '')).toMatch(/CRM/i);
  });
});

describe('validatePatientCpfDigits', () => {
  it('aceita 11 dígitos', () => {
    expect(validatePatientCpfDigits('12345678909')).toBeNull();
  });

  it('rejeita tamanho incorreto', () => {
    expect(validatePatientCpfDigits('123')).not.toBeNull();
  });
});

describe('validatePatientPhone', () => {
  it('exige telefone', () => {
    expect(validatePatientPhone('')).not.toBeNull();
    expect(validatePatientPhone('  ')).not.toBeNull();
  });

  it('aceita telefone preenchido', () => {
    expect(validatePatientPhone('11999999999')).toBeNull();
  });
});
