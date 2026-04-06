import { Module, forwardRef } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { AsaasModule } from './asaas.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { ProfileModule } from '../profile/profile.module';
import { PrismaService } from '../prisma.service';
import { PaymentCronService } from './payment.cron.service';
import { PaymentService } from './payment.service';

@Module({
  imports: [AsaasModule, forwardRef(() => ProfileModule), AppointmentModule],
  controllers: [PaymentController],
  providers: [PrismaService, PaymentCronService, PaymentService],
  exports: [AsaasModule, PaymentService],
})
export class PaymentModule {}