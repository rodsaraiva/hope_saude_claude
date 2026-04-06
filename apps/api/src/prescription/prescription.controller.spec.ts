import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { ForbiddenException } from '@nestjs/common';

describe('PrescriptionController', () => {
  let controller: PrescriptionController;
  let service: PrescriptionService;

  const mockService = {
    create: jest.fn(),
    findAllByPatient: jest.fn(),
    update: jest.fn(),
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrescriptionController],
      providers: [
        { provide: PrescriptionService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<PrescriptionController>(PrescriptionController);
    service = module.get<PrescriptionService>(PrescriptionService);
    jest.clearAllMocks();
  });

  it('deve chamar o serviço para criar uma receita', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } };
    const body = { patientId: 2, medications: '[]' };

    await controller.create(req as any, body);

    expect(service.create).toHaveBeenCalledWith({
      doctorId: 1,
      ...body,
    });
  });

  it('não deve permitir que pacientes criem receitas', async () => {
    const req = { user: { userId: 2, role: 'PATIENT' } };
    const body = { patientId: 2, medications: '[]' };

    await expect(controller.create(req as any, body)).rejects.toThrow(ForbiddenException);
  });
});
