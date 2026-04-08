import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
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
        {
          provide: NotificationsService,
          useValue: { sendPasswordReset: jest.fn(), sendEmailVerification: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3001') },
        },
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

describe('AuthService.requestPasswordReset', () => {
  const makeUser = () => ({
    id: 42,
    email: 'maria@test.com',
    name: 'Maria',
    role: 'PATIENT',
    password: 'hash',
  });

  function makeService(
    overrides: {
      findUnique?: jest.Mock;
      createToken?: jest.Mock;
      sendReset?: jest.Mock;
      configGet?: jest.Mock;
    } = {},
  ) {
    const prisma = {
      user: { findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(makeUser()) },
      passwordResetToken: { create: overrides.createToken ?? jest.fn().mockResolvedValue({}) },
    } as unknown as import('../prisma.service').PrismaService;
    const notifications = {
      sendPasswordReset: overrides.sendReset ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as import('../notifications/notifications.service').NotificationsService;
    const config = {
      get: overrides.configGet ?? jest.fn().mockReturnValue('https://app.test'),
    } as unknown as import('@nestjs/config').ConfigService;
    const jwt = {} as import('@nestjs/jwt').JwtService;
    return {
      service: new AuthService(prisma, jwt, notifications, config),
      prisma,
      notifications,
      config,
    };
  }

  it('usuário existente: cria token hashed, envia email, não vaza token claro', async () => {
    const createToken = jest.fn().mockResolvedValue({});
    const sendReset = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService({ createToken, sendReset });

    await service.requestPasswordReset('maria@test.com');

    expect(createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 42,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    const savedHash = (createToken.mock.calls[0][0] as { data: { tokenHash: string } }).data
      .tokenHash;
    expect(savedHash).toMatch(/^[a-f0-9]{64}$/);

    expect(sendReset).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'maria@test.com',
        userName: 'Maria',
        resetUrl: expect.stringContaining('https://app.test/reset-password?token='),
      }),
    );
    const url: string = (sendReset.mock.calls[0][0] as { resetUrl: string }).resetUrl;
    expect(url).not.toContain(savedHash);
  });

  it('usuário inexistente: não cria token, não envia email, não lança', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const createToken = jest.fn();
    const sendReset = jest.fn();
    const { service } = makeService({ findUnique, createToken, sendReset });

    await expect(service.requestPasswordReset('naoexiste@test.com')).resolves.toBeUndefined();
    expect(createToken).not.toHaveBeenCalled();
    expect(sendReset).not.toHaveBeenCalled();
  });
});
