import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma.service';
import { AsaasService } from '../payment/asaas.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: PrismaService;
  let asaasService: AsaasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: {
            doctorProfile: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
            patientProfile: { create: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn() },
          },
        },
        {
          provide: AsaasService,
          useValue: {
            findCustomerIdByCpf: jest.fn(),
            createCustomer: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prisma = module.get<PrismaService>(PrismaService);
    asaasService = module.get<AsaasService>(AsaasService);
  });

  it('should create a doctor profile', async () => {
    const data = { specialty: 'Psiquiatria', crm: '123456' };
    await service.createDoctorProfile(1, data);
    expect(prisma.doctorProfile.create).toHaveBeenCalledWith({
      data: { ...data, userId: 1 },
    });
  });

  it('should upsert a patient profile with cpf', async () => {
    const data = { phone: '11999999999', cpf: '12345678909', medicalHistory: '' };
    const saved = {
      id: 1,
      userId: 5,
      ...data,
      asaasCustomerId: 'cus_already',
    };
    (prisma.patientProfile.upsert as jest.Mock).mockResolvedValue(saved);
    (prisma.patientProfile.findUnique as jest.Mock).mockResolvedValue({
      ...saved,
      user: { name: 'Paciente', email: 'p@test.com' },
    });
    const result = await service.upsertPatientProfile(5, data);
    expect(prisma.patientProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 5 },
      update: data,
      create: { ...data, userId: 5 },
    });
    expect(result?.cpf).toBe('12345678909');
    expect(asaasService.createCustomer).not.toHaveBeenCalled();
  });

  it('deve vincular cliente Asaas ao salvar CPF e celular quando ainda não há customerId', async () => {
    const data = { phone: '11999999999', cpf: '12345678909', medicalHistory: '' };
    (prisma.patientProfile.upsert as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 5,
      ...data,
      asaasCustomerId: null,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 5, name: 'Maria', email: 'm@test.com' });
    (prisma.patientProfile.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 1,
        userId: 5,
        ...data,
        asaasCustomerId: null,
      })
      .mockResolvedValueOnce({
        id: 1,
        userId: 5,
        ...data,
        asaasCustomerId: 'cus_new',
        user: { name: 'Maria', email: 'm@test.com' },
      });
    (asaasService.findCustomerIdByCpf as jest.Mock).mockResolvedValue(null);
    (asaasService.createCustomer as jest.Mock).mockResolvedValue({ id: 'cus_new' });
    (prisma.patientProfile.update as jest.Mock).mockResolvedValue({});

    const result = await service.upsertPatientProfile(5, data);

    expect(asaasService.findCustomerIdByCpf).toHaveBeenCalledWith('12345678909');
    expect(asaasService.createCustomer).toHaveBeenCalledWith('Maria', 'm@test.com', '12345678909');
    expect(prisma.patientProfile.update).toHaveBeenCalledWith({
      where: { userId: 5 },
      data: { asaasCustomerId: 'cus_new' },
    });
    expect(result?.asaasCustomerId).toBe('cus_new');
  });

  it('should update doctor availability', async () => {
    await service.updateAvailability(1, 'Seg-Sex 08:00-12:00');
    expect(prisma.doctorProfile.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { availability: 'Seg-Sex 08:00-12:00' },
    });
  });

  describe('getDoctorProfileByUserId', () => {
    it('deve buscar perfil do médico pelo userId com dados do usuário', async () => {
      const mockProfile = {
        id: 1,
        userId: 42,
        specialty: 'Psiquiatria',
        crm: 'CRM123',
        availability: null,
        user: { name: 'Dr. Silva', email: 'silva@test.com' },
      };
      (prisma.doctorProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.getDoctorProfileByUserId(42);

      expect(prisma.doctorProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 42 },
        include: { user: { select: { name: true, email: true } } },
      });
      expect(result).toEqual(mockProfile);
    });

    it('deve retornar null quando não existe médico com o userId', async () => {
      (prisma.doctorProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getDoctorProfileByUserId(999);

      expect(result).toBeNull();
    });
  });
});
