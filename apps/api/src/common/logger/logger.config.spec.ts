import { buildPinoConfig } from './logger.config';

describe('buildPinoConfig', () => {
  it('usa nível debug por padrão em ambiente não-prod', () => {
    const cfg = buildPinoConfig({ NODE_ENV: 'development' });
    expect(cfg.pinoHttp).toBeDefined();
    expect((cfg.pinoHttp as { level: string }).level).toBe('debug');
  });

  it('usa nível info por padrão em produção', () => {
    const cfg = buildPinoConfig({ NODE_ENV: 'production' });
    expect((cfg.pinoHttp as { level: string }).level).toBe('info');
  });

  it('respeita LOG_LEVEL do env quando informado', () => {
    const cfg = buildPinoConfig({ NODE_ENV: 'production', LOG_LEVEL: 'warn' });
    expect((cfg.pinoHttp as { level: string }).level).toBe('warn');
  });

  it('inclui transport pino-pretty em dev', () => {
    const cfg = buildPinoConfig({ NODE_ENV: 'development' });
    const pinoHttp = cfg.pinoHttp as { transport?: { target: string } };
    expect(pinoHttp.transport?.target).toBe('pino-pretty');
  });

  it('NÃO inclui transport em produção (JSON puro)', () => {
    const cfg = buildPinoConfig({ NODE_ENV: 'production' });
    const pinoHttp = cfg.pinoHttp as { transport?: unknown };
    expect(pinoHttp.transport).toBeUndefined();
  });

  it('redact sempre presente e cobre password, cpf, authorization', () => {
    const cfg = buildPinoConfig({ NODE_ENV: 'production' });
    const redact = (cfg.pinoHttp as { redact: { paths: string[] } }).redact;
    expect(redact.paths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.body.password',
        'req.body.cpf',
        '*.password',
        '*.cpf',
      ]),
    );
  });

  it('ignora /health do auto-logging para não poluir', () => {
    const cfg = buildPinoConfig({ NODE_ENV: 'development' });
    const autoLogging = (
      cfg.pinoHttp as { autoLogging: { ignore: (r: { url: string }) => boolean } }
    ).autoLogging;
    expect(autoLogging.ignore({ url: '/health' })).toBe(true);
    expect(autoLogging.ignore({ url: '/auth/login' })).toBe(false);
  });
});
