import { formatCpf, digitsOnlyCpf, isValidCpfLength } from '../cpf-format';

describe('formatCpf', () => {
  it('retorna vazio para entrada vazia', () => {
    expect(formatCpf('')).toBe('');
  });

  it('limita a 11 dígitos', () => {
    expect(formatCpf('123456789012345')).toBe('123.456.789-01');
  });

  it('formata progressivamente', () => {
    expect(formatCpf('123')).toBe('123');
    expect(formatCpf('123456')).toBe('123.456');
    expect(formatCpf('123456789')).toBe('123.456.789');
    expect(formatCpf('12345678909')).toBe('123.456.789-09');
  });

  it('ignora não-dígitos', () => {
    expect(formatCpf('123.456.789-09')).toBe('123.456.789-09');
  });
});

describe('digitsOnlyCpf', () => {
  it('remove não-numéricos', () => {
    expect(digitsOnlyCpf('123.456.789-09')).toBe('12345678909');
  });
});

describe('isValidCpfLength', () => {
  it('aceita 11 dígitos', () => {
    expect(isValidCpfLength('12345678909')).toBe(true);
  });

  it('rejeita tamanhos incorretos', () => {
    expect(isValidCpfLength('123')).toBe(false);
  });
});
