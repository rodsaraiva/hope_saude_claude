import { IsString, IsOptional, Length } from 'class-validator';

export class SetupPatientDto {
  @IsString()
  @IsOptional()
  @Length(11, 14, { message: 'CPF inválido' })
  cpf?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  medicalHistory?: string;
}
