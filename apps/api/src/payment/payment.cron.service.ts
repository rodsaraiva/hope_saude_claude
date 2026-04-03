import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';

@Injectable()
export class PaymentCronService {
  private readonly logger = new Logger(PaymentCronService.name);

  constructor(
    private asaasService: AsaasService,
    private appointmentService: AppointmentService,
  ) {}

  @Cron('*/15 * * * *')
  async handleCron() {
    this.logger.log('Verificando pagamentos Asaas pendentes (checkout sem consulta ainda)...');

    const pending = await this.appointmentService.findPendingCheckouts();

    if (!pending || pending.length === 0) {
      this.logger.log('Nenhum checkout pendente.');
      return;
    }

    for (const row of pending) {
      try {
        const paymentStatus = await this.asaasService.getPaymentStatus(row.asaasPaymentId);

        if (paymentStatus.status === 'RECEIVED' || paymentStatus.status === 'CONFIRMED') {
          await this.appointmentService.createConfirmedAppointment({
            patientId: row.patientId,
            doctorId: row.doctorId,
            date: row.date,
            paymentId: row.asaasPaymentId,
          });
          await this.appointmentService.deletePendingCheckout(row.id);
          this.logger.log(`Consulta criada e confirmada após pagamento (checkout ${row.id})`);
        }
      } catch (error) {
        this.logger.error(`Erro ao checar pagamento ${row.asaasPaymentId}`, error);
      }
    }
    this.logger.log('Verificação de pagamentos concluída.');
  }
}
