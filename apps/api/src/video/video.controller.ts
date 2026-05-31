import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VideoService } from './video.service';
import { AppointmentService } from '../appointment/appointment.service';
import { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('video')
@ApiBearerAuth('JWT')
@Controller('video')
@UseGuards(AuthGuard('jwt'))
export class VideoController {
  constructor(
    private videoService: VideoService,
    private appointmentService: AppointmentService,
  ) {}

  @Get('token/:appointmentId')
  async getToken(
    @Param('appointmentId') appointmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const appt = await this.appointmentService.findById(Number(appointmentId));

    if (!appt || appt.status !== 'CONFIRMED') {
      throw new ForbiddenException('Consulta não confirmada ou inexistente');
    }

    const isParticipant = req.user.userId === appt.patientId || req.user.userId === appt.doctorId;
    if (!isParticipant) {
      throw new ForbiddenException('Você não participa desta consulta');
    }

    const payload = await this.videoService.generateToken(
      `room-${appointmentId}`,
      req.user.email ?? `user-${req.user.userId}`,
    );

    return {
      ...payload,
      appointment: {
        id: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        patientName: (appt as any).patient?.name,
      },
    };
  }
}
