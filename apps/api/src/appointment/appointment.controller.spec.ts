import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

describe('AppointmentController', () => {
  let controller: AppointmentController;
  let appointmentService: jest.Mocked<Pick<AppointmentService, 'getDoctorAppointments' | 'getPatientAppointments'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [
        {
          provide: AppointmentService,
          useValue: {
            getDoctorAppointments: jest.fn(),
            getPatientAppointments: jest.fn(),
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
});
