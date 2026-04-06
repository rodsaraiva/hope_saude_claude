import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SetupDoctorDto {
  @IsString()
  @IsNotEmpty({ message: 'A especialidade é obrigatória' })
  specialty!: string;

  @IsString()
  @IsNotEmpty({ message: 'O CRM é obrigatório' })
  crm!: string;

  @IsString()
  @IsOptional()
  availability?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}
