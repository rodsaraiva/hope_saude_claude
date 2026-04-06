import { Module, forwardRef } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PrismaService } from '../prisma.service';
import { PaymentModule } from '../payment/payment.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { AvailableSlotsService } from '../availability/available-slots.service';

@Module({
  imports: [forwardRef(() => PaymentModule), AppointmentModule],
  controllers: [ProfileController],
  providers: [ProfileService, PrismaService, AvailableSlotsService],
  exports: [ProfileService],
})
export class ProfileModule {}
