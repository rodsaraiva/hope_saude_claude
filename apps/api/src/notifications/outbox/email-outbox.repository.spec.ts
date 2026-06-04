import { EmailOutboxRepository } from './email-outbox.repository';
import { PrismaService } from '../../prisma.service';

describe('EmailOutboxRepository', () => {
  const makePrisma = () =>
    ({
      emailOutbox: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
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
      data: expect.objectContaining({
        to: 'a@b.com',
        subject: 's',
        tag: 'password-reset',
        status: 'PENDING',
      }),
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

  it('findManyByStatus delega para findMany com where { status } ordenado por createdAt asc', async () => {
    const prisma = makePrisma();
    (prisma.emailOutbox.findMany as jest.Mock).mockResolvedValue([{ id: 'o-1' }]);
    const repo = new EmailOutboxRepository(prisma);

    const rows = await repo.findManyByStatus('FAILED');

    expect(prisma.emailOutbox.findMany).toHaveBeenCalledWith({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toEqual([{ id: 'o-1' }]);
  });

  describe('findRetryable', () => {
    const now = new Date('2026-05-31T12:00:00.000Z');

    it('busca PENDING/FAILED com attempts < maxAttempts e exclui quem estourou N', async () => {
      const prisma = makePrisma();
      (prisma.emailOutbox.findMany as jest.Mock).mockResolvedValue([]);
      const repo = new EmailOutboxRepository(prisma);

      await repo.findRetryable({ maxAttempts: 5, now });

      expect(prisma.emailOutbox.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          attempts: { lt: 5 },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('inclui PENDING (failedAt null) e FAILED com backoff vencido; exclui backoff em aberto', async () => {
      const prisma = makePrisma();
      const pending = { id: 'p', status: 'PENDING', attempts: 0, failedAt: null };
      const failedReady = {
        id: 'f-ready',
        status: 'FAILED',
        attempts: 2,
        failedAt: new Date(now.getTime() - 300_000),
      };
      const failedWaiting = {
        id: 'f-wait',
        status: 'FAILED',
        attempts: 2,
        failedAt: new Date(now.getTime() - 10_000),
      };
      (prisma.emailOutbox.findMany as jest.Mock).mockResolvedValue([
        pending,
        failedReady,
        failedWaiting,
      ]);
      const repo = new EmailOutboxRepository(prisma);

      const rows = await repo.findRetryable({ maxAttempts: 5, now, baseBackoffMs: 60_000 });

      expect(rows.map((r) => r.id)).toEqual(['p', 'f-ready']);
    });
  });
});
