import { parseCorsOrigins } from './cors.util';

describe('parseCorsOrigins', () => {
  it('retorna lista quando há uma origin', () => {
    expect(parseCorsOrigins('http://localhost:3001', 'development')).toEqual([
      'http://localhost:3001',
    ]);
  });

  it('retorna lista quando há múltiplas origins separadas por vírgula', () => {
    expect(parseCorsOrigins('http://localhost:3001, https://hope.app', 'production')).toEqual([
      'http://localhost:3001',
      'https://hope.app',
    ]);
  });

  it('ignora espaços e entradas vazias', () => {
    expect(parseCorsOrigins('  http://a.com , , http://b.com ', 'development')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('libera tudo (true) só fora de produção quando env não está definido', () => {
    expect(parseCorsOrigins(undefined, 'development')).toBe(true);
    expect(parseCorsOrigins('', 'development')).toBe(true);
    expect(parseCorsOrigins('   ', 'test')).toBe(true);
  });

  it('fail-closed em produção sem CORS_ORIGINS (lista vazia, não true)', () => {
    expect(parseCorsOrigins(undefined, 'production')).toEqual([]);
    expect(parseCorsOrigins('', 'production')).toEqual([]);
    expect(parseCorsOrigins('   ', 'production')).toEqual([]);
  });
});
