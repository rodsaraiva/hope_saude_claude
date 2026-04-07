import { Module } from '@nestjs/common';
import { ClinicalScaleController } from './clinical-scale.controller';
import { ClinicalScaleService } from './clinical-scale.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ClinicalScaleController],
  providers: [ClinicalScaleService, PrismaService],
  exports: [ClinicalScaleService],
})
export class ClinicalScaleModule {}
