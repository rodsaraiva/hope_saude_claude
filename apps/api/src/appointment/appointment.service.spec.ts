import { Test, TestingModule } from '@nestjs/testing';
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
            appointment: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
            pendingCheckout: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
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
    (prisma.pendingCheckout.findFirst as jest.Mock).mockResolvedValue({ id: 1, asaasPaymentId: 'pay_x' });
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

  it('should list appointments do médico no intervalo de datas', async () => {
    const from = new Date('2026-04-01T00:00:00.000Z');
    const to = new Date('2026-04-30T23:59:59.999Z');
    await service.findAppointmentsForDoctorInRange(7, from, to);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        doctorId: 7,
        date: { gte: from, lte: to },
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
});
