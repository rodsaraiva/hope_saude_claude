import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { ClinicalScaleService } from './clinical-scale.service';
import type { ScaleType } from './scales/scale-definitions';

@ApiTags('clinical-scale')
@Controller('clinical-scales')
export class ClinicalScaleController {
  constructor(private readonly service: ClinicalScaleService) {}

  // -------------------------------------------------------------------------
  // Endpoints autenticados (médico/paciente)
  // -------------------------------------------------------------------------

  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Médico cria uma nova escala para um paciente' })
  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() body: { patientId: number; type: ScaleType; notes?: string },
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem criar escalas.');
    }
    return this.service.createScale({
      doctorId: req.user.userId,
      patientId: body.patientId,
      type: body.type,
      notes: body.notes,
    });
  }

  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Lista escalas de um paciente (RBAC: médico só vê as suas)' })
  @UseGuards(AuthGuard('jwt'))
  @Get('patient/:patientId')
  async listByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientIdParam: string,
  ) {
    const patientId = parseInt(patientIdParam, 10);
    if (req.user.role !== 'DOCTOR' && req.user.role !== 'PATIENT') {
      throw new ForbiddenException('Acesso negado.');
    }
    if (req.user.role === 'PATIENT' && req.user.userId !== patientId) {
      throw new ForbiddenException('Você só pode ver suas próprias escalas.');
    }
    const doctorFilter = req.user.role === 'DOCTOR' ? req.user.userId : undefined;
    return this.service.findAllByPatient(patientId, doctorFilter);
  }

  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Detalhe de uma escala (apenas médico dono)' })
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findOne(@Request() req: AuthenticatedRequest, @Param('id') idParam: string) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos acessam este endpoint.');
    }
    return this.service.findOneForDoctor(req.user.userId, parseInt(idParam, 10));
  }

  // -------------------------------------------------------------------------
  // Endpoints públicos (paciente responde via link/token sem login)
  // -------------------------------------------------------------------------

  @SkipThrottle()
  @ApiOperation({
    summary: 'Endpoint público: paciente recebe a escala via link/token para preencher',
  })
  @Get('public/:token')
  async getPublic(@Param('token') token: string) {
    return this.service.findPublicByToken(token);
  }

  @ApiOperation({
    summary: 'Endpoint público: paciente submete respostas — service calcula score automaticamente',
  })
  @Post('public/:token/answers')
  async submitAnswers(@Param('token') token: string, @Body() body: { answers: number[] }) {
    return this.service.submitAnswers(token, body.answers);
  }
}
