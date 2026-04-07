import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { AsaasModule } from './asaas.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { ProfileDataModule } from '../profile/data/profile-data.module';
import { PrismaService } from '../prisma.service';
import { PaymentCronService } from './payment.cron.service';
import { PaymentService } from './payment.service';

@Module({
  imports: [AsaasModule, ProfileDataModule, AppointmentModule],
  controllers: [PaymentController],
  providers: [PrismaService, PaymentCronService, PaymentService],
  exports: [AsaasModule, PaymentService],
})
export class PaymentModule {}
