import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: PaymentService;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            processCheckout: jest.fn(),
            getPixQrData: jest.fn(),
            confirmPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get<PaymentService>(PaymentService);
  });

  it('should route checkout to PaymentService', async () => {
    const req = { user: { userId: 1, name: 'Test' } };
    const body = { doctorId: 2, date: '2026-06-15T14:00:00.000Z' };
    (paymentService.processCheckout as jest.Mock).mockResolvedValue({ paymentId: 'pay_123' });

    const result = await controller.checkout(req as any, body);

    expect(paymentService.processCheckout).toHaveBeenCalledWith(req.user, body);
    expect(result).toEqual({ paymentId: 'pay_123' });
  });

  it('should route getPixQrData to PaymentService', async () => {
    const req = { user: { userId: 1 } };
    (paymentService.getPixQrData as jest.Mock).mockResolvedValue({ pixQrCode: 'image' });

    const result = await controller.getPixQrData(req as any, 'pay_123');

    expect(paymentService.getPixQrData).toHaveBeenCalledWith(1, 'pay_123');
    expect(result).toEqual({ pixQrCode: 'image' });
  });

  it('should route confirmPayment to PaymentService', async () => {
    const req = { user: { userId: 1 } };
    (paymentService.confirmPayment as jest.Mock).mockResolvedValue({ success: true });

    const result = await controller.confirmPayment(req as any, 'pay_123');

    expect(paymentService.confirmPayment).toHaveBeenCalledWith(1, 'pay_123');
    expect(result).toEqual({ success: true });
  });

  it('bloqueia confirmação manual em produção (anti-fraude)', async () => {
    process.env.NODE_ENV = 'production';
    const req = { user: { userId: 7, role: 'PATIENT' } } as any;
    (paymentService.confirmPayment as jest.Mock).mockResolvedValue({ success: true });

    await expect(controller.confirmPayment(req, 'pay_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(paymentService.confirmPayment).not.toHaveBeenCalled();
  });

  it('permite confirmação manual fora de produção', async () => {
    process.env.NODE_ENV = 'development';
    const req = { user: { userId: 7, role: 'PATIENT' } } as any;
    (paymentService.confirmPayment as jest.Mock).mockResolvedValue({ success: true });

    const result = await controller.confirmPayment(req, 'pay_1');

    expect(paymentService.confirmPayment).toHaveBeenCalledWith(7, 'pay_1');
    expect(result).toEqual({ success: true });
  });
});
