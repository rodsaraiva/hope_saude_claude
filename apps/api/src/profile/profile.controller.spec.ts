import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: jest.Mocked<
    Pick<
      ProfileService,
      | 'listDoctors'
      | 'getDoctorProfileByUserId'
      | 'createDoctorProfile'
      | 'upsertPatientProfile'
      | 'getDoctorProfile'
      | 'getPatientProfile'
      | 'updateAvailability'
    >
  >;

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
            upsertPatientProfile: jest.fn(),
            getDoctorProfile: jest.fn(),
            getPatientProfile: jest.fn(),
            updateAvailability: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProfileController>(ProfileController);
    profileService = module.get(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listDoctors', () => {
    it('should list all doctors without specialty param', async () => {
      profileService.listDoctors.mockResolvedValue([]);
      const result = await controller.listDoctors();
      expect(profileService.listDoctors).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([]);
    });

    it('should list doctors by specialty', async () => {
      profileService.listDoctors.mockResolvedValue([]);
      const result = await controller.listDoctors('Cardiologia');
      expect(profileService.listDoctors).toHaveBeenCalledWith('Cardiologia');
      expect(result).toEqual([]);
    });
  });

  describe('getDoctorByUserId', () => {
    it('should return doctor profile by valid userId', async () => {
      const profile = { id: 1, userId: 1, specialty: 'Cardiologia', crm: '123' };
      profileService.getDoctorProfileByUserId.mockResolvedValue(profile as any);

      const result = await controller.getDoctorByUserId('1');
      expect(profileService.getDoctorProfileByUserId).toHaveBeenCalledWith(1);
      expect(result).toEqual(profile);
    });

    it('should throw NotFoundException for non-numeric userId', async () => {
      await expect(controller.getDoctorByUserId('abc')).rejects.toThrow(NotFoundException);
      expect(profileService.getDoctorProfileByUserId).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if profile not found', async () => {
      profileService.getDoctorProfileByUserId.mockResolvedValue(null);
      await expect(controller.getDoctorByUserId('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setupDoctor', () => {
    it('should create doctor profile if role is DOCTOR', async () => {
      const data = { specialty: 'Cardiologia' };
      profileService.createDoctorProfile.mockResolvedValue({ id: 1, userId: 1, ...data } as any);

      const result = await controller.setupDoctor({ user: { userId: 1, role: 'DOCTOR' } }, data);
      expect(profileService.createDoctorProfile).toHaveBeenCalledWith(1, data);
      expect(result).toEqual({ id: 1, userId: 1, ...data });
    });

    it('should throw ForbiddenException if role is not DOCTOR', async () => {
      await expect(
        controller.setupDoctor({ user: { userId: 2, role: 'PATIENT' } }, {})
      ).rejects.toThrow(ForbiddenException);
      expect(profileService.createDoctorProfile).not.toHaveBeenCalled();
    });
  });

  describe('setupPatient', () => {
    it('should upsert patient profile if role is PATIENT', async () => {
      const data = { cpf: '123' };
      profileService.upsertPatientProfile.mockResolvedValue({ id: 2, userId: 2, ...data } as any);

      const result = await controller.setupPatient({ user: { userId: 2, role: 'PATIENT' } }, data);
      expect(profileService.upsertPatientProfile).toHaveBeenCalledWith(2, data);
      expect(result).toEqual({ id: 2, userId: 2, ...data });
    });

    it('should throw ForbiddenException if role is not PATIENT', async () => {
      await expect(
        controller.setupPatient({ user: { userId: 1, role: 'DOCTOR' } }, {})
      ).rejects.toThrow(ForbiddenException);
      expect(profileService.upsertPatientProfile).not.toHaveBeenCalled();
    });
  });

  describe('getProfile (me)', () => {
    it('should get doctor profile if role is DOCTOR', async () => {
      const profile = { id: 1, userId: 1, specialty: 'Pediatria' };
      profileService.getDoctorProfile.mockResolvedValue(profile as any);

      const result = await controller.getProfile({ user: { userId: 1, role: 'DOCTOR' } });
      expect(profileService.getDoctorProfile).toHaveBeenCalledWith(1);
      expect(profileService.getPatientProfile).not.toHaveBeenCalled();
      expect(result).toEqual(profile);
    });

    it('should get patient profile if role is PATIENT', async () => {
      const profile = { id: 2, userId: 2, cpf: '123' };
      profileService.getPatientProfile.mockResolvedValue(profile as any);

      const result = await controller.getProfile({ user: { userId: 2, role: 'PATIENT' } });
      expect(profileService.getPatientProfile).toHaveBeenCalledWith(2);
      expect(profileService.getDoctorProfile).not.toHaveBeenCalled();
      expect(result).toEqual(profile);
    });

    it('should throw NotFoundException if profile is not configured', async () => {
      profileService.getDoctorProfile.mockResolvedValue(null);

      await expect(
        controller.getProfile({ user: { userId: 1, role: 'DOCTOR' } })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setAvailability', () => {
    it('should update availability if role is DOCTOR', async () => {
      profileService.updateAvailability.mockResolvedValue({ id: 1, userId: 1, availability: 'slots' } as any);

      const result = await controller.setAvailability(
        { user: { userId: 1, role: 'DOCTOR' } },
        { availability: 'slots' }
      );
      expect(profileService.updateAvailability).toHaveBeenCalledWith(1, 'slots');
      expect(result.availability).toBe('slots');
    });

    it('should throw ForbiddenException if role is not DOCTOR', async () => {
      await expect(
        controller.setAvailability({ user: { userId: 2, role: 'PATIENT' } }, { availability: 'slots' })
      ).rejects.toThrow(ForbiddenException);
      expect(profileService.updateAvailability).not.toHaveBeenCalled();
    });
  });
});
