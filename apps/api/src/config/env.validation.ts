import * as Joi from 'joi';

/**
 * Schema de validação das variáveis de ambiente.
 * Em produção, segredos sensíveis são obrigatórios — fail-fast no boot.
 */
export function buildEnvValidationSchema(): Joi.ObjectSchema {
  const requiredInProd = (base: Joi.StringSchema) =>
    Joi.alternatives().conditional('NODE_ENV', {
      is: 'production',
      then: base.required(),
      otherwise: base.optional(),
    });

  return Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    ASAAS_API_KEY: requiredInProd(Joi.string()),
    JWT_SECRET: requiredInProd(Joi.string()),
    DATA_ENCRYPTION_KEY: requiredInProd(Joi.string()),
  });
}
