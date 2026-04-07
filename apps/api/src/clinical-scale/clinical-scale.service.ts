import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { getScaleDefinition, type ScaleType } from './scales/scale-definitions';

const SCALE_EXPIRATION_DAYS = 14;

/**
 * ClinicalScaleService — gerencia o ciclo de vida de escalas psicométricas.
 *
 * Fluxo:
 * 1. Médico cria uma scale para um paciente → acessToken é gerado
 * 2. Paciente acessa `/clinical-scales/public/:token` (sem auth) → recebe as
 *    perguntas
 * 3. Paciente submete respostas via `POST /.../answers` → service calcula
 *    score e severidade automaticamente
 * 4. Médico vê resultado atrelado ao paciente e histórico longitudinal
 *
 * Notas:
 * - Token é um UUID v4 gerado por crypto.randomUUID()
 * - Expira em 14 dias (campo expiresAt) — após isso status vira EXPIRED
 * - RBAC: doctor só vê suas próprias scales; patient vê as próprias
 */
@Injectable()
export class ClinicalScaleService {
  constructor(private prisma: PrismaService) {}

  /** Gera uma nova scale e devolve o token de acesso público. */
  async createScale(data: {
    doctorId: number;
    patientId: number;
    type: ScaleType;
    notes?: string;
  }) {
    // Valida tipo
    getScaleDefinition(data.type);

    // Exige relação prévia (RBAC): doctor deve ter atendido o patient
    const hasRelation = await this.prisma.appointment.findFirst({
      where: { doctorId: data.doctorId, patientId: data.patientId },
    });
    if (!hasRelation) {
      throw new ForbiddenException(
        'Você não possui consultas prévias com este paciente para aplicar escalas.',
      );
    }

    const accessToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SCALE_EXPIRATION_DAYS);

    return this.prisma.clinicalScale.create({
      data: {
        doctorId: data.doctorId,
        patientId: data.patientId,
        type: data.type,
        status: 'PENDING',
        accessToken,
        notes: data.notes,
        expiresAt,
      },
    });
  }

  /**
   * Leitura pública por token. Retorna definição da escala + status da scale,
   * mas NÃO expõe IDs diretos (patientId/doctorId) — o paciente não precisa
   * dessas informações para preencher.
   */
  async findPublicByToken(token: string) {
    const scale = await this.prisma.clinicalScale.findUnique({
      where: { accessToken: token },
    });
    if (!scale) {
      throw new NotFoundException('Escala não encontrada ou link inválido.');
    }
    if (scale.status === 'EXPIRED' || scale.expiresAt < new Date()) {
      // Marca como expirada se ainda não estiver
      if (scale.status !== 'EXPIRED') {
        await this.prisma.clinicalScale.update({
          where: { id: scale.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new BadRequestException('Este link de escala expirou.');
    }

    const definition = getScaleDefinition(scale.type);
    return {
      type: scale.type as ScaleType,
      status: scale.status,
      title: definition.title,
      description: definition.description,
      questions: definition.questions,
      maxScore: definition.maxScore,
      alreadyCompleted: scale.status === 'COMPLETED',
    };
  }

  /**
   * Submete respostas anônimas via token público.
   * Calcula score e severidade automaticamente.
   */
  async submitAnswers(token: string, answers: number[]) {
    const scale = await this.prisma.clinicalScale.findUnique({
      where: { accessToken: token },
    });
    if (!scale) {
      throw new NotFoundException('Escala não encontrada ou link inválido.');
    }
    if (scale.status === 'COMPLETED') {
      throw new BadRequestException('Esta escala já foi respondida.');
    }
    if (scale.status === 'EXPIRED' || scale.expiresAt < new Date()) {
      throw new BadRequestException('Este link de escala expirou.');
    }

    const definition = getScaleDefinition(scale.type);
    if (!Array.isArray(answers) || answers.length !== definition.questions.length) {
      throw new BadRequestException(
        `Esperadas ${definition.questions.length} respostas, recebidas ${answers?.length ?? 0}.`,
      );
    }

    // Valida que cada resposta está dentro dos valores permitidos daquela pergunta
    for (let i = 0; i < answers.length; i++) {
      const allowed = definition.questions[i].options.map((o) => o.value);
      if (!allowed.includes(answers[i])) {
        throw new BadRequestException(
          `Resposta inválida na pergunta ${i + 1}. Valores permitidos: ${allowed.join(', ')}.`,
        );
      }
    }

    const totalScore = definition.calculateScore(answers);
    const severity = definition.classifySeverity(totalScore);

    return this.prisma.clinicalScale.update({
      where: { id: scale.id },
      data: {
        answers: JSON.stringify(answers),
        totalScore,
        severity,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }

  /** Lista escalas de um paciente (para o próprio paciente ou para o médico). */
  async findAllByPatient(patientId: number, doctorId?: number) {
    return this.prisma.clinicalScale.findMany({
      where: {
        patientId,
        ...(doctorId !== undefined ? { doctorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Detalhe de uma scale — com RBAC checando doctorId. */
  async findOneForDoctor(doctorId: number, scaleId: number) {
    const scale = await this.prisma.clinicalScale.findUnique({ where: { id: scaleId } });
    if (!scale) {
      throw new NotFoundException('Escala não encontrada.');
    }
    if (scale.doctorId !== doctorId) {
      throw new ForbiddenException('Você não tem permissão para ver esta escala.');
    }
    return scale;
  }
}
