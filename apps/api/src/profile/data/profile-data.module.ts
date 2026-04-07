import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CryptographyService } from '../../common/cryptography.service';
import { PatientProfileRepository } from './patient-profile.repository';
import { DoctorProfileRepository } from './doctor-profile.repository';

/**
 * Módulo de dados de perfis. Não conhece ProfileService nem PaymentService —
 * é a raiz comum que ambos podem importar sem criar ciclo.
 */
@Module({
  providers: [
    PrismaService,
    CryptographyService,
    PatientProfileRepository,
    DoctorProfileRepository,
  ],
  exports: [PatientProfileRepository, DoctorProfileRepository],
})
export class ProfileDataModule {}
