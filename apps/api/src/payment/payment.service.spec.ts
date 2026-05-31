import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';
import { PatientProfileRepository } from '../profile/data/patient-profile.repository';
import { DoctorProfileRepository } from '../profile/data/doctor-profile.repository';

describe('PaymentService', () => {
  let service: PaymentService;
  let asaasService: AsaasService;
  let appointmentService: AppointmentService;
  let patientRepo: PatientProfileRepository;
  let doctorRepo: DoctorProfileRepository;

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
            getPaymentStatus: jest.fn(),
          },
        },
        {
          provide: AppointmentService,
          useValue: {
            createPendingCheckout: jest.fn(),
            findPendingCheckoutByPatientAndPayment: jest.fn(),
            createConfirmedAppointment: jest.fn(),
            deletePendingCheckout: jest.fn(),
            confirmAndConsumeCheckout: jest.fn(),
            findOverlappingForDoctor: jest.fn(),
          },
        },
        {
          provide: PatientProfileRepository,
          useValue: {
            findByUserId: jest.fn(),
            updateAsaasCustomerId: jest.fn(),
          },
        },
        {
          provide: DoctorProfileRepository,
          useValue: {
            findByUserIdWithConsultationModels: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    asaasService = module.get<AsaasService>(AsaasService);
    appointmentService = module.get<AppointmentService>(AppointmentService);
    patientRepo = module.get<PatientProfileRepository>(PatientProfileRepository);
    doctorRepo = module.get<DoctorProfileRepository>(DoctorProfileRepository);
  });

  it('should fetch patient CPF and use ensureAsaasCustomerId for PIX without blocking on QR', async () => {
    (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (appointmentService.findOverlappingForDoctor as jest.Mock).mockResolvedValue(false);
    (asaasService.createPayment as jest.Mock).mockResolvedValue({
      id: 'pay_123',
      invoiceUrl: 'http://asaas.com/pay_123',
    });
    (appointmentService.createPendingCheckout as jest.Mock).mockResolvedValue({ id: 1 });

    const user = { userId: 7, name: 'João', email: 'joao@test.com', role: 'PATIENT' as const };

    const result = await service.processCheckout(user, {
      doctorId: 42,
      date: '2026-06-15T14:00:00.000Z',
    });

    expect(patientRepo.findByUserId).toHaveBeenCalledWith(7);
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

    expect(appointmentService.findPendingCheckoutByPatientAndPayment).toHaveBeenCalledWith(
      7,
      'pay_123',
    );
    expect(asaasService.getPixQrCode).toHaveBeenCalledWith('pay_123');
    expect(result).toEqual({
      pixQrCode: 'qr_image',
      pixCode: 'pix_code',
      pixExpiresAt: '2026-06-16T12:00:00Z',
    });
  });

  it('should confirm payment when Asaas status is RECEIVED via confirmAndConsumeCheckout (atômico)', async () => {
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
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(
      pending,
    );
    (asaasService.receiveInSandbox as jest.Mock).mockResolvedValue({ id: 'pay_manual_123' });
    (asaasService.getPaymentStatus as jest.Mock).mockResolvedValue({
      id: 'pay_manual_123',
      status: 'RECEIVED',
    });
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: false,
    });

    const result = await service.confirmPayment(1, 'pay_manual_123');

    expect(asaasService.receiveInSandbox).toHaveBeenCalledWith('pay_manual_123');
    expect(asaasService.getPaymentStatus).toHaveBeenCalledWith('pay_manual_123');
    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith({
      pendingCheckoutId: 55,
      patientId: 1,
      doctorId: 2,
      date: pending.date,
      paymentId: 'pay_manual_123',
      consultationModelId: 10,
      durationMinutes: 45,
      price: 200,
    });
    expect(result).toEqual({ success: true });
  });

  it('confirma como no-op idempotente quando o checkout já foi confirmado (alreadyConfirmed)', async () => {
    const pending = {
      id: 56,
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-04-03T10:00:00Z'),
      asaasPaymentId: 'pay_dup',
      price: 200,
      durationMinutes: 45,
      consultationModelId: null,
    };
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(
      pending,
    );
    (asaasService.receiveInSandbox as jest.Mock).mockResolvedValue({ id: 'pay_dup' });
    (asaasService.getPaymentStatus as jest.Mock).mockResolvedValue({
      id: 'pay_dup',
      status: 'CONFIRMED',
    });
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: true,
    });

    const result = await service.confirmPayment(1, 'pay_dup');

    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ pendingCheckoutId: 56, paymentId: 'pay_dup' }),
    );
    expect(result).toEqual({ success: true });
  });

  it('should NOT create appointment when Asaas status is not RECEIVED/CONFIRMED', async () => {
    const pending = {
      id: 56,
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-04-03T10:00:00Z'),
      asaasPaymentId: 'pay_pending',
      price: 200,
      durationMinutes: 45,
    };
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(
      pending,
    );
    (asaasService.receiveInSandbox as jest.Mock).mockResolvedValue({ id: 'pay_pending' });
    (asaasService.getPaymentStatus as jest.Mock).mockResolvedValue({
      id: 'pay_pending',
      status: 'PENDING',
    });

    await expect(service.confirmPayment(1, 'pay_pending')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(appointmentService.createConfirmedAppointment).not.toHaveBeenCalled();
    expect(appointmentService.deletePendingCheckout).not.toHaveBeenCalled();
  });

  it('should process credit card checkout without PIX', async () => {
    (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (appointmentService.findOverlappingForDoctor as jest.Mock).mockResolvedValue(false);
    (asaasService.createPayment as jest.Mock).mockResolvedValue({
      id: 'pay_cc',
      invoiceUrl: 'http://asaas.com/pay_cc',
      status: 'CONFIRMED',
    });
    (appointmentService.createPendingCheckout as jest.Mock).mockResolvedValue({ id: 1 });

    const user = { userId: 7, name: 'João', email: 'joao@test.com', role: 'PATIENT' as const };

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
    (patientRepo.findByUserId as jest.Mock).mockResolvedValue(null);

    const user = { userId: 8, name: 'Maria', email: 'maria@test.com', role: 'PATIENT' as const };

    await expect(
      service.processCheckout(user, {
        doctorId: 10,
        date: '2026-07-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('should reject checkout without doctorId or date', async () => {
    await expect(
      service.processCheckout(
        { userId: 1, email: 'a@b.com', role: 'PATIENT' as const },
        {} as unknown as Parameters<typeof service.processCheckout>[1],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('aborta com ConflictException quando o slot do médico já está ocupado, sem cobrar', async () => {
    (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (appointmentService.findOverlappingForDoctor as jest.Mock).mockResolvedValue(true);

    const user = { userId: 7, name: 'João', email: 'joao@test.com', role: 'PATIENT' as const };

    await expect(
      service.processCheckout(user, { doctorId: 42, date: '2026-06-15T14:00:00.000Z' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(asaasService.createPayment).not.toHaveBeenCalled();
    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('rejeita consultationModelId inexistente com BadRequest em vez de default silencioso', async () => {
    (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (appointmentService.findOverlappingForDoctor as jest.Mock).mockResolvedValue(false);
    (doctorRepo.findByUserIdWithConsultationModels as jest.Mock).mockResolvedValue({
      consultationModels: [{ id: 1, price: 250, durationMinutes: 50 }],
    });

    const user = { userId: 7, name: 'João', email: 'joao@test.com', role: 'PATIENT' as const };

    await expect(
      service.processCheckout(user, {
        doctorId: 42,
        date: '2026-06-15T14:00:00.000Z',
        consultationModelId: 999,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(asaasService.createPayment).not.toHaveBeenCalled();
  });

  describe('ensureAsaasCustomerId', () => {
    it('retorna o asaasCustomerId existente sem chamar o Asaas', async () => {
      (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
        id: 1,
        userId: 7,
        asaasCustomerId: 'cus_existente',
      });

      const result = await service.ensureAsaasCustomerId(7, 'Nome', 'a@b.com', '123');

      expect(result).toBe('cus_existente');
      expect(asaasService.findCustomerIdByCpf).not.toHaveBeenCalled();
      expect(asaasService.createCustomer).not.toHaveBeenCalled();
    });

    it('cria customer no Asaas quando não encontra por CPF e persiste o ID', async () => {
      (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
        id: 1,
        userId: 7,
        asaasCustomerId: null,
      });
      (asaasService.findCustomerIdByCpf as jest.Mock).mockResolvedValue(null);
      (asaasService.createCustomer as jest.Mock).mockResolvedValue({ id: 'cus_novo' });

      const result = await service.ensureAsaasCustomerId(7, 'Nome', 'a@b.com', '123.456.789-00');

      expect(asaasService.createCustomer).toHaveBeenCalled();
      expect(patientRepo.updateAsaasCustomerId).toHaveBeenCalledWith(7, 'cus_novo');
      expect(result).toBe('cus_novo');
    });
  });
});
