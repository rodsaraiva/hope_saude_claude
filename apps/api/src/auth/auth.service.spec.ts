import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService (TDD)', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    patientProfile: {
      create: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create a user and a patient profile when role is PATIENT', async () => {
    const userData = { email: 'patient@test.com', name: 'Patient', password: '123', role: 'PATIENT' };
    const createdUser = { id: 1, ...userData };
    
    mockPrisma.user.create.mockResolvedValue(createdUser);
    mockPrisma.patientProfile.create.mockResolvedValue({ id: 1, userId: 1 });

    const result = await service.createUser(userData);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.patientProfile.create).toHaveBeenCalledWith({ data: { userId: 1 } });
    expect(result).toEqual(createdUser);
  });

  it('should NOT create a patient profile when role is DOCTOR', async () => {
    const userData = { email: 'doctor@test.com', name: 'Doctor', password: '123', role: 'DOCTOR' };
    const createdUser = { id: 2, ...userData };
    
    mockPrisma.user.create.mockResolvedValue(createdUser);
    mockPrisma.patientProfile.create.mockClear();

    const result = await service.createUser(userData);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.patientProfile.create).not.toHaveBeenCalled();
    expect(result).toEqual(createdUser);
  });

  it('registerAndLogin cria usuário e retorna access_token como login', async () => {
    const userData = { email: 'new@test.com', name: 'N', password: 'secret12', role: 'PATIENT' as const };
    const createdUser = {
      id: 9,
      email: userData.email,
      name: userData.name,
      role: 'PATIENT',
      password: 'hashed',
    };
    mockPrisma.user.create.mockResolvedValue(createdUser);
    mockPrisma.patientProfile.create.mockResolvedValue({ id: 1, userId: 9 });
    mockJwt.sign.mockReturnValue('jwt-after-register');

    const result = await service.registerAndLogin(userData);

    expect(mockJwt.sign).toHaveBeenCalled();
    expect(result).toEqual({ access_token: 'jwt-after-register' });
  });

  it('should identify a user with DOCTOR role', () => {
    const user = { id: 1, role: 'DOCTOR' };
    expect(service.isDoctor(user)).toBe(true);
  });
});
