import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServerClient } from 'postmark';
import { createTransport } from 'nodemailer';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from './notifications.service';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import { MAIL_PROVIDER } from './providers/mail-provider.interface';
import { PostmarkMailProvider } from './providers/postmark.provider';
import { SmtpMailProvider } from './providers/smtp.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    PrismaService,
    EmailOutboxRepository,
    NotificationsService,
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('MAIL_DRIVER') ?? 'smtp';
        const from = config.get<string>('MAIL_FROM');
        if (!from) {
          throw new Error('MAIL_FROM não configurado');
        }

        if (driver === 'postmark') {
          const token = config.get<string>('POSTMARK_SERVER_TOKEN');
          if (!token) {
            throw new Error('POSTMARK_SERVER_TOKEN não configurado');
          }
          return new PostmarkMailProvider({
            client: new ServerClient(token),
            from,
            messageStream: config.get<string>('POSTMARK_MESSAGE_STREAM') ?? 'outbound',
          });
        }

        const transporter = createTransport({
          host: config.get<string>('SMTP_HOST') ?? 'localhost',
          port: Number(config.get<string>('SMTP_PORT') ?? 1025),
          secure: config.get<string>('SMTP_SECURE') === 'true',
          auth:
            config.get<string>('SMTP_USER') && config.get<string>('SMTP_PASS')
              ? {
                  user: config.get<string>('SMTP_USER') as string,
                  pass: config.get<string>('SMTP_PASS') as string,
                }
              : undefined,
        });
        return new SmtpMailProvider({ transporter, from });
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
