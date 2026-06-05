import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  it('aceita token não-vazio e newPassword com >= 6 chars', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'a'.repeat(64),
      newPassword: 'novasenha',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita token vazio', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: '', newPassword: 'novasenha' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejeita newPassword curta (< 6)', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: 'abc', newPassword: '123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});
