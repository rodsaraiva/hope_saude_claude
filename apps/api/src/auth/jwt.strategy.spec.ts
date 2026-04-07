import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('instancia a strategy quando JWT_SECRET está definido no env', async () => {
    process.env = { ...OLD_ENV, JWT_SECRET: 'segredo-de-teste-super-forte' };

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      providers: [JwtStrategy],
    }).compile();

    const strategy = moduleRef.get(JwtStrategy);
    expect(strategy).toBeDefined();
  });

  it('lança erro quando JWT_SECRET não está definido', async () => {
    process.env = { ...OLD_ENV };
    delete process.env.JWT_SECRET;

    await expect(
      Test.createTestingModule({
        imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
        providers: [JwtStrategy],
      }).compile(),
    ).rejects.toThrow(/JWT_SECRET/);
  });

  it('validate() retorna o payload normalizado (userId, email, role)', async () => {
    process.env = { ...OLD_ENV, JWT_SECRET: 'x' };

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      providers: [JwtStrategy],
    }).compile();

    const strategy = moduleRef.get(JwtStrategy);
    const result = await strategy.validate({ sub: 42, email: 'a@b.com', role: 'DOCTOR' });
    expect(result).toEqual({ userId: 42, email: 'a@b.com', role: 'DOCTOR' });
  });
});
