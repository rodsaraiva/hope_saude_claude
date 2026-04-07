import { parseCorsOrigins } from './cors.util';

describe('parseCorsOrigins', () => {
  it('retorna lista quando há uma origin', () => {
    expect(parseCorsOrigins('http://localhost:3001')).toEqual(['http://localhost:3001']);
  });

  it('retorna lista quando há múltiplas origins separadas por vírgula', () => {
    expect(parseCorsOrigins('http://localhost:3001, https://hope.app')).toEqual([
      'http://localhost:3001',
      'https://hope.app',
    ]);
  });

  it('ignora espaços e entradas vazias', () => {
    expect(parseCorsOrigins('  http://a.com , , http://b.com ')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('retorna true (liberado) quando env não está definido', () => {
    expect(parseCorsOrigins(undefined)).toBe(true);
    expect(parseCorsOrigins('')).toBe(true);
    expect(parseCorsOrigins('   ')).toBe(true);
  });
});
