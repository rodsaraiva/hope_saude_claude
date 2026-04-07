import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthTokenResponse,
  JwtSigningPayload,
  NewUserInput,
  PublicUser,
  UserRole,
} from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /** Dados públicos do usuário (sem senha) — sempre que o JWT for válido. */
  async getPublicUserById(id: number): Promise<PublicUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return user ? (user as PublicUser) : null;
  }

  async createUser(data: NewUserInput) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        password: hashedPassword,
      },
    });

    if (user.role === 'PATIENT') {
      await this.prisma.patientProfile.create({
        data: { userId: user.id },
      });
    }

    return user;
  }

  /** Cadastra o usuário e devolve o mesmo payload do login (JWT), sem etapa extra de login. */
  async registerAndLogin(data: NewUserInput): Promise<AuthTokenResponse> {
    const user = await this.createUser(data);
    return this.login({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
    });
  }

  async validateUser(email: string, pass: string): Promise<PublicUser | null> {
    const user = await this.findUserByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password: _password, updatedAt: _updatedAt, ...result } = user;
      return result as PublicUser;
    }
    return null;
  }

  async login(user: JwtSigningPayload): Promise<AuthTokenResponse> {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  isDoctor(user: { role: string }): boolean {
    return user.role === 'DOCTOR';
  }

  isPatient(user: { role: string }): boolean {
    return user.role === 'PATIENT';
  }
}
