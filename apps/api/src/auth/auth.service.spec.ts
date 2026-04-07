import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import type { NewUserInput, JwtSigningPayload } from './auth.types';

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
    const userData: NewUserInput = {
      email: 'patient@test.com',
      name: 'Patient',
      password: '123',
      role: 'PATIENT',
    };
    const createdUser = { id: 1, ...userData };

    mockPrisma.user.create.mockResolvedValue(createdUser);
    mockPrisma.patientProfile.create.mockResolvedValue({ id: 1, userId: 1 });

    const result = await service.createUser(userData);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.patientProfile.create).toHaveBeenCalledWith({ data: { userId: 1 } });
    expect(result).toEqual(createdUser);
  });

  it('should NOT create a patient profile when role is DOCTOR', async () => {
    const userData: NewUserInput = {
      email: 'doctor@test.com',
      name: 'Doctor',
      password: '123',
      role: 'DOCTOR',
    };
    const createdUser = { id: 2, ...userData };

    mockPrisma.user.create.mockResolvedValue(createdUser);
    mockPrisma.patientProfile.create.mockClear();

    const result = await service.createUser(userData);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.patientProfile.create).not.toHaveBeenCalled();
    expect(result).toEqual(createdUser);
  });

  it('registerAndLogin cria usuário e retorna access_token como login', async () => {
    const userData = {
      email: 'new@test.com',
      name: 'N',
      password: 'secret12',
      role: 'PATIENT' as const,
    };
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
    const user = { id: 1, role: 'DOCTOR' as const };
    expect(service.isDoctor(user)).toBe(true);
  });

  it('login() aceita JwtSigningPayload tipado e inclui sub/email/role', async () => {
    mockJwt.sign.mockReturnValue('jwt-x');
    const payload: JwtSigningPayload = { id: 7, email: 'x@x.com', role: 'DOCTOR' };

    const result = await service.login(payload);

    expect(mockJwt.sign).toHaveBeenCalledWith({
      email: 'x@x.com',
      sub: 7,
      role: 'DOCTOR',
    });
    expect(result).toEqual({ access_token: 'jwt-x' });
  });

  it('createUser aceita NewUserInput tipado', async () => {
    const userData: NewUserInput = {
      email: 'typed@test.com',
      name: 'Typed',
      password: 'abcdef',
      role: 'PATIENT',
    };
    mockPrisma.user.create.mockResolvedValue({ id: 30, ...userData, password: 'h' });
    mockPrisma.patientProfile.create.mockResolvedValue({ id: 30 });

    const result = await service.createUser(userData);
    expect(result.id).toBe(30);
  });
});
