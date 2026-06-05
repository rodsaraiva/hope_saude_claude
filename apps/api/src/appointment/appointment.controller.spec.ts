import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

describe('AppointmentController', () => {
  let controller: AppointmentController;
  let appointmentService: jest.Mocked<
    Pick<
      AppointmentService,
      'getDoctorAppointments' | 'getPatientAppointments' | 'cancel' | 'reschedule'
    >
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [
        {
          provide: AppointmentService,
          useValue: {
            getDoctorAppointments: jest.fn(),
            getPatientAppointments: jest.fn(),
            cancel: jest.fn(),
            reschedule: jest.fn(),
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

  describe('cancel', () => {
    it('repassa role + userId + motivo para o service (PATIENT)', async () => {
      appointmentService.cancel.mockResolvedValue({ id: 1, status: 'CANCELLED' } as any);
      const result = await controller.cancel(
        { user: { userId: 20, role: 'PATIENT' } } as any,
        '1',
        { reason: 'desisti' },
      );
      expect(appointmentService.cancel).toHaveBeenCalledWith(1, 20, 'PATIENT', 'desisti');
      expect(result).toEqual({ id: 1, status: 'CANCELLED' });
    });

    it('repassa role DOCTOR', async () => {
      appointmentService.cancel.mockResolvedValue({ id: 1, status: 'CANCELLED' } as any);
      await controller.cancel({ user: { userId: 10, role: 'DOCTOR' } } as any, '1', {});
      expect(appointmentService.cancel).toHaveBeenCalledWith(1, 10, 'DOCTOR', undefined);
    });

    it('rejeita role inválida com ForbiddenException', async () => {
      await expect(
        controller.cancel({ user: { userId: 1, role: 'ADMIN' } } as any, '1', {}),
      ).rejects.toThrow('Apenas pacientes e médicos podem cancelar consultas');
      expect(appointmentService.cancel).not.toHaveBeenCalled();
    });
  });

  describe('reschedule', () => {
    it('exige newDate (BadRequestException quando ausente)', async () => {
      await expect(
        controller.reschedule({ user: { userId: 20, role: 'PATIENT' } } as any, '1', {} as any),
      ).rejects.toThrow('newDate é obrigatório');
      expect(appointmentService.reschedule).not.toHaveBeenCalled();
    });

    it('repassa role + userId + nova data para o service', async () => {
      appointmentService.reschedule.mockResolvedValue({ id: 2, status: 'CONFIRMED' } as any);
      const result = await controller.reschedule(
        { user: { userId: 20, role: 'PATIENT' } } as any,
        '1',
        { newDate: '2026-07-01T10:00:00.000Z' },
      );
      expect(appointmentService.reschedule).toHaveBeenCalledWith(
        1,
        20,
        'PATIENT',
        new Date('2026-07-01T10:00:00.000Z'),
      );
      expect(result).toEqual({ id: 2, status: 'CONFIRMED' });
    });

    it('rejeita role inválida com ForbiddenException', async () => {
      await expect(
        controller.reschedule({ user: { userId: 1, role: 'ADMIN' } } as any, '1', {
          newDate: '2026-07-01T10:00:00.000Z',
        }),
      ).rejects.toThrow('Apenas pacientes e médicos podem reagendar consultas');
    });
  });

  describe('getMyAppointments', () => {
    it('should call getDoctorAppointments if user is DOCTOR', async () => {
      const mockAppointments = [{ id: 1, date: new Date(), status: 'CONFIRMED' }];
      appointmentService.getDoctorAppointments.mockResolvedValue(mockAppointments as any);

      const result = await controller.getMyAppointments({
        user: { userId: 10, role: 'DOCTOR' },
      } as any);

      expect(appointmentService.getDoctorAppointments).toHaveBeenCalledWith(10);
      expect(appointmentService.getPatientAppointments).not.toHaveBeenCalled();
      expect(result).toEqual(mockAppointments);
    });

    it('should call getPatientAppointments if user is PATIENT', async () => {
      const mockAppointments = [{ id: 2, date: new Date(), status: 'PENDING' }];
      appointmentService.getPatientAppointments.mockResolvedValue(mockAppointments as any);

      const result = await controller.getMyAppointments({
        user: { userId: 20, role: 'PATIENT' },
      } as any);

      expect(appointmentService.getPatientAppointments).toHaveBeenCalledWith(20);
      expect(appointmentService.getDoctorAppointments).not.toHaveBeenCalled();
      expect(result).toEqual(mockAppointments);
    });
  });
});
