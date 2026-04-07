import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'paciente@exemplo.com', description: 'E-mail cadastrado' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @ApiProperty({
    example: 'senha123',
    description: 'Senha em texto puro (criptografada no backend)',
  })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password!: string;
}
