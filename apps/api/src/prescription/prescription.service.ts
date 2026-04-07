import { Injectable, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';
import { SignatureProvider } from '../common/signature.provider';

/**
 * PrescriptionService.
 *
 * LGPD: o campo `medications` (JSON serializado contendo nome, dosagem,
 * etc.) é encriptado em repouso via AES-256-GCM. Toda leitura passa por
 * decryptOne() antes de devolver. O fluxo de assinatura usa os dados
 * decriptados como input do signatureProvider — o conteúdo assinado
 * inclui medications em texto puro e o JWS resultante é gravado em
 * `signature`.
 */
@Injectable()
export class PrescriptionService {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptographyService,
    @Inject('SignatureProvider') private signatureProvider: SignatureProvider,
  ) {}

  private decryptOne<T extends { medications?: string | null } | null>(row: T): T {
    if (!row) return row;
    return {
      ...row,
      medications: this.cryptoService.decryptNullable(row.medications),
    } as T;
  }

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

      if (appointment.patientId !== data.patientId) {
        throw new ForbiddenException('Paciente não corresponde ao agendamento');
      }
    } else {
      const hasRelation = await this.prisma.appointment.findFirst({
        where: { doctorId: data.doctorId, patientId: data.patientId },
      });

      if (!hasRelation) {
        throw new ForbiddenException(
          'Você não possui agendamentos com este paciente para criar uma receita',
        );
      }
    }

    const encryptedMedications = this.cryptoService.encryptNullable(data.medications) as string;

    const created = await this.prisma.prescription.create({
      data: {
        doctorId: data.doctorId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        medications: encryptedMedications,
        observations: data.observations,
        status: 'DRAFT',
      },
    });

    return this.decryptOne(created);
  }

  async findAllByPatient(doctorId: number | undefined, patientId: number) {
    const where: { patientId: number; doctorId?: number } = { patientId };
    if (doctorId !== undefined) {
      where.doctorId = doctorId;
    }

    const rows = await this.prisma.prescription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => this.decryptOne(r));
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

    return this.decryptOne(prescription);
  }

  async update(
    doctorId: number,
    prescriptionId: number,
    data: { medications: string; observations?: string },
  ) {
    const prescription = await this.findOne(doctorId, prescriptionId);

    if (prescription.status === 'SIGNED') {
      throw new ForbiddenException('Não é possível editar uma receita já assinada');
    }

    const updated = await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        medications: this.cryptoService.encryptNullable(data.medications) as string,
        observations: data.observations,
      },
    });

    return this.decryptOne(updated);
  }

  async sign(doctorId: number, prescriptionId: number, authData?: unknown) {
    const prescription = await this.findOne(doctorId, prescriptionId);

    if (prescription.status === 'SIGNED') {
      return prescription;
    }

    // O conteúdo para assinatura deve ser uma representação estável da receita.
    // medications já está DECRIPTADO via findOne — vai em texto puro pro provider.
    const contentToSign = JSON.stringify({
      medications: prescription.medications,
      observations: prescription.observations,
      patientId: prescription.patientId,
      doctorId: prescription.doctorId,
      date: prescription.createdAt,
    });

    const result = await this.signatureProvider.sign(contentToSign, authData);

    const updated = await this.prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: 'SIGNED',
        signature: result.signature,
        signatureDate: result.signatureDate,
        signedHash: result.hash,
      },
    });

    return this.decryptOne(updated);
  }
}
