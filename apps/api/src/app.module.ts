import { Module, MiddlewareConsumer, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { AppointmentModule } from './appointment/appointment.module';
import { PaymentModule } from './payment/payment.module';
import { VideoModule } from './video/video.module';
import { MedicalRecordModule } from './medical-record/medical-record.module';
import { PrescriptionModule } from './prescription/prescription.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: 60_000, // 60s
          limit: 120, // default generoso para endpoints gerais
        },
        {
          name: 'auth',
          ttl: Number(config.get<string>('AUTH_THROTTLE_TTL') ?? 60) * 1000,
          limit: Number(config.get<string>('AUTH_THROTTLE_LIMIT') ?? 10),
        },
      ],
    }),
    AuthModule,
    ProfileModule,
    AppointmentModule,
    PaymentModule,
    VideoModule,
    MedicalRecordModule,
    PrescriptionModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  private readonly logger = new Logger('HTTP');

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, _res: any, next: any) => {
        this.logger.log(`${req.method} ${req.originalUrl || req.url}`);
        next();
      })
      .forRoutes('*');
  }
}
