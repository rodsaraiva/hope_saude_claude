import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreditCardDto {
  @IsString()
  holderName!: string;

  @IsString()
  number!: string;

  @IsString()
  expiryMonth!: string;

  @IsString()
  expiryYear!: string;

  @IsString()
  ccv!: string;
}

export class CreditCardHolderInfoDto {
  @IsString()
  postalCode!: string;

  @IsString()
  addressNumber!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  mobilePhone?: string;
}

export class CheckoutDto {
  @IsNumber()
  doctorId!: number;

  @IsDateString()
  date!: string;

  @IsNumber()
  @IsOptional()
  consultationModelId?: number;

  @IsEnum(['PIX', 'CREDIT_CARD'])
  @IsOptional()
  paymentMethod?: 'PIX' | 'CREDIT_CARD';

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;
}
