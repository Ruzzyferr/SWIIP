import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetPasswordDto } from '../src/auth/dto/auth.dto';

describe('Auth DTO contracts', () => {
  it('accepts reset-password payload with newPassword', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'abc123',
      newPassword: 'StrongPass1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects reset-password payload with password (old contract)', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'abc123',
      password: 'StrongPass1',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
