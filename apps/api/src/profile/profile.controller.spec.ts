import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PaymentService } from '../payment/payment.service';
import { AvailableSlotsService } from '../availability/available-slots.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: jest.Mocked<
    Pick<
      ProfileService,
      | 'listDoctors'
      | 'getDoctorProfileByUserId'
      | 'createDoctorProfile'
      | 'setupPatientProfile'
      | 'getDoctorProfile'
      | 'getPatientProfile'
      | 'updateAvailability'
      | 'createConsultationModel'
      | 'updateConsultationModel'
      | 'deleteConsultationModel'
    >
  >;
  let paymentService: jest.Mocked<Pick<PaymentService, 'ensureAsaasCustomerId'>>;
  let availableSlotsService: jest.Mocked<Pick<AvailableSlotsService, 'getAvailableSlots'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            listDoctors: jest.fn(),
            getDoctorProfileByUserId: jest.fn(),
            createDoctorProfile: jest.fn(),
            setupPatientProfile: jest.fn(),
            getDoctorProfile: jest.fn(),
            getPatientProfile: jest.fn(),
            updateAvailability: jest.fn(),
            createConsultationModel: jest.fn(),
            updateConsultationModel: jest.fn(),
            deleteConsultationModel: jest.fn(),
          },
        },
        {
          provide: AvailableSlotsService,
          useValue: {
            getAvailableSlots: jest.fn(),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            ensureAsaasCustomerId: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    profileService = module.get(ProfileService);
    paymentService = module.get(PaymentService);
    availableSlotsService = module.get(AvailableSlotsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('setupPatient', () => {
    it('should call profileService.setupPatientProfile', async () => {
      const data = { cpf: '12345678909', phone: '11999999999' };
      const reqUser = {
        userId: 2,
        role: 'PATIENT' as const,
        name: 'Test',
        email: 'test@example.com',
      };

      profileService.setupPatientProfile.mockResolvedValue({
        id: 2,
        userId: 2,
        cpf: '12345678909',
        phone: '11999999999',
        asaasCustomerId: 'cus_123',
      } as any);

      const result = await controller.setupPatient({ user: reqUser } as any, data);

      expect(profileService.setupPatientProfile).toHaveBeenCalledWith(reqUser, data);
      expect(result).toHaveProperty('asaasCustomerId', 'cus_123');
    });

    it('should throw ForbiddenException if role is not PATIENT', async () => {
      await expect(
        controller.setupPatient({ user: { userId: 1, role: 'DOCTOR' } } as any, {} as any),
      ).rejects.toThrow(ForbiddenException);
      expect(profileService.setupPatientProfile).not.toHaveBeenCalled();
    });
  });

  // Keep other tests minimal for brevity but ensure they pass
  it('should get profile me', async () => {
    profileService.getDoctorProfile.mockResolvedValue({ id: 1 } as any);
    const res = await controller.getProfile({ user: { userId: 1, role: 'DOCTOR' } } as any);
    expect(res).toBeDefined();
  });

  describe('getDoctorAvailableSlots', () => {
    it('delega ao AvailableSlotsService com intervalo válido', async () => {
      const payload = {
        timeZone: 'America/Sao_Paulo',
        slots: [{ start: '2026-04-07T17:00:00.000Z', end: '2026-04-07T18:00:00.000Z' }],
      };
      availableSlotsService.getAvailableSlots.mockResolvedValue(payload);

      const q = {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      };
      const res = await controller.getDoctorAvailableSlots('2', q as any);

      expect(availableSlotsService.getAvailableSlots).toHaveBeenCalled();
      expect(res).toEqual(payload);
    });

    it('rejeita intervalo maior que 60 dias', async () => {
      await expect(
        controller.getDoctorAvailableSlots('1', {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-07-01T00:00:00.000Z',
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(availableSlotsService.getAvailableSlots).not.toHaveBeenCalled();
    });
  });

  describe('Consultation Models', () => {
    it('deve permitir a criação de um modelo de consulta se for doutor', async () => {
      const data = { name: 'Consulta Padrão', durationMinutes: 60, price: 150 };
      const req = { user: { userId: 1, role: 'DOCTOR' as const, email: 'd@x.com' } } as any;

      profileService.createConsultationModel.mockResolvedValue({
        id: 1,
        doctorProfileId: 1,
        ...data,
      } as any);

      const result = await controller.createConsultationModel(req, data);

      expect(profileService.createConsultationModel).toHaveBeenCalledWith(1, data);
      expect(result.id).toBe(1);
    });

    it('deve rejeitar a criação de um modelo de consulta se não for doutor', async () => {
      const data = { name: 'Consulta Padrão', durationMinutes: 60, price: 150 };
      const req = { user: { userId: 1, role: 'PATIENT' as const, email: 'p@x.com' } } as any;

      await expect(controller.createConsultationModel(req, data)).rejects.toThrow(
        ForbiddenException,
      );
      expect(profileService.createConsultationModel).not.toHaveBeenCalled();
    });

    it('deve permitir a atualização de um modelo de consulta se for doutor', async () => {
      const data = { name: 'Consulta Padrão (Atualizada)', durationMinutes: 45, price: 120 };
      const req = { user: { userId: 1, role: 'DOCTOR' as const, email: 'd@x.com' } } as any;

      profileService.updateConsultationModel.mockResolvedValue({
        id: 1,
        doctorProfileId: 1,
        ...data,
      } as any);

      const result = await controller.updateConsultationModel(req, '1', data);

      expect(profileService.updateConsultationModel).toHaveBeenCalledWith(1, 1, data);
      expect(result.name).toBe(data.name);
    });

    it('deve permitir a deleção de um modelo de consulta se for doutor', async () => {
      const req = { user: { userId: 1, role: 'DOCTOR' as const, email: 'd@x.com' } } as any;

      profileService.deleteConsultationModel.mockResolvedValue(undefined as any);

      await controller.deleteConsultationModel(req, '1');

      expect(profileService.deleteConsultationModel).toHaveBeenCalledWith(1, 1);
    });
  });
});
