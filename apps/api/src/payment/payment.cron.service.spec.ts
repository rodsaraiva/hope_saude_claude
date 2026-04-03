import { Test, TestingModule } from '@nestjs/testing';
import { PaymentCronService } from './payment.cron.service';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';

describe('PaymentCronService', () => {
  let service: PaymentCronService;
  let asaasService: AsaasService;
  let appointmentService: AppointmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentCronService,
        {
          provide: AsaasService,
          useValue: {
            getPaymentStatus: jest.fn(),
          },
        },
        {
          provide: AppointmentService,
          useValue: {
            findPendingCheckouts: jest.fn(),
            createConfirmedAppointment: jest.fn(),
            deletePendingCheckout: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentCronService>(PaymentCronService);
    asaasService = module.get<AsaasService>(AsaasService);
    appointmentService = module.get<AppointmentService>(AppointmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create confirmed appointment and remove pending checkout when payment received', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    (appointmentService.findPendingCheckouts as jest.Mock).mockResolvedValue([
      {
        id: 1,
        patientId: 10,
        doctorId: 20,
        date,
        asaasPaymentId: 'pay_111',
      },
      {
        id: 2,
        patientId: 11,
        doctorId: 21,
        date,
        asaasPaymentId: 'pay_222',
      },
    ]);

    (asaasService.getPaymentStatus as jest.Mock).mockImplementation(async (paymentId: string) => {
      if (paymentId === 'pay_111') return { status: 'RECEIVED' };
      if (paymentId === 'pay_222') return { status: 'PENDING' };
    });

    await service.handleCron();

    expect(appointmentService.findPendingCheckouts).toHaveBeenCalled();
    expect(asaasService.getPaymentStatus).toHaveBeenCalledWith('pay_111');
    expect(asaasService.getPaymentStatus).toHaveBeenCalledWith('pay_222');
    expect(appointmentService.createConfirmedAppointment).toHaveBeenCalledWith({
      patientId: 10,
      doctorId: 20,
      date,
      paymentId: 'pay_111',
    });
    expect(appointmentService.deletePendingCheckout).toHaveBeenCalledWith(1);
    expect(appointmentService.createConfirmedAppointment).not.toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_222' }),
    );
  });
});
