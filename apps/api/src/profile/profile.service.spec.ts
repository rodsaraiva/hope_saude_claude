import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma.service';
import { PaymentService } from '../payment/payment.service';
import { CryptographyService } from '../common/cryptography.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: PrismaService;
  let paymentService: PaymentService;
  let crypto: { encryptNullable: jest.Mock; decryptNullable: jest.Mock };

  beforeEach(async () => {
    crypto = {
      encryptNullable: jest.fn((v) => (v == null ? null : `ENC(${v})`)),
      decryptNullable: jest.fn((v) => {
        if (v == null) return null;
        const m = /^ENC\((.*)\)$/.exec(v);
        return m ? m[1] : v;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: {
            doctorProfile: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            patientProfile: {
              create: jest.fn(),
              findUnique: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
            },
            consultationModel: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            user: { findUnique: jest.fn() },
          },
        },
        {
          provide: PaymentService,
          useValue: {
            ensureAsaasCustomerId: jest.fn(),
          },
        },
        {
          provide: CryptographyService,
          useValue: crypto,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prisma = module.get<PrismaService>(PrismaService);
    paymentService = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a doctor profile', async () => {
    const data = { specialty: 'Psiquiatria', crm: '123456' };
    await service.createDoctorProfile(1, data);
    expect(prisma.doctorProfile.create).toHaveBeenCalledWith({
      data: { ...data, userId: 1 },
    });
  });

  it('upsert do patient profile encripta o CPF antes de persistir e devolve decriptado', async () => {
    const data = { phone: '11999999999', cpf: '12345678909', medicalHistory: '' };
    const persisted = {
      id: 1,
      userId: 5,
      phone: '11999999999',
      cpf: 'ENC(12345678909)',
      medicalHistory: '',
      asaasCustomerId: 'cus_already',
    };
    (prisma.patientProfile.upsert as jest.Mock).mockResolvedValue(persisted);

    const result = await service.upsertPatientProfile(5, data);

    expect(crypto.encryptNullable).toHaveBeenCalledWith('12345678909');
    expect(prisma.patientProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 5 },
      update: { ...data, cpf: 'ENC(12345678909)' },
      create: { ...data, cpf: 'ENC(12345678909)', userId: 5 },
    });
    // Resultado retornado para o chamador deve vir decriptado
    expect(result.cpf).toBe('12345678909');
  });

  it('getPatientProfile decripta o CPF antes de devolver', async () => {
    (prisma.patientProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 5,
      cpf: 'ENC(12345678909)',
      phone: '11999999999',
      user: { id: 5, name: 'P' },
    });

    const result = await service.getPatientProfile(5);

    expect(crypto.decryptNullable).toHaveBeenCalledWith('ENC(12345678909)');
    expect(result?.cpf).toBe('12345678909');
  });

  it('getPatientProfile devolve null quando perfil inexistente (sem crash)', async () => {
    (prisma.patientProfile.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await service.getPatientProfile(999);
    expect(result).toBeNull();
  });

  it('should update doctor availability with JSON válido', async () => {
    const json = JSON.stringify([{ day: 'Segunda', start: '08:00', end: '12:00', id: 1 }]);
    await service.updateAvailability(1, json);
    expect(prisma.doctorProfile.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { availability: json },
    });
  });

  describe('Consultation Models', () => {
    it('deve criar um modelo de consulta', async () => {
      const profile = { id: 10, userId: 1 };
      (prisma.doctorProfile.findUnique as jest.Mock).mockResolvedValue(profile);
      (prisma.consultationModel.create as jest.Mock).mockResolvedValue({ ...profile, id: 1 });

      await service.createConsultationModel(1, { name: 'Padrão', durationMinutes: 60, price: 150 });

      expect(prisma.consultationModel.create).toHaveBeenCalledWith({
        data: {
          doctorProfileId: 10,
          name: 'Padrão',
          durationMinutes: 60,
          price: 150,
        },
      });
    });

    it('deve atualizar um modelo de consulta existente', async () => {
      const profile = { id: 10, userId: 1 };
      (prisma.doctorProfile.findUnique as jest.Mock).mockResolvedValue(profile);
      (prisma.consultationModel.findFirst as jest.Mock).mockResolvedValue({
        id: 5,
        doctorProfileId: 10,
      });

      await service.updateConsultationModel(1, 5, {
        name: 'Atualizado',
        durationMinutes: 45,
        price: 120,
      });

      expect(prisma.consultationModel.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { name: 'Atualizado', durationMinutes: 45, price: 120 },
      });
    });

    it('deve excluir um modelo de consulta existente', async () => {
      const profile = { id: 10, userId: 1 };
      (prisma.doctorProfile.findUnique as jest.Mock).mockResolvedValue(profile);
      (prisma.consultationModel.findFirst as jest.Mock).mockResolvedValue({
        id: 5,
        doctorProfileId: 10,
      });

      await service.deleteConsultationModel(1, 5);

      expect(prisma.consultationModel.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
    });
  });
});
