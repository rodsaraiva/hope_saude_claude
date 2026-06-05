import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from './notifications.module';
import { EmailOutboxWorker } from './outbox/email-outbox.worker';
import { PrismaService } from '../prisma.service';

describe('NotificationsModule', () => {
  it('expõe EmailOutboxWorker no contexto DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      providers: [{ provide: 'NOOP', useValue: 1 }],
    })
      .compile()
      .catch(() => null);
    // Compila o módulo real com env mínima; valida resolução do worker.
    const realModule = await Test.createTestingModule({
      imports: [NotificationsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(realModule.get(EmailOutboxWorker)).toBeInstanceOf(EmailOutboxWorker);
    void moduleRef;
  });
});
