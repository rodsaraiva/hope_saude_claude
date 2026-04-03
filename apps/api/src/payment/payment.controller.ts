import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';
import { ProfileService } from '../profile/profile.service';

type CheckoutBody = {
  doctorId?: number;
  date?: string;
  paymentMethod?: 'PIX' | 'CREDIT_CARD';
  creditCard?: {
    holderName?: string;
    number?: string;
    expiryMonth?: string;
    expiryYear?: string;
    ccv?: string;
  };
  creditCardHolderInfo?: {
    postalCode?: string;
    addressNumber?: string;
    phone?: string;
    mobilePhone?: string;
  };
};

@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentController {
  constructor(
    private asaasService: AsaasService,
    private appointmentService: AppointmentService,
    private profileService: ProfileService,
  ) {}

  /** Checkout único: gera cobrança Asaas e guarda intenção; a consulta só é criada após pagamento confirmado (cron). */
  @Post('checkout')
  async checkout(@Request() req, @Body() body: CheckoutBody) {
    if (body?.doctorId == null || body?.date == null || body.date === '') {
      throw new BadRequestException('doctorId e date são obrigatórios');
    }

    const value = 150;
    const patientName = req.user.name || 'Paciente Anonimo';
    const patientEmail = req.user.email;

    const patientProfile = await this.profileService.getPatientProfile(req.user.userId);
    const cpf = patientProfile?.cpf ?? undefined;

    if (!cpf) {
      throw new BadRequestException({
        code: 'MISSING_PATIENT_PROFILE',
        message: 'É necessário completar seu cadastro (CPF e Celular) para realizar pagamentos.',
      });
    }

    const customerId = await this.profileService.ensureAsaasCustomerId(
      req.user.userId,
      patientName,
      patientEmail,
      cpf,
    );

    const description = `Consulta Psiquiátrica — pagamento (Dr. user ${body.doctorId})`;
    const paymentMethod = body.paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';

    if (paymentMethod === 'CREDIT_CARD') {
      const cc = body.creditCard;
      const hi = body.creditCardHolderInfo;
      if (
        !cc?.holderName?.trim() ||
        !cc?.number?.trim() ||
        !cc?.expiryMonth?.trim() ||
        !cc?.expiryYear?.trim() ||
        !cc?.ccv?.trim()
      ) {
        throw new BadRequestException('Dados do cartão incompletos');
      }
      if (!hi?.postalCode?.trim() || !hi?.addressNumber?.trim()) {
        throw new BadRequestException('CEP e número do endereço são obrigatórios para pagamento com cartão');
      }

      const digits = cc.number.replace(/\D/g, '');
      let expYear = cc.expiryYear.replace(/\D/g, '');
      if (expYear.length === 2) expYear = `20${expYear}`;

      const payment = await this.asaasService.createPayment(
        customerId,
        value,
        'CREDIT_CARD',
        description,
        {
          creditCard: {
            holderName: cc.holderName.trim(),
            number: digits,
            expiryMonth: cc.expiryMonth.replace(/\D/g, '').padStart(2, '0'),
            expiryYear: expYear,
            ccv: cc.ccv.replace(/\D/g, ''),
          },
          creditCardHolderInfo: {
            name: patientName,
            email: patientEmail,
            cpfCnpj: cpf,
            postalCode: hi.postalCode.replace(/\D/g, ''),
            addressNumber: hi.addressNumber.trim(),
            phone: hi.phone?.replace(/\D/g, '') || patientProfile?.phone?.replace(/\D/g, '') || undefined,
            mobilePhone: hi.mobilePhone?.replace(/\D/g, '') || patientProfile?.phone?.replace(/\D/g, '') || undefined,
          },
        },
      );

      await this.appointmentService.createPendingCheckout({
        patientId: req.user.userId,
        doctorId: Number(body.doctorId),
        date: new Date(body.date),
        asaasPaymentId: payment.id,
      });

      return {
        paymentId: payment.id,
        invoiceUrl: payment.invoiceUrl,
        paymentMethod: 'CREDIT_CARD' as const,
        paymentStatus: (payment as { status?: string }).status ?? 'CONFIRMED',
      };
    }

    const payment = await this.asaasService.createPayment(customerId, value, 'PIX', description);

    await this.appointmentService.createPendingCheckout({
      patientId: req.user.userId,
      doctorId: Number(body.doctorId),
      date: new Date(body.date),
      asaasPaymentId: payment.id,
    });

    /** QR em etapa separada (`GET /payments/pix-qr/:paymentId`) para a UI exibir a cobrança antes. */
    return {
      paymentId: payment.id,
      invoiceUrl: payment.invoiceUrl,
      paymentMethod: 'PIX' as const,
      value,
      pixQrPending: true as const,
    };
  }

  /** Dados do QR/copia-e-cola após o checkout PIX (cobrança já criada). */
  @Get('pix-qr/:paymentId')
  async getPixQrData(@Request() req, @Param('paymentId') paymentId: string) {
    if (!paymentId?.trim()) {
      throw new BadRequestException('paymentId obrigatório');
    }
    const pending = await this.appointmentService.findPendingCheckoutByPatientAndPayment(
      req.user.userId,
      paymentId,
    );
    if (!pending) {
      throw new NotFoundException('Cobrança não encontrada ou sem permissão');
    }
    const pix = await this.asaasService.getPixQrCode(paymentId);
    return {
      pixQrCode: pix.encodedImage,
      pixCode: pix.payload,
      pixExpiresAt: pix.expirationDate,
    };
  }

  @Post('confirm/:appointmentId')
  async confirm(@Param('appointmentId') appointmentId: string, @Body() body: any) {
    await this.appointmentService.updateStatus(Number(appointmentId), 'CONFIRMED');
    return { message: 'Pagamento confirmado e consulta agendada!' };
  }
}
