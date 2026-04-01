import { Module, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { AppointmentModule } from './appointment/appointment.module';
import { PaymentModule } from './payment/payment.module';
import { VideoModule } from './video/video.module';

@Module({
  imports: [AuthModule, ProfileModule, AppointmentModule, PaymentModule, VideoModule],
  controllers: [AppController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: any) => {
        console.log(`[REQ] ${req.method} ${req.originalUrl || req.url} - ${JSON.stringify(req.body)}`);
        next();
      })
      .forRoutes('*');
  }
}
