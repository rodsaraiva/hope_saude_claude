import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentService } from './payment.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  /** Checkout único: gera cobrança Asaas e guarda intenção; a consulta só é criada após pagamento confirmado (cron). */
  @Post('checkout')
  async checkout(@Request() req, @Body() body: CheckoutDto) {
    return this.paymentService.processCheckout(req.user, body);
  }

  /** Dados do QR/copia-e-cola após o checkout PIX (cobrança já criada). */
  @Get('pix-qr/:paymentId')
  async getPixQrData(@Request() req, @Param('paymentId') paymentId: string) {
    return this.paymentService.getPixQrData(req.user.userId, paymentId);
  }

  /** Forçar recebimento de pagamento em sandbox (apenas para testes/agilidade). */
  @Post(':paymentId/confirm')
  async confirmPayment(@Request() req, @Param('paymentId') paymentId: string) {
    return this.paymentService.confirmPayment(req.user.userId, paymentId);
  }
}
