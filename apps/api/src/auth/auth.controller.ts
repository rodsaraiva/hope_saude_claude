import { Controller, Get, Post, Body, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: any) {
    return this.authService.createUser(createUserDto);
  }

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.authService.login(user);
  }

  @Get('profile/doctor')
  @UseGuards(RolesGuard, AuthGuard('jwt'))
  @Roles('DOCTOR')
  getDoctorProfile(@Request() req) {
    return {
      message: 'Acesso concedido ao perfil médico',
      user: req.user,
    };
  }

  @Get('profile/patient')
  @UseGuards(RolesGuard, AuthGuard('jwt'))
  @Roles('PATIENT')
  getPatientProfile(@Request() req) {
    return {
      message: 'Acesso concedido ao perfil do paciente',
      user: req.user,
    };
  }
}
