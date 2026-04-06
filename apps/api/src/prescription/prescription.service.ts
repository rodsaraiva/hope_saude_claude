import { Injectable, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SignatureProvider } from '../common/signature.provider';

@Injectable()
export class PrescriptionService {
  constructor(
    private prisma: PrismaService,
    @Inject('SignatureProvider') private signatureProvider: SignatureProvider
  ) {}

  async create(data: {
    doctorId: number;
    patientId: number;
    appointmentId?: number;
    medications: string;
    observations?: string;
  }) {
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
    }

    return this.prisma.prescription.create({
      data: {
        doctorId: data.doctorId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        medications: data.medications,
        observations: data.observations,
        status: 'DRAFT',
      },
    });
  }

  async findAllByPatient(doctorId: number | undefined, patientId: number) {
    const where: any = { patientId };
    if (doctorId !== undefined) {
      where.doctorId = doctorId;
    }

    return this.prisma.prescription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(doctorId: number, prescriptionId: number) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
    });

    if (!prescription) {
      throw new NotFoundException('Receita não encontrada');
    }

    if (prescription.doctorId !== doctorId) {
      throw new ForbiddenException('Você não tem permissão para visualizar esta receita');
    }

    return prescription;
  }

  async update(doctorId: number, prescriptionId: number, data: { medications: string; observations?: string }) {
    const prescription = await this.findOne(doctorId, prescriptionId);

    if (prescription.status === 'SIGNED') {
      throw new ForbiddenException('Não é possível editar uma receita já assinada');
    }

    return this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        medications: data.medications,
        observations: data.observations,
      },
    });
  }

  async sign(doctorId: number, prescriptionId: number, authData?: any) {
    const prescription = await this.findOne(doctorId, prescriptionId);

    if (prescription.status === 'SIGNED') {
      return prescription;
    }

    // O conteúdo para assinatura deve ser uma representação estável da receita
    const contentToSign = JSON.stringify({
      medications: prescription.medications,
      observations: prescription.observations,
      patientId: prescription.patientId,
      doctorId: prescription.doctorId,
      date: prescription.createdAt,
    });

    const result = await this.signatureProvider.sign(contentToSign, authData);

    return this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'SIGNED',
        signature: result.signature,
        signatureDate: result.signatureDate,
        signedHash: result.hash,
      },
    });
  }
}
