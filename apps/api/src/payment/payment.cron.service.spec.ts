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
            confirmAndConsumeCheckout: jest.fn(),
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

  it('confirma via confirmAndConsumeCheckout quando pagamento RECEIVED e ignora PENDING', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    (appointmentService.findPendingCheckouts as jest.Mock).mockResolvedValue([
      {
        id: 1,
        patientId: 10,
        doctorId: 20,
        date,
        asaasPaymentId: 'pay_111',
        durationMinutes: 60,
        price: 150,
      },
      {
        id: 2,
        patientId: 11,
        doctorId: 21,
        date,
        asaasPaymentId: 'pay_222',
        durationMinutes: 60,
        price: 150,
      },
    ]);
    (asaasService.getPaymentStatus as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'pay_111') return { status: 'RECEIVED' };
      return { status: 'PENDING' };
    });
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: false,
    });

    await service.handleCron();

    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledTimes(1);
    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith({
      pendingCheckoutId: 1,
      patientId: 10,
      doctorId: 20,
      date,
      paymentId: 'pay_111',
      consultationModelId: undefined,
      durationMinutes: 60,
      price: 150,
    });
  });

  it('não reprocessa o lote se já houver um tick em execução (guarda de reentrância)', async () => {
    let release!: () => void;
    (appointmentService.findPendingCheckouts as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = service.handleCron();
    const second = service.handleCron();
    await second; // retorna de imediato sem chamar findPendingCheckouts de novo
    release();
    await first;

    expect(appointmentService.findPendingCheckouts).toHaveBeenCalledTimes(1);
  });

  it('Asaas indisponível num pagamento não derruba o restante do lote', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    (appointmentService.findPendingCheckouts as jest.Mock).mockResolvedValue([
      {
        id: 1,
        patientId: 10,
        doctorId: 20,
        date,
        asaasPaymentId: 'pay_down',
        durationMinutes: 60,
        price: 150,
      },
      {
        id: 2,
        patientId: 11,
        doctorId: 21,
        date,
        asaasPaymentId: 'pay_ok',
        durationMinutes: 60,
        price: 150,
      },
    ]);
    (asaasService.getPaymentStatus as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'pay_down') throw new Error('Asaas timeout');
      return { status: 'RECEIVED' };
    });
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: false,
    });

    await expect(service.handleCron()).resolves.toBeUndefined();

    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledTimes(1);
    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_ok' }),
    );
  });
});
