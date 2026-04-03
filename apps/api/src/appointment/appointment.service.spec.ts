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
            appointment: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
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

  it('should update appointment status', async () => {
    await service.updateStatus(1, 'CONFIRMED');
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'CONFIRMED' },
    });
  });
});
