import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PrismaService } from '../prisma.service';
import { PaymentModule } from '../payment/payment.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { AvailableSlotsService } from '../availability/available-slots.service';
import { CryptographyService } from '../common/cryptography.service';
import { ProfileDataModule } from './data/profile-data.module';

@Module({
  imports: [ProfileDataModule, PaymentModule, AppointmentModule],
  controllers: [ProfileController],
  providers: [ProfileService, PrismaService, AvailableSlotsService, CryptographyService],
  exports: [ProfileService],
})
export class ProfileModule {}
