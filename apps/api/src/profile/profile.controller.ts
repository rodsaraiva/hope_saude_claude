import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { SetupDoctorDto } from './dto/setup-doctor.dto';
import { SetupPatientDto } from './dto/setup-patient.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import {
  AvailableSlotsService,
  DEFAULT_DOCTOR_TIME_ZONE,
} from '../availability/available-slots.service';
import { AuthenticatedRequest } from '../auth/authenticated-request';

interface ConsultationModelInput {
  name: string;
  durationMinutes: number;
  price: number;
}

@ApiTags('profile')
@ApiBearerAuth('JWT')
@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  private static readonly MAX_AVAILABLE_SLOTS_RANGE_MS = 60 * 24 * 60 * 60 * 1000;

  constructor(
    private profileService: ProfileService,
    private availableSlotsService: AvailableSlotsService,
  ) {}

  @Get('doctors')
  @UseGuards(AuthGuard('jwt'))
  async listDoctors(@Query('specialty') specialty?: string) {
    return this.profileService.listDoctors(specialty);
  }

  @Get('doctors/:userId')
  @UseGuards(AuthGuard('jwt'))
  async getDoctorByUserId(@Param('userId') userIdParam: string) {
    const userId = parseInt(userIdParam, 10);
    if (Number.isNaN(userId)) {
      throw new NotFoundException('Médico não encontrado');
    }
    const profile = await this.profileService.getDoctorProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Médico não encontrado');
    }
    return profile;
  }

  /** Slots livres cruzando grade semanal, consultas confirmadas e checkouts pendentes de pagamento. */
  @Get('doctors/:userId/available-slots')
  @UseGuards(AuthGuard('jwt'))
  async getDoctorAvailableSlots(
    @Param('userId') userIdParam: string,
    @Query() query: AvailableSlotsQueryDto,
  ) {
    const userId = parseInt(userIdParam, 10);
    if (Number.isNaN(userId)) {
      throw new NotFoundException('Médico não encontrado');
    }
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Datas from/to inválidas');
    }
    if (to.getTime() - from.getTime() > ProfileController.MAX_AVAILABLE_SLOTS_RANGE_MS) {
      throw new BadRequestException('Intervalo máximo permitido é de 60 dias');
    }
    const tz = query.timeZone?.trim() || DEFAULT_DOCTOR_TIME_ZONE;
    const durationMinutes = query.durationMinutes ? parseInt(query.durationMinutes, 10) : undefined;
    return this.availableSlotsService.getAvailableSlots(userId, from, to, tz, durationMinutes);
  }

  @Post('doctor/setup')
  @UseGuards(AuthGuard('jwt'))
  async setupDoctor(@Request() req: AuthenticatedRequest, @Body() data: SetupDoctorDto) {
    if (req.user?.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem configurar perfil médico');
    }
    return this.profileService.createDoctorProfile(req.user.userId, data);
  }

  @Post('patient/setup')
  @UseGuards(AuthGuard('jwt'))
  async setupPatient(@Request() req: AuthenticatedRequest, @Body() data: SetupPatientDto) {
    if (req.user?.role !== 'PATIENT') {
      throw new ForbiddenException('Apenas pacientes podem configurar perfil de paciente');
    }
    return this.profileService.setupPatientProfile(req.user, data);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req: AuthenticatedRequest) {
    const profile =
      req.user.role === 'DOCTOR'
        ? await this.profileService.getDoctorProfile(req.user.userId)
        : await this.profileService.getPatientProfile(req.user.userId);

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado. Por favor, complete o setup.');
    }

    return profile;
  }

  @Post('doctor/availability')
  @UseGuards(AuthGuard('jwt'))
  async setAvailability(@Request() req: AuthenticatedRequest, @Body() body: UpdateAvailabilityDto) {
    if (req.user?.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem definir disponibilidade');
    }
    return this.profileService.updateAvailability(req.user.userId, body.availability);
  }

  @Post('doctor/consultation-models')
  @UseGuards(AuthGuard('jwt'))
  async createConsultationModel(
    @Request() req: AuthenticatedRequest,
    @Body() data: ConsultationModelInput,
  ) {
    if (req.user?.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem criar modelos de consulta');
    }
    return this.profileService.createConsultationModel(req.user.userId, data);
  }

  @Post('doctor/consultation-models/:id')
  @UseGuards(AuthGuard('jwt'))
  async updateConsultationModel(
    @Request() req: AuthenticatedRequest,
    @Param('id') idParam: string,
    @Body() data: ConsultationModelInput,
  ) {
    if (req.user?.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem atualizar modelos de consulta');
    }
    const modelId = parseInt(idParam, 10);
    if (Number.isNaN(modelId)) throw new BadRequestException('ID inválido');
    return this.profileService.updateConsultationModel(req.user.userId, modelId, data);
  }

  @Post('doctor/consultation-models/:id/delete')
  @UseGuards(AuthGuard('jwt'))
  async deleteConsultationModel(
    @Request() req: AuthenticatedRequest,
    @Param('id') idParam: string,
  ) {
    if (req.user?.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem excluir modelos de consulta');
    }
    const modelId = parseInt(idParam, 10);
    if (Number.isNaN(modelId)) throw new BadRequestException('ID inválido');
    return this.profileService.deleteConsultationModel(req.user.userId, modelId);
  }
}
