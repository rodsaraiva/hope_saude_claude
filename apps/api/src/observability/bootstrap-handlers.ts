import { LoggerService } from '@nestjs/common';

/**
 * Registra handlers de erros não tratados a nível de processo, logando via Pino
 * (o LoggerService global). Recebe `proc` para ser testável sem mexer no
 * `process` real do test runner.
 *
 * - unhandledRejection: loga como error (a promessa morreu, mas o app segue).
 * - uncaughtException: loga como fatal (estado potencialmente corrompido).
 */
export function registerProcessHandlers(
  logger: LoggerService,
  proc: NodeJS.Process = process,
): void {
  proc.on('unhandledRejection', (reason: unknown) => {
    const detail = reason instanceof Error ? reason.stack : String(reason);
    logger.error(`unhandledRejection: ${detail}`);
  });

  proc.on('uncaughtException', (error: Error) => {
    const fatal = (logger.fatal ?? logger.error).bind(logger);
    fatal(`uncaughtException: ${error.stack ?? error.message}`);
  });
}
