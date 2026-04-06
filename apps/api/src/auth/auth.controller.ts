import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: RegisterDto) {
    return this.authService.registerAndLogin(createUserDto);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.authService.login(user);
  }

  /** Conta básica (nome, e-mail, papel) — não exige DoctorProfile/PatientProfile. */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Request() req: { user: { userId: number } }) {
    const user = await this.authService.getPublicUserById(req.user.userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
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
