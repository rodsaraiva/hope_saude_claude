import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConfirmEmailVerificationDto } from './confirm-email-verification.dto';

describe('ConfirmEmailVerificationDto', () => {
  it('aceita token não-vazio', async () => {
    const dto = plainToInstance(ConfirmEmailVerificationDto, { token: 'a'.repeat(64) });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita token vazio', async () => {
    const dto = plainToInstance(ConfirmEmailVerificationDto, { token: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });
});
