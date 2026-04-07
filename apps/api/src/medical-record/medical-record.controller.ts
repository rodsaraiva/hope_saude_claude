import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MedicalRecordService } from './medical-record.service';
import { AuthenticatedRequest } from '../auth/authenticated-request';

@Controller('medical-records')
@UseGuards(AuthGuard('jwt'))
export class MedicalRecordController {
  constructor(private service: MedicalRecordService) {}

  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientId: number; appointmentId?: number; content: string; type?: string },
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem criar prontuários');
    }

    return this.service.create({
      doctorId: req.user.userId,
      ...body,
    });
  }

  @Get('patient/:patientId')
  async findAllByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientId: string,
    @Query('search') search?: string,
  ) {
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'PATIENT') {
      throw new ForbiddenException('Apenas médicos e pacientes podem visualizar prontuários');
    }

    if (req.user.role === 'PATIENT' && req.user.userId !== parseInt(patientId, 10)) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar o prontuário de outro paciente',
      );
    }

    return this.service.findAllByPatient(
      req.user.role === 'DOCTOR' ? req.user.userId : undefined,
      parseInt(patientId, 10),
      search,
    );
  }

  @Patch(':id')
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { content: string; reason?: string },
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem atualizar prontuários');
    }

    return this.service.update(req.user.userId, parseInt(id, 10), body.content, body.reason);
  }

  @Post(':id/sign')
  async sign(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body?: { authData?: unknown },
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem assinar prontuários');
    }

    return this.service.sign(req.user.userId, parseInt(id, 10), body?.authData);
  }
}
