import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: {
            doctorProfile: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
            patientProfile: { create: jest.fn(), findUnique: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a doctor profile', async () => {
    const data = { specialty: 'Psiquiatria', crm: '123456' };
    await service.createDoctorProfile(1, data);
    expect(prisma.doctorProfile.create).toHaveBeenCalledWith({
      data: { ...data, userId: 1 },
    });
  });

  it('should update doctor availability', async () => {
    await service.updateAvailability(1, 'Seg-Sex 08:00-12:00');
    expect(prisma.doctorProfile.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { availability: 'Seg-Sex 08:00-12:00' },
    });
  });
});
