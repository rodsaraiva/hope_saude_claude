import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';
import { ProfileService } from '../profile/profile.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let asaasService: AsaasService;
  let appointmentService: AppointmentService;
  let profileService: ProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: AsaasService,
          useValue: {
            createPayment: jest.fn(),
            getPixQrCode: jest.fn(),
            findCustomerIdByCpf: jest.fn(),
            createCustomer: jest.fn(),
            receiveInSandbox: jest.fn(),
          },
        },
        {
          provide: AppointmentService,
          useValue: {
            createPendingCheckout: jest.fn(),
            findPendingCheckoutByPatientAndPayment: jest.fn(),
            createConfirmedAppointment: jest.fn(),
            deletePendingCheckout: jest.fn(),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getPatientProfile: jest.fn(),
            updateAsaasCustomerId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    asaasService = module.get<AsaasService>(AsaasService);
    appointmentService = module.get<AppointmentService>(AppointmentService);
    profileService = module.get<ProfileService>(ProfileService);
  });

  it('should fetch patient CPF and use ensureAsaasCustomerId for PIX without blocking on QR', async () => {
    (profileService.getPatientProfile as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (asaasService.createPayment as jest.Mock).mockResolvedValue({
      id: 'pay_123',
      invoiceUrl: 'http://asaas.com/pay_123',
    });
    (appointmentService.createPendingCheckout as jest.Mock).mockResolvedValue({ id: 1 });

    const user = { userId: 7, name: 'João', email: 'joao@test.com' };

    const result = await service.processCheckout(user, {
      doctorId: 42,
      date: '2026-06-15T14:00:00.000Z',
    });

    expect(profileService.getPatientProfile).toHaveBeenCalledWith(7);
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

    const result = await service.getPixQrData(7, 'pay_123');

    expect(appointmentService.findPendingCheckoutByPatientAndPayment).toHaveBeenCalledWith(7, 'pay_123');
    expect(asaasService.getPixQrCode).toHaveBeenCalledWith('pay_123');
    expect(result).toEqual({
      pixQrCode: 'qr_image',
      pixCode: 'pix_code',
      pixExpiresAt: '2026-06-16T12:00:00Z',
    });
  });

  it('should confirm payment manual, creating appointment and deleting pending', async () => {
    const pending = {
      id: 55,
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-04-03T10:00:00Z'),
      asaasPaymentId: 'pay_manual_123',
      price: 200,
      durationMinutes: 45,
      consultationModelId: 10,
    };
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(pending);
    (asaasService.receiveInSandbox as jest.Mock).mockResolvedValue({ id: 'pay_manual_123' });

    const result = await service.confirmPayment(1, 'pay_manual_123');

    expect(asaasService.receiveInSandbox).toHaveBeenCalledWith('pay_manual_123');
    expect(appointmentService.createConfirmedAppointment).toHaveBeenCalledWith({
      patientId: 1,
      doctorId: 2,
      date: pending.date,
      paymentId: 'pay_manual_123',
      consultationModelId: 10,
      price: 200,
      durationMinutes: 45,
    });
    expect(appointmentService.deletePendingCheckout).toHaveBeenCalledWith(55);
    expect(result).toEqual({ success: true });
  });

  it('should confirm payment manual even if Asaas Sandbox fails (maybe already received)', async () => {
    const pending = {
      id: 56,
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-04-03T10:00:00Z'),
      asaasPaymentId: 'pay_manual_fail',
      price: 200,
      durationMinutes: 45,
    };
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(pending);
    (asaasService.receiveInSandbox as jest.Mock).mockRejectedValue(new Error('Already received'));

    const result = await service.confirmPayment(1, 'pay_manual_fail');

    expect(appointmentService.createConfirmedAppointment).toHaveBeenCalled();
    expect(appointmentService.deletePendingCheckout).toHaveBeenCalledWith(56);
    expect(result).toEqual({ success: true });
  });

  it('should process credit card checkout without PIX', async () => {
    (profileService.getPatientProfile as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (asaasService.createPayment as jest.Mock).mockResolvedValue({
      id: 'pay_cc',
      invoiceUrl: 'http://asaas.com/pay_cc',
      status: 'CONFIRMED',
    });
    (appointmentService.createPendingCheckout as jest.Mock).mockResolvedValue({ id: 1 });

    const user = { userId: 7, name: 'João', email: 'joao@test.com' };

    const result = await service.processCheckout(user, {
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

    const user = { userId: 8, name: 'Maria', email: 'maria@test.com' };

    await expect(
      service.processCheckout(user, {
        doctorId: 10,
        date: '2026-07-01T10:00:00.000Z',
      })
    ).rejects.toThrow(new BadRequestException({ code: 'MISSING_PATIENT_PROFILE', message: 'É necessário completar seu cadastro (CPF e Celular) para realizar pagamentos.' }));

    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('should reject checkout without doctorId or date', async () => {
    await expect(
      service.processCheckout({ userId: 1 }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });
});
