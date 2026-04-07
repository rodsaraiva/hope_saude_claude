import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/**
 * Repositório de DoctorProfile.
 * Apenas leitura pública (detail e listagem) — criação/edição permanece
 * no ProfileService que orquestra regras de domínio.
 */
@Injectable()
export class DoctorProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserIdWithConsultationModels(userId: number) {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true } },
        consultationModels: true,
      },
    });
  }

  async listWithFilter(specialty?: string) {
    return this.prisma.doctorProfile.findMany({
      where: specialty ? { specialty } : {},
      include: {
        user: { select: { name: true, email: true } },
        consultationModels: true,
      },
    });
  }
}
