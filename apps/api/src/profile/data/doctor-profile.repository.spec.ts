import { Test } from '@nestjs/testing';
import { DoctorProfileRepository } from './doctor-profile.repository';
import { PrismaService } from '../../prisma.service';

describe('DoctorProfileRepository', () => {
  let repo: DoctorProfileRepository;
  let prisma: { doctorProfile: { findUnique: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      doctorProfile: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [DoctorProfileRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repo = moduleRef.get(DoctorProfileRepository);
  });

  it('findByUserIdWithConsultationModels inclui models + user (select name/email)', async () => {
    prisma.doctorProfile.findUnique.mockResolvedValue({ id: 1, userId: 9, consultationModels: [] });

    await repo.findByUserIdWithConsultationModels(9);

    expect(prisma.doctorProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 9 },
      include: {
        user: { select: { name: true, email: true } },
        consultationModels: true,
      },
    });
  });

  it('listWithFilter aceita specialty opcional', async () => {
    prisma.doctorProfile.findMany.mockResolvedValue([]);
    await repo.listWithFilter('Psiquiatria');
    expect(prisma.doctorProfile.findMany).toHaveBeenCalledWith({
      where: { specialty: 'Psiquiatria' },
      include: {
        user: { select: { name: true, email: true } },
        consultationModels: true,
      },
    });
  });

  it('listWithFilter sem specialty não aplica where', async () => {
    prisma.doctorProfile.findMany.mockResolvedValue([]);
    await repo.listWithFilter();
    expect(prisma.doctorProfile.findMany).toHaveBeenCalledWith({
      where: {},
      include: {
        user: { select: { name: true, email: true } },
        consultationModels: true,
      },
    });
  });
});
