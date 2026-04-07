import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { ForbiddenException } from '@nestjs/common';

describe('MedicalRecordController', () => {
  let controller: MedicalRecordController;
  let service: MedicalRecordService;

  const mockService = {
    create: jest.fn(),
    findAllByPatient: jest.fn(),
    update: jest.fn(),
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicalRecordController],
      providers: [{ provide: MedicalRecordService, useValue: mockService }],
    }).compile();

    controller = module.get<MedicalRecordController>(MedicalRecordController);
    service = module.get<MedicalRecordService>(MedicalRecordService);
    jest.clearAllMocks();
  });

  it('deve chamar o serviço para criar um prontuário', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } };
    const body = { patientId: 2, appointmentId: 10, content: '...' };

    mockService.create.mockResolvedValue({ id: 1, ...body });

    const result = await controller.create(req as any, body);

    expect(service.create).toHaveBeenCalledWith({
      doctorId: 1,
      ...body,
    });
    expect(result.id).toBe(1);
  });

  it('não deve permitir que pacientes criem prontuários', async () => {
    const req = { user: { userId: 2, role: 'PATIENT' } };
    const body = { patientId: 2, content: '...' };

    await expect(controller.create(req as any, body)).rejects.toThrow(ForbiddenException);
  });

  it('deve chamar o serviço para listar prontuários com busca', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } };
    const patientId = '2';
    const search = 'melhora';

    mockService.findAllByPatient.mockResolvedValue([{ id: 1, content: '...' }]);

    const result = await controller.findAllByPatient(req as any, patientId, search);

    expect(service.findAllByPatient).toHaveBeenCalledWith(1, 2, search);
    expect(result).toHaveLength(1);
  });

  it('paciente deve conseguir listar seus próprios prontuários', async () => {
    const req = { user: { userId: 2, role: 'PATIENT' } };
    const patientId = '2';

    mockService.findAllByPatient.mockResolvedValue([{ id: 1, content: '...' }]);

    const result = await controller.findAllByPatient(req as any, patientId);

    expect(service.findAllByPatient).toHaveBeenCalledWith(undefined, 2, undefined);
    expect(result).toHaveLength(1);
  });

  it('paciente não deve conseguir listar prontuários de outro paciente', async () => {
    const req = { user: { userId: 2, role: 'PATIENT' } };
    const patientId = '3'; // Outro paciente

    await expect(controller.findAllByPatient(req as any, patientId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deve chamar o serviço para atualizar um prontuário', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } };
    const id = '1';
    const body = { content: 'Conteúdo novo' };

    mockService.update.mockResolvedValue({ id: 1, content: 'Conteúdo novo' });

    const result = await controller.update(req as any, id, body);

    expect(service.update).toHaveBeenCalledWith(1, 1, 'Conteúdo novo', undefined);
    expect(result.content).toBe('Conteúdo novo');
  });

  it('deve chamar o serviço para assinar um prontuário (sem authData)', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } };
    const id = '1';

    mockService.sign.mockResolvedValue({ id: 1, status: 'SIGNED' });

    const result = await controller.sign(req as any, id);

    expect(service.sign).toHaveBeenCalledWith(1, 1, undefined);
    expect(result.status).toBe('SIGNED');
  });

  it('deve encaminhar authData ao serviço quando fornecido no body', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } };
    const id = '7';
    const body = { authData: { code: 'otp-123' } };

    mockService.sign.mockResolvedValue({ id: 7, status: 'SIGNED' });

    await controller.sign(req as any, id, body);

    expect(service.sign).toHaveBeenCalledWith(1, 7, { code: 'otp-123' });
  });

  it('bloqueia paciente de assinar prontuário', async () => {
    const req = { user: { userId: 9, role: 'PATIENT' } };

    await expect(controller.sign(req as any, '1')).rejects.toThrow(/Apenas médicos/);
    expect(service.sign).not.toHaveBeenCalled();
  });
});
