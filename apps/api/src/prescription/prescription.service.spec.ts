import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionService } from './prescription.service';
import { PrismaService } from '../prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('PrescriptionService', () => {
  let service: PrescriptionService;
  let prisma: PrismaService;

  const mockPrisma = {
    prescription: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'SignatureProvider', useValue: {} }, // Mock do provider
      ],
    }).compile();

    service = module.get<PrescriptionService>(PrescriptionService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('deve criar uma receita vinculada a um agendamento', async () => {
    const doctorId = 1;
    const patientId = 2;
    const appointmentId = 10;
    const medications = JSON.stringify([{ name: 'Dipirona', dose: '500mg' }]);

    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: appointmentId,
      doctorId,
      patientId,
    });

    mockPrisma.prescription.create.mockResolvedValue({
      id: 1,
      doctorId,
      patientId,
      appointmentId,
      medications,
    });

    const result = await service.create({
      doctorId,
      patientId,
      appointmentId,
      medications,
    });

    expect(prisma.appointment.findUnique).toHaveBeenCalledWith({ where: { id: appointmentId } });
    expect(mockPrisma.prescription.create).toHaveBeenCalledWith({
      data: {
        doctorId,
        patientId,
        appointmentId,
        medications,
        status: 'DRAFT',
      },
    });
    expect(result.id).toBe(1);
  });

  it('não deve criar receita se o agendamento não pertencer ao médico', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: 10,
      doctorId: 999,
      patientId: 2,
    });

    await expect(service.create({
      doctorId: 1,
      patientId: 2,
      appointmentId: 10,
      medications: '[]',
    })).rejects.toThrow(ForbiddenException);
  });

  it('deve listar receitas de um paciente para um médico específico', async () => {
    const doctorId = 1;
    const patientId = 2;

    mockPrisma.prescription.findMany.mockResolvedValue([
      { id: 1, medications: '[]' },
    ]);

    const result = await service.findAllByPatient(doctorId, patientId);

    expect(mockPrisma.prescription.findMany).toHaveBeenCalledWith({
      where: { doctorId, patientId },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(1);
  });

  it('deve permitir assinar uma receita usando o SignatureProvider', async () => {
    const doctorId = 1;
    const prescriptionId = 1;
    const content = JSON.stringify({ medications: [], observations: 'Tome água' });
    const authData = { code: '123' };

    mockPrisma.prescription.findUnique.mockResolvedValue({
      id: prescriptionId,
      doctorId,
      status: 'DRAFT',
      medications: '[]',
      observations: 'Tome água',
    });

    const mockSignature = {
      signature: 'signed-data',
      hash: 'hash-data',
      signatureDate: new Date(),
    };

    const mockSigProvider = {
      sign: jest.fn().mockResolvedValue(mockSignature),
    };
    (service as any).signatureProvider = mockSigProvider;

    const result = await service.sign(doctorId, prescriptionId, authData);

    expect(mockSigProvider.sign).toHaveBeenCalled();
    expect(mockPrisma.prescription.update).toHaveBeenCalledWith({
      where: { id: prescriptionId },
      data: {
        status: 'SIGNED',
        signature: mockSignature.signature,
        signedHash: mockSignature.hash,
        signatureDate: mockSignature.signatureDate,
      },
    });
  });
});
