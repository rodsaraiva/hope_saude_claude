import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../prisma.service';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET não está definido. Configure a variável de ambiente antes de iniciar a API.',
          );
        }
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') ?? '60m';
        return {
          secret,
          // O tipo StringValue do jsonwebtoken 9 não aceita `string` puro —
          // fazemos cast controlado porque validamos o valor via env.
          signOptions: { expiresIn } as JwtSignOptions,
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}
