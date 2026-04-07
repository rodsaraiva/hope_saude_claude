import 'reflect-metadata';
import { AuthController } from './auth.controller';

/**
 * Garante que as rotas sensíveis (/auth/login e /auth/register) estão
 * protegidas por rate limiting via @Throttle(). Se o decorator for removido
 * por engano, este teste falha.
 */
describe('AuthController — rate limiting', () => {
  const THROTTLER_KEY = 'THROTTLER:LIMIT';

  const getThrottleMetadata = (methodName: string) => {
    const handler = (AuthController.prototype as any)[methodName];
    // @Throttle guarda a config em metadata prefixado com THROTTLER:LIMIT
    const keys = Reflect.getMetadataKeys(handler) as string[];
    const throttleKey = keys.find((k) =>
      typeof k === 'string' && k.startsWith('THROTTLER'),
    );
    return throttleKey ? Reflect.getMetadata(throttleKey, handler) : undefined;
  };

  it('POST /auth/register tem @Throttle aplicado', () => {
    expect(getThrottleMetadata('register')).toBeDefined();
  });

  it('POST /auth/login tem @Throttle aplicado', () => {
    expect(getThrottleMetadata('login')).toBeDefined();
  });
});
