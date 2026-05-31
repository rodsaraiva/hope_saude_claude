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
    encryptNullable: jest.fn((v: string | null | undefined) => (v == null ? null : `ENC(${v})`)),
    decryptNullable: jest.fn((v: string | null | undefined) => {
      if (v == null) return null;
      const m = /^ENC\((.*)\)$/.exec(v);
      return m ? m[1] : v;
    }),
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
        content: `ENC(${content})`, // LGPD: encriptado em repouso
        status: 'DRAFT',
        type: 'EVOLUTION',
        template: 'FREE',
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

    await expect(
      service.create({
        doctorId: 1,
        patientId: 2,
        appointmentId: 10,
        content: '...',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('sanitiza o content (remove <script>) antes de encriptar no create', async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue({ id: 1 });
    mockPrisma.medicalRecord.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data }),
    );

    await service.create({
      doctorId: 5,
      patientId: 10,
      content: '<p>ok</p><script>alert(1)</script>',
    });

    expect(mockCrypto.encryptNullable).toHaveBeenCalledWith('<p>ok</p>');
  });

  it('não deve criar prontuário se não houver agendamento prévio com o paciente', async () => {
    mockPrisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      service.create({
        doctorId: 1,
        patientId: 2,
        content: '...',
      }),
    ).rejects.toThrow(ForbiddenException);
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
      content: 'ENC(antigo)',
    });

    mockPrisma.medicalRecord.update.mockResolvedValue({
      id: recordId,
      content: `ENC(${newContent})`,
    });

    const result = await service.update(doctorId, recordId, newContent);

    expect(prisma.medicalRecord.update).toHaveBeenCalledWith({
      where: { id: recordId },
      data: { content: `ENC(${newContent})` },
    });
    // Resultado retornado vem decriptado
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

    await expect(service.update(doctorId, recordId, 'Novo conteúdo')).rejects.toThrow(
      ForbiddenException,
    );
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

  describe('template SOAP', () => {
    it('default é FREE quando template não é informado', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 10,
        doctorId: 1,
        patientId: 2,
      });
      mockPrisma.medicalRecord.create.mockResolvedValue({ id: 1 });

      await service.create({
        doctorId: 1,
        patientId: 2,
        appointmentId: 10,
        content: 'texto',
      });

      expect(mockPrisma.medicalRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ template: 'FREE' }),
      });
    });

    it('persiste template SOAP quando informado', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 10,
        doctorId: 1,
        patientId: 2,
      });
      mockPrisma.medicalRecord.create.mockResolvedValue({ id: 1 });

      await service.create({
        doctorId: 1,
        patientId: 2,
        appointmentId: 10,
        content: '<h2>Subjetivo</h2>...',
        template: 'SOAP',
      });

      expect(mockPrisma.medicalRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ template: 'SOAP' }),
      });
    });
  });

  describe('LGPD: encriptação de content em repouso', () => {
    it('encripta content antes de persistir em create()', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 10,
        doctorId: 1,
        patientId: 2,
      });
      mockPrisma.medicalRecord.create.mockResolvedValue({
        id: 1,
        content: 'ENC(plain text content)',
      });

      await service.create({
        doctorId: 1,
        patientId: 2,
        appointmentId: 10,
        content: 'plain text content',
      });

      expect(mockCrypto.encryptNullable).toHaveBeenCalledWith('plain text content');
      expect(mockPrisma.medicalRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: 'ENC(plain text content)' }),
      });
    });

    it('decripta content ao retornar findOne()', async () => {
      mockPrisma.medicalRecord.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 1,
        content: 'ENC(stored encrypted)',
      });

      const result = await service.findOne(1, 1);

      expect(mockCrypto.decryptNullable).toHaveBeenCalledWith('ENC(stored encrypted)');
      expect(result.content).toBe('stored encrypted');
    });

    it('decripta content de cada item em findAllByPatient()', async () => {
      mockPrisma.medicalRecord.findMany.mockResolvedValue([
        { id: 1, content: 'ENC(a)' },
        { id: 2, content: 'ENC(b)' },
      ]);

      const result = await service.findAllByPatient(1, 2);

      expect(result[0].content).toBe('a');
      expect(result[1].content).toBe('b');
    });

    it('sign() chama signatureProvider com content em PLAINTEXT (não encriptado)', async () => {
      mockPrisma.medicalRecord.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 1,
        status: 'DRAFT',
        content: 'ENC(documento sensível)',
      });

      await service.sign(1, 1, { code: 'otp' });

      expect(mockSignatureProvider.sign).toHaveBeenCalledWith('documento sensível', {
        code: 'otp',
      });
    });

    it('update() encripta o novo content e o oldContent salvo no audit', async () => {
      mockPrisma.medicalRecord.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 1,
        status: 'DRAFT',
        content: 'ENC(velho)',
      });
      mockPrisma.medicalRecord.update.mockResolvedValue({ id: 1 });

      await service.update(1, 1, 'novo');

      // o audit recebe o conteúdo antigo (já encriptado pelo storage)
      expect(mockPrisma.medicalRecordAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: 'ENC(velho)' }),
      });
      // o update salva o novo content encriptado
      expect(mockPrisma.medicalRecord.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { content: 'ENC(novo)' },
      });
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
