import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AvailableSlotsService } from './available-slots.service';
import { ProfileService } from '../profile/profile.service';
import { AppointmentService } from '../appointment/appointment.service';

describe('AvailableSlotsService', () => {
  let service: AvailableSlotsService;
  let profileService: jest.Mocked<Pick<ProfileService, 'getDoctorProfileByUserId'>>;
  let appointmentService: jest.Mocked<
    Pick<AppointmentService, 'findAppointmentsForDoctorInRange' | 'findPendingCheckoutsForDoctorInRange'>
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailableSlotsService,
        {
          provide: ProfileService,
          useValue: {
            getDoctorProfileByUserId: jest.fn(),
          },
        },
        {
          provide: AppointmentService,
          useValue: {
            findAppointmentsForDoctorInRange: jest.fn(),
            findPendingCheckoutsForDoctorInRange: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AvailableSlotsService);
    profileService = module.get(ProfileService);
    appointmentService = module.get(AppointmentService);
  });

  it('lança BadRequestException quando from > to', async () => {
    await expect(
      service.getAvailableSlots(1, new Date('2026-04-10'), new Date('2026-04-01')),
    ).rejects.toThrow(BadRequestException);
  });

  it('lança NotFoundException quando médico não existe', async () => {
    profileService.getDoctorProfileByUserId.mockResolvedValue(null);

    await expect(
      service.getAvailableSlots(999, new Date('2026-04-01'), new Date('2026-04-07')),
    ).rejects.toThrow(NotFoundException);
  });

  it('retorna slots livres excluindo consulta confirmada no mesmo horário', async () => {
    const availability = JSON.stringify([{ day: 'Segunda', start: '08:00', end: '09:00' }]);
    profileService.getDoctorProfileByUserId.mockResolvedValue({
      userId: 1,
      availability,
    } as any);

    appointmentService.findAppointmentsForDoctorInRange.mockResolvedValue([
      { date: new Date('2026-04-06T11:00:00.000Z') },
    ] as any);
    appointmentService.findPendingCheckoutsForDoctorInRange.mockResolvedValue([]);

    const from = new Date('2026-04-04T03:00:00.000Z');
    const to = new Date('2026-04-13T02:59:59.999Z');

    const result = await service.getAvailableSlots(1, from, to);

    // 08:00 em São Paulo em 6/abr/2026 = 11:00 UTC — consulta ocupa o slot
    expect(result.slots.length).toBe(0);
  });

  it('retorna slot quando não há conflito com consulta nem checkout pendente', async () => {
    const availability = JSON.stringify([{ day: 'Terça', start: '14:00', end: '15:00' }]);
    profileService.getDoctorProfileByUserId.mockResolvedValue({
      userId: 2,
      availability,
    } as any);

    appointmentService.findAppointmentsForDoctorInRange.mockResolvedValue([]);
    appointmentService.findPendingCheckoutsForDoctorInRange.mockResolvedValue([]);

    const from = new Date('2026-04-07T03:00:00.000Z');
    const to = new Date('2026-04-14T02:59:59.999Z');

    const result = await service.getAvailableSlots(2, from, to);

    expect(result.slots.length).toBeGreaterThanOrEqual(1);
    expect(result.slots[0]).toHaveProperty('start');
    expect(result.slots[0]).toHaveProperty('end');
    expect(result.timeZone).toBe('America/Sao_Paulo');
  });

  it('deve quebrar intervalos grandes em slots de 60 min com incremento de 15 min', async () => {
    // 13:15 as 15:45 (2h30 total)
    const availability = JSON.stringify([{ day: 'Segunda', start: '13:15', end: '15:45' }]);
    profileService.getDoctorProfileByUserId.mockResolvedValue({
      userId: 3,
      availability,
    } as any);

    appointmentService.findAppointmentsForDoctorInRange.mockResolvedValue([]);
    appointmentService.findPendingCheckoutsForDoctorInRange.mockResolvedValue([]);

    // 6 de abril de 2026 é segunda (America/Sao_Paulo é UTC-3 nessa data)
    // Janela ampla para cobrir o dia 6
    const from = new Date('2026-04-06T03:00:00.000Z'); // 00:00 BRT
    const to = new Date('2026-04-07T02:59:59.999Z'); // 23:59 BRT

    const result = await service.getAvailableSlots(3, from, to);

    // Selecionáveis de 60 min começando a cada 15 min:
    // 13:15, 13:30, 13:45, 14:00, 14:15, 14:30, 14:45 (todos terminam até 15:45)
    // Total: 7 slots
    expect(result.slots.length).toBe(7);
    
    // 13:15 BRT = 16:15 UTC
    expect(result.slots[0].start).toBe('2026-04-06T16:15:00.000Z');
    // 14:45 BRT = 17:45 UTC
    expect(result.slots[6].start).toBe('2026-04-06T17:45:00.000Z');
  });
});
