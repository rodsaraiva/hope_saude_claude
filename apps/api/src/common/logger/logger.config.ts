import type { Params } from 'nestjs-pino';

/**
 * Constrói a config do nestjs-pino. Função pura para facilitar testes.
 *
 * - Em produção: JSON estruturado para ingest em ferramentas tipo Loki/Datadog
 * - Em dev/test: pretty-print colorido (pino-pretty) com ts compacto
 *
 * Redaction sempre aplicada para campos sensíveis (senhas, tokens, CPF).
 */
export function buildPinoConfig(env: NodeJS.ProcessEnv = process.env): Params {
  const isProd = env.NODE_ENV === 'production';
  const level = env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');

  return {
    pinoHttp: {
      level,
      // Não polui logs com bodies — apenas method/url/status/responseTime
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.cpf',
          'req.body.creditCard',
          'req.body.creditCardHolderInfo',
          '*.password',
          '*.cpf',
          '*.access_token',
          '*.JWT_SECRET',
          '*.DATA_ENCRYPTION_KEY',
        ],
        censor: '[REDACTED]',
      },
      ...(isProd
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname,req,res,responseTime',
                singleLine: true,
              },
            },
          }),
    },
  };
}
