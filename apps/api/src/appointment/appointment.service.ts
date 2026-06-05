import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Antecedência mínima para o PACIENTE cancelar (médico não tem janela). */
const PATIENT_CANCEL_MIN_LEAD_MS = 24 * 60 * 60 * 1000;
import { PrismaService } from '../prisma.service';
import { intervalsOverlap } from '../availability/weekly-availability';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  async createPendingCheckout(data: {
    patientId: number;
    doctorId: number;
    date: Date;
    asaasPaymentId: string;
    consultationModelId?: number;
    durationMinutes?: number;
    price?: number;
  }) {
    return this.prisma.pendingCheckout.create({ data });
  }

  async findPendingCheckouts() {
    return this.prisma.pendingCheckout.findMany();
  }

  /** Confirma que o pagamento Asaas pertence ao paciente (ex.: buscar QR PIX). */
  async findPendingCheckoutByPatientAndPayment(patientId: number, asaasPaymentId: string) {
    return this.prisma.pendingCheckout.findFirst({
      where: { patientId, asaasPaymentId },
    });
  }

  async deletePendingCheckout(id: number) {
    return this.prisma.pendingCheckout.delete({ where: { id } });
  }

  async createConfirmedAppointment(data: {
    patientId: number;
    doctorId: number;
    date: Date;
    paymentId: string;
    consultationModelId?: number;
    durationMinutes?: number;
    price?: number;
  }) {
    return this.prisma.appointment.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        date: data.date,
        status: 'CONFIRMED',
        paymentId: data.paymentId,
        consultationModelId: data.consultationModelId,
        durationMinutes: data.durationMinutes ?? 60,
        price: data.price ?? 150.0,
      },
    });
  }

  /**
   * Cria a consulta CONFIRMED e remove a pendência numa única transação.
   * O @unique de paymentId garante que ticks concorrentes não dupliquem:
   * se P2002 ocorrer, a consulta já existe (tick anterior) — apenas limpamos
   * a pendência órfã e tratamos como sucesso idempotente.
   */
  async confirmAndConsumeCheckout(data: {
    pendingCheckoutId: number;
    patientId: number;
    doctorId: number;
    date: Date;
    paymentId: string;
    consultationModelId?: number;
    durationMinutes?: number;
    price?: number;
  }): Promise<{ alreadyConfirmed: boolean }> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.appointment.create({
          data: {
            patientId: data.patientId,
            doctorId: data.doctorId,
            date: data.date,
            status: 'CONFIRMED',
            paymentId: data.paymentId,
            consultationModelId: data.consultationModelId,
            durationMinutes: data.durationMinutes ?? 60,
            price: data.price ?? 150.0,
          },
        });
        await tx.pendingCheckout.delete({ where: { id: data.pendingCheckoutId } });
      });
      return { alreadyConfirmed: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await this.prisma.pendingCheckout.delete({ where: { id: data.pendingCheckoutId } });
        return { alreadyConfirmed: true };
      }
      throw err;
    }
  }

  async getPatientAppointments(patientId: number) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'asc' },
    });
  }

  async getDoctorAppointments(doctorId: number) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patient: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async findById(id: number) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAppointmentsForDoctorInRange(doctorId: number, from: Date, to: Date) {
    return this.prisma.appointment.findMany({
      where: {
        doctorId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    });
  }

  async findPendingCheckoutsForDoctorInRange(doctorId: number, from: Date, to: Date) {
    return this.prisma.pendingCheckout.findMany({
      where: {
        doctorId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Verifica se o intervalo [date, date+durationMinutes) colide com qualquer
   * Appointment ou PendingCheckout existente do médico. Janela de busca alargada
   * (±1 dia) cobre durações longas sem varrer a tabela inteira. Fim exclusivo,
   * igual ao subtractBusyFromCandidates da disponibilidade.
   */
  async findOverlappingForDoctor(
    doctorId: number,
    date: Date,
    durationMinutes: number,
  ): Promise<boolean> {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const from = new Date(date.getTime() - oneDayMs);
    const to = new Date(date.getTime() + oneDayMs);

    const [appointments, pendingCheckouts] = await Promise.all([
      this.findAppointmentsForDoctorInRange(doctorId, from, to),
      this.findPendingCheckoutsForDoctorInRange(doctorId, from, to),
    ]);

    const candidate = {
      startMs: date.getTime(),
      endMs: date.getTime() + durationMinutes * 60 * 1000,
    };

    const rows = [...appointments, ...pendingCheckouts];
    return rows.some((r) =>
      intervalsOverlap(candidate, {
        startMs: r.date.getTime(),
        endMs: r.date.getTime() + (r.durationMinutes || 60) * 60 * 1000,
      }),
    );
  }

  /**
   * Cancela a consulta. Paciente só cancela a própria e até 24h antes;
   * médico cancela qualquer uma da própria agenda, sem janela. Idempotente:
   * recancelar uma consulta já CANCELLED é no-op. A transição roda em transação;
   * marcar CANCELLED libera o slot (queries de range filtram canceladas; índice
   * unique de slot é parcial e ignora CANCELLED).
   */
  async cancel(appointmentId: number, userId: number, role: 'PATIENT' | 'DOCTOR', reason?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException('Consulta não encontrada');
    }

    const isOwner =
      role === 'PATIENT' ? appointment.patientId === userId : appointment.doctorId === userId;
    if (!isOwner) {
      throw new ForbiddenException('Você não pode cancelar esta consulta');
    }

    if (appointment.status === 'CANCELLED') {
      return appointment;
    }

    if (role === 'PATIENT') {
      const leadMs = appointment.date.getTime() - Date.now();
      if (leadMs < PATIENT_CANCEL_MIN_LEAD_MS) {
        throw new BadRequestException('Cancelamento permitido até 24h antes da consulta');
      }
    }

    return this.prisma.$transaction(async (tx) =>
      tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason ?? null,
          cancelledBy: role,
        },
      }),
    );
  }
}
