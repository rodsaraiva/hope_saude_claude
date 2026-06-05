import { LoggerService } from '@nestjs/common';
import { registerProcessHandlers } from './bootstrap-handlers';

describe('registerProcessHandlers', () => {
  let logger: { error: jest.Mock; fatal: jest.Mock };
  let added: string[];

  beforeEach(() => {
    logger = { error: jest.fn(), fatal: jest.fn() };
    added = [];
  });

  const fakeProcess = () => {
    const listeners: Record<string, (...args: unknown[]) => void> = {};
    return {
      on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
        added.push(event);
        listeners[event] = cb;
      }),
      emit: (event: string, ...args: unknown[]) => listeners[event]?.(...args),
    };
  };

  it('registra unhandledRejection e uncaughtException', () => {
    const proc = fakeProcess();
    registerProcessHandlers(logger as unknown as LoggerService, proc as unknown as NodeJS.Process);
    expect(added).toEqual(expect.arrayContaining(['unhandledRejection', 'uncaughtException']));
  });

  it('loga via logger.error em unhandledRejection sem derrubar o processo', () => {
    const proc = fakeProcess();
    registerProcessHandlers(logger as unknown as LoggerService, proc as unknown as NodeJS.Process);
    proc.emit('unhandledRejection', new Error('promessa solta'));
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(String(logger.error.mock.calls[0][0])).toContain('unhandledRejection');
  });

  it('loga via logger.fatal em uncaughtException', () => {
    const proc = fakeProcess();
    registerProcessHandlers(logger as unknown as LoggerService, proc as unknown as NodeJS.Process);
    proc.emit('uncaughtException', new Error('estourou'));
    expect(logger.fatal).toHaveBeenCalledTimes(1);
    expect(String(logger.fatal.mock.calls[0][0])).toContain('uncaughtException');
  });

  it('cai para logger.error em uncaughtException quando o logger não tem fatal', () => {
    const errorOnly = { error: jest.fn() };
    const proc = fakeProcess();
    registerProcessHandlers(
      errorOnly as unknown as LoggerService,
      proc as unknown as NodeJS.Process,
    );
    proc.emit('uncaughtException', new Error('estourou'));
    expect(errorOnly.error).toHaveBeenCalledTimes(1);
    expect(String(errorOnly.error.mock.calls[0][0])).toContain('uncaughtException');
  });
});
