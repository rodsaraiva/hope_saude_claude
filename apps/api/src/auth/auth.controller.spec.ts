import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'registerAndLogin' | 'validateUser' | 'login' | 'getPublicUserById'>
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            registerAndLogin: jest.fn(),
            validateUser: jest.fn(),
            login: jest.fn(),
            getPublicUserById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should return access_token like login (cadastro com sessão)', async () => {
      const dto = {
        email: 'test@test.com',
        password: '123456',
        name: 'Test',
        role: 'PATIENT' as const,
      };
      authService.registerAndLogin.mockResolvedValue({ access_token: 'jwt_token' });

      const result = await controller.register(dto);

      expect(authService.registerAndLogin).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ access_token: 'jwt_token' });
    });
  });

  describe('login', () => {
    it('should return login token if credentials are valid', async () => {
      const user = { id: 1, email: 'test@test.com', role: 'PATIENT' };
      authService.validateUser.mockResolvedValue(user as any);
      authService.login.mockResolvedValue({ access_token: 'jwt_token' });

      const result = await controller.login({ email: 'test@test.com', password: '123' });

      expect(authService.validateUser).toHaveBeenCalledWith('test@test.com', '123');
      expect(authService.login).toHaveBeenCalledWith(user);
      expect(result).toEqual({ access_token: 'jwt_token' });
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(controller.login({ email: 'test@test.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );

      expect(authService.validateUser).toHaveBeenCalledWith('test@test.com', 'wrong');
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('should return the basic user info', async () => {
      const publicUser = { id: 1, email: 'test@test.com', name: 'Test', role: 'PATIENT' };
      authService.getPublicUserById.mockResolvedValue(publicUser as any);

      const result = await controller.me({ user: { userId: 1 } });

      expect(authService.getPublicUserById).toHaveBeenCalledWith(1);
      expect(result).toEqual(publicUser);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      authService.getPublicUserById.mockResolvedValue(null);

      await expect(controller.me({ user: { userId: 999 } })).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDoctorProfile / getPatientProfile (roles test)', () => {
    it('should return success message for doctor profile endpoint', () => {
      const result = controller.getDoctorProfile({ user: { userId: 1, role: 'DOCTOR' } } as any);
      expect(result).toEqual({
        message: 'Acesso concedido ao perfil médico',
        user: { userId: 1, role: 'DOCTOR' },
      });
    });

    it('should return success message for patient profile endpoint', () => {
      const result = controller.getPatientProfile({ user: { userId: 2, role: 'PATIENT' } } as any);
      expect(result).toEqual({
        message: 'Acesso concedido ao perfil do paciente',
        user: { userId: 2, role: 'PATIENT' },
      });
    });
  });
});
