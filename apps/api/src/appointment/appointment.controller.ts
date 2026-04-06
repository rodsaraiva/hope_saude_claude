import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentService } from './appointment.service';

@Controller('appointments')
@UseGuards(AuthGuard('jwt'))
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) {}

  @Get('me')
  async getMyAppointments(@Request() req) {
    if (req.user.role === 'DOCTOR') {
      return this.appointmentService.getDoctorAppointments(req.user.userId);
    }
    return this.appointmentService.getPatientAppointments(req.user.userId);
  }
}
