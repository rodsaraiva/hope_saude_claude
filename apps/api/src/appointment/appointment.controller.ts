import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
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

  @Post(':id/cancel')
  async cancel(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const role = req.user.role;
    if (role !== 'PATIENT' && role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas pacientes e médicos podem cancelar consultas');
    }
    return this.appointmentService.cancel(parseInt(id, 10), req.user.userId, role, body?.reason);
  }

  @Post(':id/reschedule')
  async reschedule(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { newDate?: string },
  ) {
    const role = req.user.role;
    if (role !== 'PATIENT' && role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas pacientes e médicos podem reagendar consultas');
    }
    if (!body?.newDate) {
      throw new BadRequestException('newDate é obrigatório');
    }
    return this.appointmentService.reschedule(
      parseInt(id, 10),
      req.user.userId,
      role,
      new Date(body.newDate),
    );
  }
}
