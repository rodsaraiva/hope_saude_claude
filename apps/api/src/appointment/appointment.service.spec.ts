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
            appointment: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create an appointment with PENDING status', async () => {
    const data = { patientId: 1, doctorId: 2, date: new Date() };
    await service.createAppointment(data);
    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: { ...data, status: 'PENDING' },
    });
  });

  it('should update appointment status', async () => {
    await service.updateStatus(1, 'CONFIRMED');
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'CONFIRMED' },
    });
  });
});
