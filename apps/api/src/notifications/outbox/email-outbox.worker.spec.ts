import { EmailOutboxWorker } from './email-outbox.worker';
import { EmailOutboxRepository, OutboxRow } from './email-outbox.repository';
import type { MailProvider } from '../providers/mail-provider.interface';

describe('EmailOutboxWorker', () => {
  const makeRepo = (rows: OutboxRow[]) =>
    ({
      findRetryable: jest.fn().mockResolvedValue(rows),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    }) as unknown as jest.Mocked<EmailOutboxRepository>;

  const makeProvider = (impl?: Partial<MailProvider>): jest.Mocked<MailProvider> =>
    ({
      send: jest.fn().mockResolvedValue({ providerMessageId: 'pm-1' }),
      ...impl,
    }) as unknown as jest.Mocked<MailProvider>;

  const row = (over: Partial<OutboxRow> = {}): OutboxRow => ({
    id: 'o-1',
    to: 'maria@test.com',
    subject: 'Redefinição de senha — Hope Saúde',
    tag: 'password-reset',
    status: 'PENDING',
    attempts: 0,
    failedAt: null,
    payload: JSON.stringify({
      userName: 'Maria',
      url: 'https://app.test/reset-password?token=abc',
    }),
    ...over,
  });

  it('envia retryável e marca SENT com providerMessageId', async () => {
    const repo = makeRepo([row()]);
    const provider = makeProvider();
    const worker = new EmailOutboxWorker(repo, provider);

    await worker.processOnce();

    expect(repo.findRetryable).toHaveBeenCalledWith(
      expect.objectContaining({ maxAttempts: 5, now: expect.any(Date) }),
    );
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'maria@test.com',
        tag: 'password-reset',
        htmlBody: expect.stringContaining('Maria'),
      }),
    );
    expect(repo.markSent).toHaveBeenCalledWith('o-1', 'pm-1');
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('reprocessa FAILED: ao falhar de novo, marca FAILED com a mensagem do erro', async () => {
    const repo = makeRepo([row({ id: 'o-2', status: 'FAILED', attempts: 2 })]);
    const provider = makeProvider({
      send: jest.fn().mockRejectedValue(new Error('postmark down')),
    });
    const worker = new EmailOutboxWorker(repo, provider);

    await worker.processOnce();

    expect(repo.markFailed).toHaveBeenCalledWith('o-2', 'postmark down');
    expect(repo.markSent).not.toHaveBeenCalled();
  });

  it('não envia nada quando findRetryable devolve vazio (backoff/N respeitados pelo repo)', async () => {
    const repo = makeRepo([]);
    const provider = makeProvider();
    const worker = new EmailOutboxWorker(repo, provider);

    await worker.processOnce();

    expect(provider.send).not.toHaveBeenCalled();
    expect(repo.markSent).not.toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('uma falha não impede o processamento das demais linhas', async () => {
    const repo = makeRepo([
      row({ id: 'a' }),
      row({ id: 'b', tag: 'email-verification', subject: 'Confirme seu email — Hope Saúde' }),
    ]);
    const provider = makeProvider({
      send: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ providerMessageId: 'pm-2' }),
    });
    const worker = new EmailOutboxWorker(repo, provider);

    await worker.processOnce();

    expect(repo.markFailed).toHaveBeenCalledWith('a', 'boom');
    expect(repo.markSent).toHaveBeenCalledWith('b', 'pm-2');
  });

  it('payload com tag desconhecida: marca FAILED sem chamar provider', async () => {
    const repo = makeRepo([row({ id: 'x', tag: 'mistério' })]);
    const provider = makeProvider();
    const worker = new EmailOutboxWorker(repo, provider);

    await worker.processOnce();

    expect(provider.send).not.toHaveBeenCalled();
    expect(repo.markFailed).toHaveBeenCalledWith('x', expect.stringMatching(/tag/i));
  });
});
