import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CryptographyService } from '../../common/cryptography.service';

export interface PatientProfileUpsertInput {
  cpf?: string | null;
  phone?: string | null;
  medicalHistory?: string | null;
  asaasCustomerId?: string | null;
}

/**
 * Repositório de PatientProfile.
 * Concentra as operações de persistência e a aplicação/reversão da
 * criptografia de CPF em repouso (LGPD). Qualquer serviço que precise
 * ler/escrever perfis de paciente deve depender desta abstração em
 * vez de tocar o Prisma diretamente — isso permite quebrar o ciclo
 * PaymentService ↔ ProfileService (DIP).
 */
@Injectable()
export class PatientProfileRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptographyService,
  ) {}

  private decrypt<T extends { cpf?: string | null } | null>(row: T): T {
    if (!row) return row;
    return { ...row, cpf: this.crypto.decryptNullable(row.cpf) } as T;
  }

  async findByUserId(userId: number, options?: { include?: Record<string, unknown> }) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
      ...(options?.include ? { include: options.include as any } : {}),
    });
    return this.decrypt(profile);
  }

  async upsertByUserId(userId: number, data: PatientProfileUpsertInput) {
    const payload: PatientProfileUpsertInput = {
      ...data,
      ...(data.cpf !== undefined ? { cpf: this.crypto.encryptNullable(data.cpf) } : {}),
    };
    const row = await this.prisma.patientProfile.upsert({
      where: { userId },
      update: payload as any,
      create: { ...(payload as any), userId },
    });
    return this.decrypt(row);
  }

  async updateAsaasCustomerId(userId: number, asaasCustomerId: string) {
    const row = await this.prisma.patientProfile.update({
      where: { userId },
      data: { asaasCustomerId },
    });
    return this.decrypt(row);
  }
}
