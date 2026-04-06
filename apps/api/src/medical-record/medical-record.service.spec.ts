import { Test, TestingModule } from '@nestjs/testing';
import { MedicalRecordService } from './medical-record.service';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';
import { SignatureProvider } from '../common/signature.provider';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('MedicalRecordService', () => {
  let service: MedicalRecordService;
  let prisma: PrismaService;
  let cryptoSvc: CryptographyService;
  let signatureProvider: jest.Mocked<SignatureProvider>;

  const mockPrisma = {
    medicalRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    medicalRecordAudit: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(mockPrisma)),
  };

  const mockCrypto = {
    hashContent: jest.fn().mockReturnValue('mock-hash'),
    sign: jest.fn().mockReturnValue('mock-signature'),
  };

  const mockSignatureProvider = {
    sign: jest.fn().mockResolvedValue({
      signature: 'signed-data',
      hash: 'content-hash',
      signatureDate: new Date(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptographyService, useValue: mockCrypto },
        { provide: 'SignatureProvider', useValue: mockSignatureProvider },
      ],
    }).compile();

    service = module.get<MedicalRecordService>(MedicalRecordService);
    prisma = module.get<PrismaService>(PrismaService);
    cryptoSvc = module.get<CryptographyService>(CryptographyService);
    signatureProvider = module.get('SignatureProvider');
    jest.clearAllMocks();
  });

  it('deve criar um prontuário vinculado a um agendamento', async () => {
    const doctorId = 1;
    const patientId = 2;
    const appointmentId = 10;
    const content = 'Paciente apresenta melhoras...';

    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: appointmentId,
      doctorId,
      patientId,
    });

    mockPrisma.medicalRecord.create.mockResolvedValue({
      id: 1,
      doctorId,
      patientId,
      appointmentId,
      content,
    });

    const result = await service.create({
      doctorId,
      patientId,
      appointmentId,
      content,
    });

    expect(prisma.appointment.findUnique).toHaveBeenCalledWith({ where: { id: appointmentId } });
    expect(mockPrisma.medicalRecord.create).toHaveBeenCalledWith({
      data: {
        doctorId,
        patientId,
        appointmentId,
        content,
        status: 'DRAFT',
        type: 'EVOLUTION',
      },
    });
    expect(result.id).toBe(1);
  });

  it('não deve criar prontuário se o agendamento não pertencer ao médico', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: 10,
      doctorId: 999, // Outro médico
      patientId: 2,
    });

    await expect(service.create({
      doctorId: 1,
      patientId: 2,
      appointmentId: 10,
      content: '...',
    })).rejects.toThrow(ForbiddenException);
  });

  it('não deve criar prontuário se não houver agendamento prévio com o paciente', async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue(null);

    await expect(service.create({
      doctorId: 1,
      patientId: 2,
      content: '...',
    })).rejects.toThrow(ForbiddenException);
  });

  it('deve listar prontuários de um paciente para um médico específico', async () => {
    const doctorId = 1;
    const patientId = 2;

    mockPrisma.medicalRecord.findMany.mockResolvedValue([
      { id: 1, content: 'Registro 1' },
      { id: 2, content: 'Registro 2' },
    ]);

    const result = await service.findAllByPatient(doctorId, patientId);

    expect(mockPrisma.medicalRecord.findMany).toHaveBeenCalledWith({
      where: { doctorId, patientId },
      include: { audits: true, doctor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(2);
  });

  it('deve listar todos os prontuários de um paciente (visão do paciente)', async () => {
    const patientId = 2;

    mockPrisma.medicalRecord.findMany.mockResolvedValue([
      { id: 1, content: 'Registro 1' },
      { id: 2, content: 'Registro 2' },
    ]);

    const result = await service.findAllByPatient(undefined, patientId);

    expect(mockPrisma.medicalRecord.findMany).toHaveBeenCalledWith({
      where: { patientId },
      include: { audits: true, doctor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(2);
  });

  it('deve listar prontuários de um paciente com filtro de busca', async () => {
    const doctorId = 1;
    const patientId = 2;
    const search = 'melhora';

    mockPrisma.medicalRecord.findMany.mockResolvedValue([
      { id: 1, content: 'Paciente apresenta melhora' },
    ]);

    const result = await service.findAllByPatient(doctorId, patientId, search);

    expect(mockPrisma.medicalRecord.findMany).toHaveBeenCalledWith({
      where: {
        doctorId,
        patientId,
        content: {
          contains: search,
        },
      },
      include: { audits: true, doctor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(1);
  });

  it('deve atualizar um prontuário existente', async () => {
    const doctorId = 1;
    const recordId = 1;
    const newContent = 'Conteúdo atualizado';

    mockPrisma.medicalRecord.findUnique.mockResolvedValue({
      id: recordId,
      doctorId,
    });

    mockPrisma.medicalRecord.update.mockResolvedValue({
      id: recordId,
      content: newContent,
    });

    const result = await service.update(doctorId, recordId, newContent);

    expect(prisma.medicalRecord.update).toHaveBeenCalledWith({
      where: { id: recordId },
      data: { content: newContent },
    });
    expect(result.content).toBe(newContent);
  });

  it('não deve permitir que outro médico atualize o prontuário', async () => {
    mockPrisma.medicalRecord.findUnique.mockResolvedValue({
      id: 1,
      doctorId: 999, // Outro médico
    });

    await expect(service.update(1, 1, '...')).rejects.toThrow(ForbiddenException);
  });

  it('não deve permitir editar um prontuário já assinado (SIGNED)', async () => {
    const doctorId = 1;
    const recordId = 1;

    mockPrisma.medicalRecord.findUnique.mockResolvedValue({
      id: recordId,
      doctorId,
      status: 'SIGNED',
    });

    await expect(service.update(doctorId, recordId, 'Novo conteúdo')).rejects.toThrow(ForbiddenException);
  });

  it('deve realizar a assinatura eletrônica corretamente usando o SignatureProvider', async () => {
    const doctorId = 1;
    const recordId = 1;
    const content = 'Conteúdo para assinar';
    const authData = { code: 'soluti-code-123' };

    mockPrisma.medicalRecord.findUnique.mockResolvedValue({
      id: recordId,
      doctorId,
      status: 'DRAFT',
      content,
    });

    mockSignatureProvider.sign.mockResolvedValue({
      signature: 'bird-id-cms-signature',
      hash: 'content-hash-sha256',
      signatureDate: new Date(),
      signerInfo: 'Dr. João Silva',
    });

    await service.sign(doctorId, recordId, authData);

    expect(mockSignatureProvider.sign).toHaveBeenCalledWith(content, authData);
    
    expect(mockPrisma.medicalRecord.update).toHaveBeenCalledWith({
      where: { id: recordId },
      data: expect.objectContaining({
        status: 'SIGNED',
        signature: 'bird-id-cms-signature',
        signedHash: 'content-hash-sha256',
        signatureDate: expect.any(Date),
        signerUserId: doctorId,
      }),
    });
  });

  it('deve criar um audit ao atualizar um prontuário', async () => {
    const doctorId = 1;
    const recordId = 1;
    const oldContent = 'Conteúdo antigo';
    const newContent = 'Conteúdo com auditoria';

    mockPrisma.medicalRecord.findUnique.mockResolvedValue({
      id: recordId,
      doctorId,
      status: 'DRAFT',
      content: oldContent,
    });

    mockPrisma.medicalRecord.update.mockResolvedValue({
      id: recordId,
      content: newContent,
    });

    await service.update(doctorId, recordId, newContent);

    expect(mockPrisma.medicalRecordAudit.create).toHaveBeenCalledWith({
      data: {
        medicalRecordId: recordId,
        content: oldContent,
        changedByUserId: doctorId,
        reason: 'Atualização do prontuário',
      },
    });
  });
});
