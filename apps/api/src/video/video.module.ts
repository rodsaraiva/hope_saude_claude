import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { AppointmentService } from '../appointment/appointment.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [VideoController],
  providers: [VideoService, AppointmentService, PrismaService],
})
export class VideoModule {}
