import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrescriptionService } from './prescription.service';
import { AuthenticatedRequest } from '../auth/authenticated-request';

@ApiTags('prescription')
@ApiBearerAuth('JWT')
@Controller('prescriptions')
@UseGuards(AuthGuard('jwt'))
export class PrescriptionController {
  constructor(private service: PrescriptionService) {}

  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: { patientId: number; appointmentId?: number; medications: string; observations?: string },
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem criar receitas');
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
  ) {
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'PATIENT') {
      throw new ForbiddenException('Apenas médicos e pacientes podem visualizar receitas');
    }

    if (req.user.role === 'PATIENT' && req.user.userId !== parseInt(patientId, 10)) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar receitas de outro paciente',
      );
    }

    return this.service.findAllByPatient(
      req.user.role === 'DOCTOR' ? req.user.userId : undefined,
      parseInt(patientId, 10),
    );
  }

  @Patch(':id')
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { medications: string; observations?: string },
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem atualizar receitas');
    }

    return this.service.update(req.user.userId, parseInt(id, 10), body);
  }

  @Post(':id/sign')
  async sign(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body?: { authData?: unknown },
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem assinar receitas');
    }

    return this.service.sign(req.user.userId, parseInt(id, 10), body?.authData);
  }
}
