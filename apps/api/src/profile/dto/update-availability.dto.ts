import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsString()
  @IsNotEmpty({ message: 'A disponibilidade não pode estar vazia' })
  availability!: string;
}
