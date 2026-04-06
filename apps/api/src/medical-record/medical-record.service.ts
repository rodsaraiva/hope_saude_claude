import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';
import { SignatureProvider } from '../common/signature.provider';

@Injectable()
export class MedicalRecordService {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptographyService,
    @Inject('SignatureProvider') private signatureProvider: SignatureProvider
  ) {}

  async create(data: {
    doctorId: number;
    patientId: number;
    appointmentId?: number;
    content: string;
    type?: string;
  }) {
    // ... (same security logic as before)
    if (data.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: data.appointmentId },
      });

      if (!appointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }

      if (appointment.doctorId !== data.doctorId) {
        throw new ForbiddenException('Este agendamento não pertence a este médico');
      }
      
      if (appointment.patientId !== data.patientId) {
        throw new BadRequestException('Paciente não corresponde ao agendamento');
      }
    } else {
      const hasRelation = await this.prisma.appointment.findFirst({
        where: { doctorId: data.doctorId, patientId: data.patientId },
      });

      if (!hasRelation) {
        throw new ForbiddenException('Você não possui agendamentos com este paciente para criar um prontuário');
      }
    }

    return this.prisma.medicalRecord.create({
      data: {
        ...data,
        status: 'DRAFT',
        type: data.type || 'EVOLUTION',
      },
    });
  }

  async findAllByPatient(doctorId: number | undefined, patientId: number, search?: string) {
    const where: any = { patientId };

    if (doctorId !== undefined) {
      where.doctorId = doctorId;
    }

    if (search) {
      where.content = {
        contains: search,
      };
    }

    return this.prisma.medicalRecord.findMany({
      where,
      include: { audits: true, doctor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(doctorId: number, recordId: number) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: { audits: true },
    });

    if (!record) {
      throw new NotFoundException('Prontuário não encontrado');
    }

    if (record.doctorId !== doctorId) {
      throw new ForbiddenException('Você não tem permissão para visualizar este prontuário');
    }

    return record;
  }

  async update(doctorId: number, recordId: number, content: string, reason: string = 'Atualização do prontuário') {
    const record = await this.findOne(doctorId, recordId);

    if (record.status === 'SIGNED') {
      throw new ForbiddenException('Não é possível editar um prontuário já assinado');
    }

    // Usar transação para garantir auditoria
    return this.prisma.$transaction(async (tx) => {
      // Salva versão antiga na auditoria
      await tx.medicalRecordAudit.create({
        data: {
          medicalRecordId: recordId,
          content: record.content,
          changedByUserId: doctorId,
          reason,
        },
      });

      return tx.medicalRecord.update({
        where: { id: recordId },
        data: { content },
      });
    });
  }

  async sign(doctorId: number, recordId: number, authData?: any) {
    const record = await this.findOne(doctorId, recordId);

    if (record.status === 'SIGNED') {
      return record;
    }

    // Geração da assinatura eletrônica via provedor externo (ex: BirdID)
    const result = await this.signatureProvider.sign(record.content, authData);

    return this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: { 
        status: 'SIGNED',
        signature: result.signature,
        signatureDate: result.signatureDate,
        signedHash: result.hash,
        signerUserId: doctorId,
      },
    });
  }
}
