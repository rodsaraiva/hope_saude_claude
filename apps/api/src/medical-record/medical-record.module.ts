import { Module } from '@nestjs/common';
import { MedicalRecordController } from './medical-record.controller';
import { MedicalRecordService } from './medical-record.service';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';
import { LacunaProvider } from '../common/lacuna.provider';
import { ConfigService } from '@nestjs/config';

@Module({
  controllers: [MedicalRecordController],
  providers: [
    MedicalRecordService,
    PrismaService,
    CryptographyService,
    ConfigService,
    {
      provide: 'SignatureProvider',
      useClass: LacunaProvider,
    },
  ],
  exports: [MedicalRecordService],
})
export class MedicalRecordModule {}
