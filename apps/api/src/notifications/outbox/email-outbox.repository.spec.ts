import { EmailOutboxRepository } from './email-outbox.repository';
import { PrismaService } from '../../prisma.service';

describe('EmailOutboxRepository', () => {
  const makePrisma = () =>
    ({
      emailOutbox: {
        create: jest.fn(),
        update: jest.fn(),
      },
    }) as unknown as PrismaService;

  it('createPending grava registro PENDING e devolve id', async () => {
    const prisma = makePrisma();
    (prisma.emailOutbox.create as jest.Mock).mockResolvedValue({
      id: 'outbox-1',
    });
    const repo = new EmailOutboxRepository(prisma);

    const id = await repo.createPending({
      to: 'a@b.com',
      subject: 's',
      tag: 'password-reset',
    });

    expect(prisma.emailOutbox.create).toHaveBeenCalledWith({
      data: {
        to: 'a@b.com',
        subject: 's',
        tag: 'password-reset',
        status: 'PENDING',
      },
      select: { id: true },
    });
    expect(id).toBe('outbox-1');
  });

  it('markSent atualiza status SENT + providerMessageId + sentAt + increment attempts', async () => {
    const prisma = makePrisma();
    const repo = new EmailOutboxRepository(prisma);
    await repo.markSent('outbox-1', 'pm-999');

    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({
        status: 'SENT',
        providerMessageId: 'pm-999',
        sentAt: expect.any(Date),
        attempts: { increment: 1 },
      }),
    });
  });

  it('markFailed atualiza status FAILED + errorMessage + failedAt + increment attempts', async () => {
    const prisma = makePrisma();
    const repo = new EmailOutboxRepository(prisma);
    await repo.markFailed('outbox-1', 'boom');

    expect(prisma.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'boom',
        failedAt: expect.any(Date),
        attempts: { increment: 1 },
      }),
    });
  });
});
