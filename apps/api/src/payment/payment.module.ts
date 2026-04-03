import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { AsaasModule } from './asaas.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { ProfileModule } from '../profile/profile.module';
import { PrismaService } from '../prisma.service';
import { PaymentCronService } from './payment.cron.service';

@Module({
  imports: [AsaasModule, ProfileModule, AppointmentModule],
  controllers: [PaymentController],
  providers: [PrismaService, PaymentCronService],
  exports: [AsaasModule],
})
export class PaymentModule {}