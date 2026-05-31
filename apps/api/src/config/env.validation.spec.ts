import { buildEnvValidationSchema } from './env.validation';

describe('env validation schema', () => {
  it('exige ASAAS_API_KEY, JWT_SECRET e DATA_ENCRYPTION_KEY quando NODE_ENV=production', () => {
    const schema = buildEnvValidationSchema();
    const { error } = schema.validate(
      { NODE_ENV: 'production' },
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeDefined();
    const message = error!.message;
    expect(message).toContain('ASAAS_API_KEY');
    expect(message).toContain('JWT_SECRET');
    expect(message).toContain('DATA_ENCRYPTION_KEY');
  });

  it('aceita ambiente de desenvolvimento sem os segredos', () => {
    const schema = buildEnvValidationSchema();
    const { error } = schema.validate(
      { NODE_ENV: 'development' },
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeUndefined();
  });

  it('aceita produção quando os três segredos estão presentes', () => {
    const schema = buildEnvValidationSchema();
    const { error } = schema.validate(
      {
        NODE_ENV: 'production',
        ASAAS_API_KEY: 'k',
        JWT_SECRET: 's',
        DATA_ENCRYPTION_KEY: 'd',
      },
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeUndefined();
  });
});
