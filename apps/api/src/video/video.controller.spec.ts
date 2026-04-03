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
        {
          provide: VideoService,
          useValue: {
            generateToken: jest.fn(),
          },
        },
        {
          provide: AppointmentService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VideoController>(VideoController);
    videoService = module.get(VideoService);
    appointmentService = module.get(AppointmentService);
  });

  it('returns token payload when appointment is CONFIRMED', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'CONFIRMED',
    } as any);
    videoService.generateToken.mockResolvedValue({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
    });

    const req = { user: { email: 'patient@test.com' } };
    const result = await controller.getToken('1', req as any);

    expect(appointmentService.findById).toHaveBeenCalledWith(1);
    expect(videoService.generateToken).toHaveBeenCalledWith('room-1', 'patient@test.com');
    expect(result).toEqual({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
    });
  });

  it('throws Forbidden when appointment is not CONFIRMED', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'PENDING',
    } as any);

    await expect(
      controller.getToken('1', { user: { email: 'a@b.com' } } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(videoService.generateToken).not.toHaveBeenCalled();
  });
});
