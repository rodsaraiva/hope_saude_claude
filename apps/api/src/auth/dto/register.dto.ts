import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Maria Silva', description: 'Nome completo do usuário' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name!: string;

  @ApiProperty({ example: 'maria@exemplo.com', description: 'E-mail único usado para login' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password!: string;

  @ApiProperty({
    enum: ['DOCTOR', 'PATIENT'],
    example: 'PATIENT',
    description: 'Papel do usuário no sistema',
  })
  @IsEnum(['DOCTOR', 'PATIENT'], { message: 'O papel deve ser DOCTOR ou PATIENT' })
  role!: 'DOCTOR' | 'PATIENT';
}
