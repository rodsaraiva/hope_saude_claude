import { Injectable, Logger, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PaymentService } from '../payment/payment.service';
import { CryptographyService } from '../common/cryptography.service';
import { SetupPatientDto } from './dto/setup-patient.dto';
import {
  assertValidDoctorAvailabilityJson,
  InvalidAvailabilityPayloadError,
} from '../availability/weekly-availability';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PaymentService))
    private paymentService: PaymentService,
    private readonly crypto: CryptographyService,
  ) {}

  /** Decripta o campo cpf de um PatientProfile (mutation out-of-place). */
  private decryptPatientProfile<T extends { cpf?: string | null } | null | undefined>(
    profile: T,
  ): T {
    if (!profile) return profile;
    return { ...profile, cpf: this.crypto.decryptNullable(profile.cpf) } as T;
  }

  async createDoctorProfile(userId: number, data: any) {
    return this.prisma.doctorProfile.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async setupPatientProfile(user: any, data: SetupPatientDto) {
    const profile = await this.upsertPatientProfile(user.userId, data);

    const cpf = profile.cpf?.trim();
    const phone = profile.phone?.trim();
    if (cpf && phone && !profile.asaasCustomerId) {
      try {
        await this.paymentService.ensureAsaasCustomerId(user.userId, user.name, user.email, cpf);
      } catch (err) {
        this.logger.warn(
          `Asaas: cliente antecipado não vinculado (user ${user.userId})`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    return this.getPatientProfile(user.userId);
  }

  async upsertPatientProfile(userId: number, data: any) {
    // LGPD: CPF é encriptado em repouso via AES-256-GCM (DATA_ENCRYPTION_KEY).
    const payload = {
      ...data,
      ...(data.cpf !== undefined ? { cpf: this.crypto.encryptNullable(data.cpf) } : {}),
    };
    const profile = await this.prisma.patientProfile.upsert({
      where: { userId },
      update: payload,
      create: { ...payload, userId },
    });

    return this.decryptPatientProfile(profile);
  }

  async updateAsaasCustomerId(userId: number, asaasCustomerId: string) {
    return this.prisma.patientProfile.update({
      where: { userId },
      data: { asaasCustomerId },
    });
  }

  async getDoctorProfile(userId: number) {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        consultationModels: true,
      },
    });
  }

  async getPatientProfile(userId: number) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    return this.decryptPatientProfile(profile);
  }

  async updateAvailability(userId: number, availability: string) {
    try {
      assertValidDoctorAvailabilityJson(availability);
    } catch (e) {
      if (e instanceof InvalidAvailabilityPayloadError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }
    return this.prisma.doctorProfile.update({
      where: { userId },
      data: { availability },
    });
  }

  async listDoctors(specialty?: string) {
    return this.prisma.doctorProfile.findMany({
      where: specialty ? { specialty } : {},
      include: {
        user: { select: { name: true, email: true } },
        consultationModels: true,
      },
    });
  }

  /** Perfil público do médico (mesmo shape da lista) para detalhe por userId. */
  async getDoctorProfileByUserId(userId: number) {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true } },
        consultationModels: true,
      },
    });
  }

  async createConsultationModel(
    userId: number,
    data: { name: string; durationMinutes: number; price: number },
  ) {
    const profile = await this.getDoctorProfile(userId);
    if (!profile) throw new BadRequestException('Perfil não encontrado');

    return this.prisma.consultationModel.create({
      data: {
        doctorProfileId: profile.id,
        name: data.name,
        durationMinutes: data.durationMinutes,
        price: data.price,
      },
    });
  }

  async updateConsultationModel(
    userId: number,
    modelId: number,
    data: { name: string; durationMinutes: number; price: number },
  ) {
    const profile = await this.getDoctorProfile(userId);
    if (!profile) throw new BadRequestException('Perfil não encontrado');

    // Verifica se o modelo pertence a este médico
    const existing = await this.prisma.consultationModel.findFirst({
      where: { id: modelId, doctorProfileId: profile.id },
    });

    if (!existing) {
      throw new BadRequestException('Modelo não encontrado ou não pertence a este médico');
    }

    return this.prisma.consultationModel.update({
      where: { id: modelId },
      data,
    });
  }

  async deleteConsultationModel(userId: number, modelId: number) {
    const profile = await this.getDoctorProfile(userId);
    if (!profile) throw new BadRequestException('Perfil não encontrado');

    const existing = await this.prisma.consultationModel.findFirst({
      where: { id: modelId, doctorProfileId: profile.id },
    });

    if (!existing) {
      throw new BadRequestException('Modelo não encontrado ou não pertence a este médico');
    }

    return this.prisma.consultationModel.delete({
      where: { id: modelId },
    });
  }
}
