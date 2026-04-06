import { Module } from '@nestjs/common';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { LacunaProvider } from '../common/lacuna.provider';

@Module({
  controllers: [PrescriptionController],
  providers: [
    PrescriptionService,
    PrismaService,
    ConfigService,
    {
      provide: 'SignatureProvider',
      useClass: LacunaProvider,
    },
  ],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
