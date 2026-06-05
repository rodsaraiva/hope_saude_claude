import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppointmentService } from './appointment.service';
import { PrismaService } from '../prisma.service';

describe('AppointmentService', () => {
  let service: AppointmentService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        {
          provide: PrismaService,
          useValue: {
            appointment: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            pendingCheckout: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create pending checkout with Asaas payment id', async () => {
    const data = {
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-05-01T10:00:00Z'),
      asaasPaymentId: 'pay_abc',
    };
    await service.createPendingCheckout(data);
    expect(prisma.pendingCheckout.create).toHaveBeenCalledWith({ data });
  });

  it('should create appointment only as CONFIRMED with paymentId', async () => {
    const data = {
      patientId: 1,
      doctorId: 2,
      date: new Date(),
      paymentId: 'pay_123',
    };
    await service.createConfirmedAppointment(data);
    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: {
        patientId: 1,
        doctorId: 2,
        date: data.date,
        status: 'CONFIRMED',
        paymentId: 'pay_123',
        consultationModelId: undefined,
        durationMinutes: 60,
        price: 150.0,
      },
    });
  });

  it('should list pending checkouts', async () => {
    await service.findPendingCheckouts();
    expect(prisma.pendingCheckout.findMany).toHaveBeenCalledWith();
  });

  it('should find pending checkout by patient and Asaas payment id', async () => {
    (prisma.pendingCheckout.findFirst as jest.Mock).mockResolvedValue({
      id: 1,
      asaasPaymentId: 'pay_x',
    });
    const row = await service.findPendingCheckoutByPatientAndPayment(3, 'pay_x');
    expect(prisma.pendingCheckout.findFirst).toHaveBeenCalledWith({
      where: { patientId: 3, asaasPaymentId: 'pay_x' },
    });
    expect(row?.asaasPaymentId).toBe('pay_x');
  });

  it('should delete pending checkout by id', async () => {
    await service.deletePendingCheckout(5);
    expect(prisma.pendingCheckout.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it('should list appointments do médico no intervalo de datas, excluindo CANCELLED', async () => {
    const from = new Date('2026-04-01T00:00:00.000Z');
    const to = new Date('2026-04-30T23:59:59.999Z');
    await service.findAppointmentsForDoctorInRange(7, from, to);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        doctorId: 7,
        date: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
      },
      orderBy: { date: 'asc' },
    });
  });

  it('should list pending checkouts do médico no intervalo de datas', async () => {
    const from = new Date('2026-04-01T00:00:00.000Z');
    const to = new Date('2026-04-30T23:59:59.999Z');
    await service.findPendingCheckoutsForDoctorInRange(7, from, to);
    expect(prisma.pendingCheckout.findMany).toHaveBeenCalledWith({
      where: {
        doctorId: 7,
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'asc' },
    });
  });

  it('confirma e consome checkout dentro de uma transação (cria consulta + apaga pendência)', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    const tx = {
      appointment: { create: jest.fn().mockResolvedValue({ id: 99 }) },
      pendingCheckout: { delete: jest.fn().mockResolvedValue({ id: 5 }) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );

    await service.confirmAndConsumeCheckout({
      pendingCheckoutId: 5,
      patientId: 10,
      doctorId: 20,
      date,
      paymentId: 'pay_111',
      consultationModelId: 7,
      durationMinutes: 45,
      price: 200,
    });

    expect(tx.appointment.create).toHaveBeenCalledWith({
      data: {
        patientId: 10,
        doctorId: 20,
        date,
        status: 'CONFIRMED',
        paymentId: 'pay_111',
        consultationModelId: 7,
        durationMinutes: 45,
        price: 200,
      },
    });
    expect(tx.pendingCheckout.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it('trata P2002 (paymentId duplicado) como no-op idempotente removendo só a pendência', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['paymentId'] },
    });
    const tx = {
      appointment: { create: jest.fn().mockRejectedValue(p2002) },
      pendingCheckout: { delete: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );
    (prisma.pendingCheckout.delete as jest.Mock).mockResolvedValue({ id: 6 });

    await expect(
      service.confirmAndConsumeCheckout({
        pendingCheckoutId: 6,
        patientId: 10,
        doctorId: 20,
        date,
        paymentId: 'pay_dup',
      }),
    ).resolves.toEqual({ alreadyConfirmed: true });

    expect(prisma.pendingCheckout.delete).toHaveBeenCalledWith({ where: { id: 6 } });
  });

  it('detecta sobreposição de slot somando Appointments e PendingCheckouts do médico', async () => {
    const start = new Date('2026-07-01T10:00:00Z'); // novo slot 10:00–11:00
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
      { date: new Date('2026-07-01T10:30:00Z'), durationMinutes: 60 }, // colide 10:30–11:30
    ]);
    (prisma.pendingCheckout.findMany as jest.Mock).mockResolvedValue([]);

    const overlap = await service.findOverlappingForDoctor(20, start, 60);

    expect(overlap).toBe(true);
  });

  it('retorna false quando não há sobreposição (slots adjacentes)', async () => {
    const start = new Date('2026-07-01T11:00:00Z'); // 11:00–12:00
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
      { date: new Date('2026-07-01T10:00:00Z'), durationMinutes: 60 }, // 10:00–11:00, fim exclusivo
    ]);
    (prisma.pendingCheckout.findMany as jest.Mock).mockResolvedValue([]);

    const overlap = await service.findOverlappingForDoctor(20, start, 60);

    expect(overlap).toBe(false);
  });

  describe('cancel', () => {
    const future = () => new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h à frente

    function mockTx(appointment: any) {
      const txUpdate = jest.fn().mockResolvedValue({ ...appointment, status: 'CANCELLED' });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
        cb({ appointment: { findUnique: jest.fn(), update: txUpdate, create: jest.fn() } }),
      );
      return { txUpdate };
    }

    it('lança NotFoundException quando a consulta não existe', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.cancel(999, 1, 'PATIENT', 'desisti')).rejects.toThrow(
        'Consulta não encontrada',
      );
    });

    it('paciente não pode cancelar consulta de outro paciente (ForbiddenException)', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        patientId: 7,
        doctorId: 2,
        date: future(),
        status: 'CONFIRMED',
        durationMinutes: 60,
      });
      await expect(service.cancel(1, 1, 'PATIENT', 'x')).rejects.toThrow(
        'Você não pode cancelar esta consulta',
      );
    });

    it('médico não pode cancelar consulta fora da própria agenda (ForbiddenException)', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        patientId: 7,
        doctorId: 99,
        date: future(),
        status: 'CONFIRMED',
        durationMinutes: 60,
      });
      await expect(service.cancel(1, 2, 'DOCTOR', 'x')).rejects.toThrow(
        'Você não pode cancelar esta consulta',
      );
    });

    it('paciente é bloqueado quando faltam menos de 24h (BadRequestException)', async () => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        patientId: 1,
        doctorId: 2,
        date: soon,
        status: 'CONFIRMED',
        durationMinutes: 60,
      });
      await expect(service.cancel(1, 1, 'PATIENT', 'x')).rejects.toThrow(
        'Cancelamento permitido até 24h antes da consulta',
      );
    });

    it('médico cancela mesmo com menos de 24h (sem janela de antecedência)', async () => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const appt = {
        id: 1,
        patientId: 7,
        doctorId: 2,
        date: soon,
        status: 'CONFIRMED',
        durationMinutes: 60,
      };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(appt);
      const { txUpdate } = mockTx(appt);
      const result = await service.cancel(1, 2, 'DOCTOR', 'imprevisto');
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancellationReason: 'imprevisto',
          cancelledBy: 'DOCTOR',
        },
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('paciente cancela com antecedência suficiente e marca CANCELLED em transação', async () => {
      const appt = {
        id: 1,
        patientId: 1,
        doctorId: 2,
        date: future(),
        status: 'CONFIRMED',
        durationMinutes: 60,
      };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(appt);
      const { txUpdate } = mockTx(appt);
      await service.cancel(1, 1, 'PATIENT', 'desisti');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancellationReason: 'desisti',
          cancelledBy: 'PATIENT',
        },
      });
    });

    it('é idempotente: cancelar consulta já CANCELLED não escreve de novo', async () => {
      const appt = {
        id: 1,
        patientId: 1,
        doctorId: 2,
        date: future(),
        status: 'CANCELLED',
        durationMinutes: 60,
      };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(appt);
      const result = await service.cancel(1, 1, 'PATIENT', 'de novo');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });
  });
});
