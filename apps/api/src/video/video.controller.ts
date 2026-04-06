import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { VideoService } from './video.service';
import { AppointmentService } from '../appointment/appointment.service';

@Controller('video')
@UseGuards(AuthGuard('jwt'))
export class VideoController {
  constructor(
    private videoService: VideoService,
    private appointmentService: AppointmentService
  ) {}

  @Get('token/:appointmentId')
  async getToken(@Param('appointmentId') appointmentId: string, @Request() req) {
    const appt = await this.appointmentService.findById(Number(appointmentId));

    if (!appt || appt.status !== 'CONFIRMED') {
      throw new ForbiddenException('Consulta não confirmada ou inexistente');
    }

    const payload = await this.videoService.generateToken(
      `room-${appointmentId}`,
      req.user.email
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
