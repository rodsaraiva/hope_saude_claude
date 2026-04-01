import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PaymentController } from './payment.controller';
import { AppointmentService } from '../appointment/appointment.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PaymentController],
  providers: [StripeService, AppointmentService, PrismaService],
})
export class PaymentModule {}
