import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

describe('AppointmentController', () => {
  let controller: AppointmentController;
  let appointmentService: jest.Mocked<Pick<AppointmentService, 'getDoctorAppointments' | 'getPatientAppointments' | 'updateStatus'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [
        {
          provide: AppointmentService,
          useValue: {
            getDoctorAppointments: jest.fn(),
            getPatientAppointments: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AppointmentController>(AppointmentController);
    appointmentService = module.get(AppointmentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyAppointments', () => {
    it('should call getDoctorAppointments if user is DOCTOR', async () => {
      const mockAppointments = [{ id: 1, date: new Date(), status: 'CONFIRMED' }];
      appointmentService.getDoctorAppointments.mockResolvedValue(mockAppointments as any);

      const result = await controller.getMyAppointments({ user: { userId: 10, role: 'DOCTOR' } });
      
      expect(appointmentService.getDoctorAppointments).toHaveBeenCalledWith(10);
      expect(appointmentService.getPatientAppointments).not.toHaveBeenCalled();
      expect(result).toEqual(mockAppointments);
    });

    it('should call getPatientAppointments if user is PATIENT', async () => {
      const mockAppointments = [{ id: 2, date: new Date(), status: 'PENDING' }];
      appointmentService.getPatientAppointments.mockResolvedValue(mockAppointments as any);

      const result = await controller.getMyAppointments({ user: { userId: 20, role: 'PATIENT' } });
      
      expect(appointmentService.getPatientAppointments).toHaveBeenCalledWith(20);
      expect(appointmentService.getDoctorAppointments).not.toHaveBeenCalled();
      expect(result).toEqual(mockAppointments);
    });
  });

  describe('confirm', () => {
    it('should call updateStatus if user is DOCTOR', async () => {
      const updated = { id: 5, status: 'CONFIRMED' };
      appointmentService.updateStatus.mockResolvedValue(updated as any);

      const result = await controller.confirm({ user: { userId: 10, role: 'DOCTOR' } }, '5');
      
      expect(appointmentService.updateStatus).toHaveBeenCalledWith(5, 'CONFIRMED');
      expect(result).toEqual(updated);
    });

    it('should throw ForbiddenException if user is not DOCTOR', async () => {
      await expect(
        controller.confirm({ user: { userId: 20, role: 'PATIENT' } }, '5')
      ).rejects.toThrow(ForbiddenException);

      expect(appointmentService.updateStatus).not.toHaveBeenCalled();
    });
  });
});
