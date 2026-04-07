import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { RegisterDto } from './auth/dto/register.dto';

/**
 * Garante que a configuração do ValidationPipe global bloqueia mass assignment:
 * propriedades não declaradas no DTO devem ser rejeitadas.
 */
describe('ValidationPipe (global) — segurança contra mass assignment', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadata = {
    type: 'body' as const,
    metatype: RegisterDto,
    data: '',
  };

  it('rejeita payload com propriedades extras não declaradas no DTO', async () => {
    const payloadMalicioso = {
      name: 'Hacker',
      email: 'h@x.com',
      password: '123456',
      role: 'PATIENT',
      isAdmin: true,
      createdAt: new Date(),
    };

    await expect(pipe.transform(payloadMalicioso, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('aceita payload válido e remove nada que seja permitido', async () => {
    const payload = {
      name: 'Alice',
      email: 'alice@example.com',
      password: '123456',
      role: 'PATIENT',
    };

    const result = await pipe.transform(payload, metadata);
    expect(result).toMatchObject(payload);
  });

  it('rejeita quando campo obrigatório está ausente', async () => {
    const payload = {
      email: 'alice@example.com',
      password: '123456',
      role: 'PATIENT',
    };

    await expect(pipe.transform(payload, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
