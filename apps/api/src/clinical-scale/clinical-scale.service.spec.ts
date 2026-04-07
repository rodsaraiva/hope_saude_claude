import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClinicalScaleService } from './clinical-scale.service';
import { PrismaService } from '../prisma.service';

describe('ClinicalScaleService', () => {
  let service: ClinicalScaleService;

  const mockPrisma = {
    clinicalScale: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ClinicalScaleService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = moduleRef.get(ClinicalScaleService);
  });

  describe('createScale', () => {
    it('cria scale com RBAC: exige relação doctor↔patient', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.createScale({ doctorId: 1, patientId: 2, type: 'PHQ9' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.clinicalScale.create).not.toHaveBeenCalled();
    });

    it('cria scale com accessToken UUID e expiresAt +14 dias', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 10 });
      mockPrisma.clinicalScale.create.mockResolvedValue({ id: 1, accessToken: 'x' });

      await service.createScale({ doctorId: 1, patientId: 2, type: 'PHQ9' });

      const call = mockPrisma.clinicalScale.create.mock.calls[0][0];
      expect(call.data.accessToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(call.data.status).toBe('PENDING');
      expect(call.data.type).toBe('PHQ9');
      const daysDiff = Math.round(
        (call.data.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBeGreaterThanOrEqual(13);
      expect(daysDiff).toBeLessThanOrEqual(14);
    });

    it('rejeita tipo de escala desconhecido', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 10 });
      await expect(
        // @ts-expect-error - tipo inválido proposital
        service.createScale({ doctorId: 1, patientId: 2, type: 'BDI' }),
      ).rejects.toThrow(/Escala desconhecida/);
    });
  });

  describe('findPublicByToken', () => {
    it('retorna definição + status quando válida', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        type: 'PHQ9',
        status: 'PENDING',
        expiresAt: future,
      });

      const result = await service.findPublicByToken('some-token');

      expect(result.type).toBe('PHQ9');
      expect(result.title).toContain('PHQ-9');
      expect(result.questions).toHaveLength(9);
      expect(result.alreadyCompleted).toBe(false);
    });

    it('404 quando token não existe', async () => {
      mockPrisma.clinicalScale.findUnique.mockResolvedValue(null);
      await expect(service.findPublicByToken('nope')).rejects.toThrow(NotFoundException);
    });

    it('400 e marca como EXPIRED quando data passou', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        type: 'PHQ9',
        status: 'PENDING',
        expiresAt: past,
      });

      await expect(service.findPublicByToken('t')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.clinicalScale.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'EXPIRED' },
      });
    });
  });

  describe('submitAnswers', () => {
    const futureDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      return d;
    };

    it('calcula score e severidade do PHQ-9 corretamente', async () => {
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        type: 'PHQ9',
        status: 'PENDING',
        expiresAt: futureDate(),
      });
      mockPrisma.clinicalScale.update.mockResolvedValue({ id: 1 });

      await service.submitAnswers('tok', [2, 2, 2, 2, 2, 2, 2, 2, 2]);

      const call = mockPrisma.clinicalScale.update.mock.calls[0][0];
      expect(call.data.totalScore).toBe(18);
      expect(call.data.severity).toBe('moderadamente grave');
      expect(call.data.status).toBe('COMPLETED');
      expect(JSON.parse(call.data.answers)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2]);
    });

    it('rejeita quando quantidade de respostas não bate', async () => {
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        type: 'PHQ9',
        status: 'PENDING',
        expiresAt: futureDate(),
      });
      await expect(service.submitAnswers('tok', [0, 0, 0])).rejects.toThrow(
        /Esperadas 9 respostas/,
      );
    });

    it('rejeita resposta fora dos valores permitidos', async () => {
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        type: 'PHQ9',
        status: 'PENDING',
        expiresAt: futureDate(),
      });
      await expect(service.submitAnswers('tok', [0, 0, 0, 0, 0, 0, 0, 0, 99])).rejects.toThrow(
        /Resposta inválida na pergunta 9/,
      );
    });

    it('rejeita re-submissão após COMPLETED', async () => {
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        type: 'PHQ9',
        status: 'COMPLETED',
        expiresAt: futureDate(),
      });
      await expect(service.submitAnswers('tok', [0, 0, 0, 0, 0, 0, 0, 0, 0])).rejects.toThrow(
        /já foi respondida/,
      );
    });
  });

  describe('findAllByPatient', () => {
    it('sem doctorId retorna todas as scales do paciente', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      await service.findAllByPatient(5);
      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith({
        where: { patientId: 5 },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('com doctorId filtra por médico (visão do médico)', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);
      await service.findAllByPatient(5, 3);
      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith({
        where: { patientId: 5, doctorId: 3 },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOneForDoctor', () => {
    it('rejeita quando médico tenta ver scale de outro', async () => {
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 999,
      });
      await expect(service.findOneForDoctor(1, 1)).rejects.toThrow(ForbiddenException);
    });

    it('retorna scale quando é do médico', async () => {
      mockPrisma.clinicalScale.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 1,
        type: 'PHQ9',
      });
      const result = await service.findOneForDoctor(1, 1);
      expect(result.id).toBe(1);
    });
  });
});
