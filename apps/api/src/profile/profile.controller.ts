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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

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

  @Post('doctor/setup')
  @UseGuards(AuthGuard('jwt'))
  async setupDoctor(@Request() req, @Body() data: any) {
    if (req.user?.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem configurar perfil médico');
    }
    return this.profileService.createDoctorProfile(req.user.userId, data);
  }

  @Post('patient/setup')
  @UseGuards(AuthGuard('jwt'))
  async setupPatient(@Request() req, @Body() data: any) {
    if (req.user?.role !== 'PATIENT') {
      throw new ForbiddenException('Apenas pacientes podem configurar perfil de paciente');
    }
    return this.profileService.upsertPatientProfile(req.user.userId, data);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req) {
    let profile;
    if (req.user.role === 'DOCTOR') {
      profile = await this.profileService.getDoctorProfile(req.user.userId);
    } else {
      profile = await this.profileService.getPatientProfile(req.user.userId);
    }

    if (!profile) {
      // Retornamos 404 para indicar que o perfil ainda não foi configurado
      throw new NotFoundException('Perfil não encontrado. Por favor, complete o setup.');
    }

    return profile;
  }

  @Post('doctor/availability')
  @UseGuards(AuthGuard('jwt'))
  async setAvailability(@Request() req, @Body() body: any) {
    if (req.user?.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem definir disponibilidade');
    }
    return this.profileService.updateAvailability(req.user.userId, body.availability);
  }
}
