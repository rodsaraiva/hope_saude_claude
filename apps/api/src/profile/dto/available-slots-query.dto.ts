import { IsDateString, IsOptional, IsString, MaxLength, IsNumberString } from 'class-validator';

export class AvailableSlotsQueryDto {
  @IsDateString({}, { message: 'from deve ser uma data ISO 8601 válida' })
  from!: string;

  @IsDateString({}, { message: 'to deve ser uma data ISO 8601 válida' })
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  @IsOptional()
  @IsNumberString()
  durationMinutes?: string;
}
