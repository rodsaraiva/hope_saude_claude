import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('appointment')
@ApiBearerAuth('JWT')
@Controller('appointments')
@UseGuards(AuthGuard('jwt'))
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) {}

  @Get('me')
  async getMyAppointments(@Request() req: AuthenticatedRequest) {
    if (req.user.role === 'DOCTOR') {
      return this.appointmentService.getDoctorAppointments(req.user.userId);
    }
    return this.appointmentService.getPatientAppointments(req.user.userId);
  }
}
