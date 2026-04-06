/** Formata CPF para exibição (XXX.XXX.XXX-XX). Apenas dígitos, máx. 11. */
export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function digitsOnlyCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpfLength(digits: string): boolean {
  return digits.length === 11;
}
