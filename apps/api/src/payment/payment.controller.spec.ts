import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';
import { ProfileService } from '../profile/profile.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let asaasService: AsaasService;
  let appointmentService: AppointmentService;
  let profileService: ProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: AsaasService,
          useValue: {
            createPayment: jest.fn(),
            getPixQrCode: jest.fn(),
          },
        },
        {
          provide: AppointmentService,
          useValue: {
            updateStatus: jest.fn(),
            createPendingCheckout: jest.fn(),
            findPendingCheckoutByPatientAndPayment: jest.fn(),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getPatientProfile: jest.fn(),
            ensureAsaasCustomerId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    asaasService = module.get<AsaasService>(AsaasService);
    appointmentService = module.get<AppointmentService>(AppointmentService);
    profileService = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should fetch patient CPF and use ensureAsaasCustomerId for PIX without blocking on QR', async () => {
    (profileService.getPatientProfile as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
    });
    (profileService.ensureAsaasCustomerId as jest.Mock).mockResolvedValue('cus_123');
    (asaasService.createPayment as jest.Mock).mockResolvedValue({
      id: 'pay_123',
      invoiceUrl: 'http://asaas.com/pay_123',
    });
    (appointmentService.createPendingCheckout as jest.Mock).mockResolvedValue({ id: 1 });

    const req = {
      user: { userId: 7, name: 'João', email: 'joao@test.com' },
    } as any;

    const result = await controller.checkout(req, {
      doctorId: 42,
      date: '2026-06-15T14:00:00.000Z',
    });

    expect(profileService.getPatientProfile).toHaveBeenCalledWith(7);
    expect(profileService.ensureAsaasCustomerId).toHaveBeenCalledWith(
      7,
      'João',
      'joao@test.com',
      '12345678909',
    );
    expect(asaasService.createPayment).toHaveBeenCalledWith(
      'cus_123',
      150,
      'PIX',
      'Consulta Psiquiátrica — pagamento (Dr. user 42)',
    );
    expect(asaasService.getPixQrCode).not.toHaveBeenCalled();
    expect(result).toEqual({
      paymentId: 'pay_123',
      invoiceUrl: 'http://asaas.com/pay_123',
      paymentMethod: 'PIX',
      value: 150,
      pixQrPending: true,
    });
  });

  it('should return PIX QR on getPixQrData when pending checkout matches patient', async () => {
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue({
      id: 1,
      asaasPaymentId: 'pay_123',
    });
    (asaasService.getPixQrCode as jest.Mock).mockResolvedValue({
      encodedImage: 'qr_image',
      payload: 'pix_code',
      expirationDate: '2026-06-16T12:00:00Z',
    });

    const req = { user: { userId: 7 } } as any;
    const result = await controller.getPixQrData(req, 'pay_123');

    expect(appointmentService.findPendingCheckoutByPatientAndPayment).toHaveBeenCalledWith(7, 'pay_123');
    expect(asaasService.getPixQrCode).toHaveBeenCalledWith('pay_123');
    expect(result).toEqual({
      pixQrCode: 'qr_image',
      pixCode: 'pix_code',
      pixExpiresAt: '2026-06-16T12:00:00Z',
    });
  });

  it('should process credit card checkout without PIX', async () => {
    (profileService.getPatientProfile as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
    });
    (profileService.ensureAsaasCustomerId as jest.Mock).mockResolvedValue('cus_123');
    (asaasService.createPayment as jest.Mock).mockResolvedValue({
      id: 'pay_cc',
      invoiceUrl: 'http://asaas.com/pay_cc',
      status: 'CONFIRMED',
    });
    (appointmentService.createPendingCheckout as jest.Mock).mockResolvedValue({ id: 1 });

    const req = {
      user: { userId: 7, name: 'João', email: 'joao@test.com' },
    } as any;

    const result = await controller.checkout(req, {
      doctorId: 42,
      date: '2026-06-15T14:00:00.000Z',
      paymentMethod: 'CREDIT_CARD',
      creditCard: {
        holderName: 'João Silva',
        number: '5162306219378829',
        expiryMonth: '12',
        expiryYear: '2030',
        ccv: '318',
      },
      creditCardHolderInfo: {
        postalCode: '01310100',
        addressNumber: '100',
        mobilePhone: '11999999999',
      },
    });

    expect(asaasService.getPixQrCode).not.toHaveBeenCalled();
    expect(asaasService.createPayment).toHaveBeenCalledWith(
      'cus_123',
      150,
      'CREDIT_CARD',
      'Consulta Psiquiátrica — pagamento (Dr. user 42)',
      expect.objectContaining({
        creditCard: expect.objectContaining({
          holderName: 'João Silva',
          number: '5162306219378829',
        }),
      }),
    );
    expect(result).toEqual({
      paymentId: 'pay_cc',
      invoiceUrl: 'http://asaas.com/pay_cc',
      paymentMethod: 'CREDIT_CARD',
      paymentStatus: 'CONFIRMED',
    });
  });

  it('should reject checkout if patient profile is missing CPF', async () => {
    (profileService.getPatientProfile as jest.Mock).mockResolvedValue(null);

    const req = {
      user: { userId: 8, name: 'Maria', email: 'maria@test.com' },
    } as any;

    await expect(
      controller.checkout(req, {
        doctorId: 10,
        date: '2026-07-01T10:00:00.000Z',
      })
    ).rejects.toThrow(new BadRequestException({ code: 'MISSING_PATIENT_PROFILE', message: 'É necessário completar seu cadastro (CPF e Celular) para realizar pagamentos.' }));

    expect(profileService.ensureAsaasCustomerId).not.toHaveBeenCalled();
    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('should reject checkout without doctorId or date', async () => {
    await expect(
      controller.checkout({ user: { userId: 1 } } as any, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('should confirm payment and update appointment status', async () => {
    (appointmentService.updateStatus as jest.Mock).mockResolvedValue({ id: 10, status: 'CONFIRMED' });

    const result = await controller.confirm('10', { paymentId: 'pay_123' });

    expect(appointmentService.updateStatus).toHaveBeenCalledWith(10, 'CONFIRMED');
    expect(result).toEqual({ message: 'Pagamento confirmado e consulta agendada!' });
  });
});
