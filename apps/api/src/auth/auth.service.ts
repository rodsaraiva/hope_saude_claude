import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
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
    private notifications: NotificationsService,
    private config: ConfigService,
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

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appUrl = this.config.get<string>('MAIL_APP_URL') ?? 'http://localhost:3001';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await this.notifications.sendPasswordReset({
      to: user.email,
      userName: user.name,
      resetUrl,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const usedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt },
      });
    });
  }

  async requestEmailVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appUrl = this.config.get<string>('MAIL_APP_URL') ?? 'http://localhost:3001';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    await this.notifications.sendEmailVerification({
      to: user.email,
      userName: user.name,
      verifyUrl,
    });
  }

  async confirmEmailVerification(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const usedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt },
      });
    });
  }
}
