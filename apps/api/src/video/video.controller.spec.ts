import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { AppointmentService } from '../appointment/appointment.service';

describe('VideoController', () => {
  let controller: VideoController;
  let videoService: jest.Mocked<Pick<VideoService, 'generateToken'>>;
  let appointmentService: jest.Mocked<Pick<AppointmentService, 'findById'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoController],
      providers: [
        { provide: VideoService, useValue: { generateToken: jest.fn() } },
        { provide: AppointmentService, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    controller = module.get<VideoController>(VideoController);
    videoService = module.get(VideoService);
    appointmentService = module.get(AppointmentService);
  });

  it('returns token payload to the PATIENT of the appointment', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'CONFIRMED',
      patientId: 10,
      doctorId: 20,
      patient: { name: 'Maria Silva' },
    } as any);
    videoService.generateToken.mockResolvedValue({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
    });

    const req = { user: { userId: 10, email: 'patient@test.com', role: 'PATIENT' } };
    const result = await controller.getToken('1', req as any);

    expect(appointmentService.findById).toHaveBeenCalledWith(1);
    expect(videoService.generateToken).toHaveBeenCalledWith('room-1', 'patient@test.com');
    expect(result).toEqual({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
      appointment: {
        id: 1,
        patientId: 10,
        doctorId: 20,
        patientName: 'Maria Silva',
      },
    });
  });

  it('returns token payload to the DOCTOR of the appointment', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'CONFIRMED',
      patientId: 10,
      doctorId: 20,
      patient: { name: 'Maria Silva' },
    } as any);
    videoService.generateToken.mockResolvedValue({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
    });

    const req = { user: { userId: 20, email: 'doctor@test.com', role: 'DOCTOR' } };
    const result = await controller.getToken('1', req as any);

    expect(videoService.generateToken).toHaveBeenCalledWith('room-1', 'doctor@test.com');
    expect(result.appointment.patientName).toBe('Maria Silva');
  });

  it('throws Forbidden when requester is neither patient nor doctor (IDOR)', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'CONFIRMED',
      patientId: 10,
      doctorId: 20,
      patient: { name: 'Maria Silva' },
    } as any);

    const req = { user: { userId: 99, email: 'intruder@test.com', role: 'PATIENT' } };

    await expect(controller.getToken('1', req as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(videoService.generateToken).not.toHaveBeenCalled();
  });

  it('throws Forbidden when appointment is not CONFIRMED', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'PENDING',
      patientId: 10,
      doctorId: 20,
    } as any);

    await expect(
      controller.getToken('1', { user: { userId: 10, role: 'PATIENT' } } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(videoService.generateToken).not.toHaveBeenCalled();
  });
});
