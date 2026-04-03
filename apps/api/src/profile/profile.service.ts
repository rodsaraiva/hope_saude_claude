import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AsaasService } from '../payment/asaas.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
  ) {}

  async createDoctorProfile(userId: number, data: any) {
    return this.prisma.doctorProfile.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async upsertPatientProfile(userId: number, data: any) {
    const profile = await this.prisma.patientProfile.upsert({
      where: { userId },
      update: data,
      create: {
        ...data,
        userId,
      },
    });

    const cpf = profile.cpf?.trim();
    const phone = profile.phone?.trim();
    if (cpf && phone && !profile.asaasCustomerId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        try {
          await this.ensureAsaasCustomerId(userId, user.name, user.email, cpf);
        } catch (err) {
          this.logger.warn(
            `Asaas: cliente antecipado não vinculado (user ${userId})`,
            err instanceof Error ? err.stack : err,
          );
        }
      }
    }

    return this.getPatientProfile(userId);
  }

  /**
   * Garante ID do cliente Asaas no perfil (cria ou reutiliza por CPF).
   * Usado no setup (CPF + celular) e no checkout se ainda não houver vínculo.
   */
  async ensureAsaasCustomerId(
    userId: number,
    name: string,
    email: string,
    cpf: string,
  ): Promise<string> {
    const profile = await this.prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new Error('Perfil de paciente não encontrado');
    }
    if (profile.asaasCustomerId) {
      return profile.asaasCustomerId;
    }

    const cpfDigits = cpf.replace(/\D/g, '');
    let customerId = await this.asaasService.findCustomerIdByCpf(cpfDigits);
    if (!customerId) {
      const created = await this.asaasService.createCustomer(name, email, cpf);
      customerId = created.id;
    }

    await this.prisma.patientProfile.update({
      where: { userId },
      data: { asaasCustomerId: customerId },
    });

    return customerId;
  }

  async getDoctorProfile(userId: number) {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async getPatientProfile(userId: number) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async updateAvailability(userId: number, availability: string) {
    return this.prisma.doctorProfile.update({
      where: { userId },
      data: { availability },
    });
  }

  async listDoctors(specialty?: string) {
    return this.prisma.doctorProfile.findMany({
      where: specialty ? { specialty } : {},
      include: { user: { select: { name: true, email: true } } },
    });
  }

  /** Perfil público do médico (mesmo shape da lista) para detalhe por userId. */
  async getDoctorProfileByUserId(userId: number) {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true, email: true } } },
    });
  }
}
