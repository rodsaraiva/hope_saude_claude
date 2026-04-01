import { Controller, Post, Body, UseGuards, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StripeService } from './stripe.service';
import { AppointmentService } from '../appointment/appointment.service';

@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentController {
  constructor(
    private stripeService: StripeService,
    private appointmentService: AppointmentService
  ) {}

  @Post('checkout/:appointmentId')
  async checkout(@Param('appointmentId') appointmentId: string, @Body() body: any) {
    // Simulação de checkout - cria o intent no Stripe
    const intent = await this.stripeService.createPaymentIntent(150); // Valor fixo de R$ 150,00 para o MVP
    return {
      clientSecret: intent.client_secret,
      appointmentId,
    };
  }

  @Post('confirm/:appointmentId')
  async confirm(@Param('appointmentId') appointmentId: string, @Body() body: any) {
    const isPaid = await this.stripeService.verifyPayment(body.paymentId);
    if (isPaid) {
      await this.appointmentService.updateStatus(Number(appointmentId), 'CONFIRMED');
      return { message: 'Pagamento confirmado e consulta agendada!' };
    }
    return { message: 'Pagamento pendente' };
  }
}
