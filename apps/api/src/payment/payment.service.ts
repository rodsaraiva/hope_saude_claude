import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';
import { PatientProfileRepository } from '../profile/data/patient-profile.repository';
import { DoctorProfileRepository } from '../profile/data/doctor-profile.repository';
import { CheckoutDto } from './dto/checkout.dto';
import { AuthenticatedUser } from '../auth/authenticated-request';

@Injectable()
export class PaymentService {
  constructor(
    private asaasService: AsaasService,
    private appointmentService: AppointmentService,
    private patientProfileRepo: PatientProfileRepository,
    private doctorProfileRepo: DoctorProfileRepository,
  ) {}

  /**
   * Garante ID do cliente Asaas (cria ou reutiliza por CPF).
   */
  async ensureAsaasCustomerId(
    userId: number,
    name: string,
    email: string,
    cpf: string,
  ): Promise<string> {
    const profile = await this.patientProfileRepo.findByUserId(userId);
    if (!profile) {
      throw new Error('Perfil de paciente não encontrado');
    }
    if (profile.asaasCustomerId) {
      return profile.asaasCustomerId;
    }

    const cpfDigits = cpf.replace(/\D/g, '');
    const existing = await this.asaasService.findCustomerIdByCpf(cpfDigits);
    let customerId: string;
    if (existing) {
      customerId = existing;
    } else {
      const created = await this.asaasService.createCustomer(name, email, cpf);
      customerId = created.id;
    }

    await this.patientProfileRepo.updateAsaasCustomerId(userId, customerId);

    return customerId;
  }

  async processCheckout(user: AuthenticatedUser, body: CheckoutDto) {
    if (body?.doctorId == null || body?.date == null || body.date === '') {
      throw new BadRequestException('doctorId e date são obrigatórios');
    }

    let value = 150;
    let durationMinutes = 60;

    if (body.consultationModelId) {
      const doctorProfile = await this.doctorProfileRepo.findByUserIdWithConsultationModels(
        body.doctorId,
      );
      const model = doctorProfile?.consultationModels?.find(
        (m) => m.id === body.consultationModelId,
      );
      if (model) {
        value = model.price;
        durationMinutes = model.durationMinutes;
      }
    }

    const patientName = user.name || 'Paciente Anonimo';
    const patientEmail = user.email ?? '';
    if (!patientEmail) {
      throw new BadRequestException('E-mail do usuário não disponível na sessão');
    }

    const patientProfile = await this.patientProfileRepo.findByUserId(user.userId);
    const cpf = patientProfile?.cpf ?? undefined;

    if (!cpf) {
      throw new BadRequestException({
        code: 'MISSING_PATIENT_PROFILE',
        message: 'É necessário completar seu cadastro (CPF e Celular) para realizar pagamentos.',
      });
    }

    const customerId = await this.ensureAsaasCustomerId(
      user.userId,
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
        throw new BadRequestException(
          'CEP e número do endereço são obrigatórios para pagamento com cartão',
        );
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
            phone:
              hi.phone?.replace(/\D/g, '') ||
              patientProfile?.phone?.replace(/\D/g, '') ||
              undefined,
            mobilePhone:
              hi.mobilePhone?.replace(/\D/g, '') ||
              patientProfile?.phone?.replace(/\D/g, '') ||
              undefined,
          },
        },
      );

      await this.appointmentService.createPendingCheckout({
        patientId: user.userId,
        doctorId: Number(body.doctorId),
        date: new Date(body.date),
        asaasPaymentId: payment.id,
        consultationModelId: body.consultationModelId,
        durationMinutes,
        price: value,
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
      patientId: user.userId,
      doctorId: Number(body.doctorId),
      date: new Date(body.date),
      asaasPaymentId: payment.id,
      consultationModelId: body.consultationModelId,
      durationMinutes,
      price: value,
    });

    return {
      paymentId: payment.id,
      invoiceUrl: payment.invoiceUrl,
      paymentMethod: 'PIX' as const,
      value,
      pixQrPending: true as const,
    };
  }

  async getPixQrData(userId: number, paymentId: string) {
    if (!paymentId?.trim()) {
      throw new BadRequestException('paymentId obrigatório');
    }
    const pending = await this.appointmentService.findPendingCheckoutByPatientAndPayment(
      userId,
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

  /** Confirma o pagamento somente após o Asaas reportar RECEIVED/CONFIRMED, então cria a consulta. */
  async confirmPayment(userId: number, paymentId: string) {
    const pending = await this.appointmentService.findPendingCheckoutByPatientAndPayment(
      userId,
      paymentId,
    );
    if (!pending) {
      throw new NotFoundException('Cobrança não encontrada ou sem permissão');
    }

    // Em sandbox, simula o recebimento; em mock isso é no-op.
    await this.asaasService.receiveInSandbox(paymentId);

    const { status } = (await this.asaasService.getPaymentStatus(paymentId)) as {
      status?: string;
    };
    if (status !== 'RECEIVED' && status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Pagamento ainda não confirmado pelo Asaas (status: ${status ?? 'desconhecido'})`,
      );
    }

    await this.appointmentService.createConfirmedAppointment({
      patientId: pending.patientId,
      doctorId: pending.doctorId,
      date: pending.date,
      paymentId: pending.asaasPaymentId,
      consultationModelId: pending.consultationModelId || undefined,
      durationMinutes: pending.durationMinutes,
      price: pending.price,
    });
    await this.appointmentService.deletePendingCheckout(pending.id);

    return { success: true };
  }
}
