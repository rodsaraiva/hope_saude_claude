import { NotificationsService } from './notifications.service';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import type { MailProvider } from './providers/mail-provider.interface';

describe('NotificationsService', () => {
  const makeRepo = () =>
    ({
      createPending: jest.fn().mockResolvedValue('outbox-1'),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    }) as unknown as jest.Mocked<EmailOutboxRepository>;

  const makeProvider = (impl?: Partial<MailProvider>): jest.Mocked<MailProvider> =>
    ({
      send: jest.fn().mockResolvedValue({ providerMessageId: 'pm-1' }),
      ...impl,
    }) as unknown as jest.Mocked<MailProvider>;

  function makeService(repo = makeRepo(), provider = makeProvider()) {
    return {
      service: new NotificationsService(repo, provider),
      repo,
      provider,
    };
  }

  describe('sendPasswordReset', () => {
    it('cria outbox, envia e marca SENT', async () => {
      const { service, repo, provider } = makeService();

      await service.sendPasswordReset({
        to: 'maria@test.com',
        userName: 'Maria',
        resetUrl: 'https://app.test/reset?t=abc',
      });

      expect(repo.createPending).toHaveBeenCalledWith({
        to: 'maria@test.com',
        subject: expect.stringMatching(/senha/i),
        tag: 'password-reset',
      });
      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'maria@test.com',
          tag: 'password-reset',
          htmlBody: expect.stringContaining('Maria'),
        }),
      );
      expect(repo.markSent).toHaveBeenCalledWith('outbox-1', 'pm-1');
      expect(repo.markFailed).not.toHaveBeenCalled();
    });

    it('quando provider falha: marca FAILED e não relança', async () => {
      const provider = makeProvider({
        send: jest.fn().mockRejectedValue(new Error('postmark down')),
      });
      const { service, repo } = makeService(undefined, provider);

      await expect(
        service.sendPasswordReset({
          to: 'a@b.com',
          userName: 'A',
          resetUrl: 'https://x',
        }),
      ).resolves.toBeUndefined();

      expect(repo.markFailed).toHaveBeenCalledWith('outbox-1', 'postmark down');
      expect(repo.markSent).not.toHaveBeenCalled();
    });

    it('quando createPending falha: propaga e não chama provider', async () => {
      const repo = makeRepo();
      (repo.createPending as jest.Mock).mockRejectedValue(new Error('db down'));
      const provider = makeProvider();
      const service = new NotificationsService(repo, provider);

      await expect(
        service.sendPasswordReset({ to: 'a@b.com', userName: 'a', resetUrl: 'u' }),
      ).rejects.toThrow('db down');
      expect(provider.send).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailVerification', () => {
    it('cria outbox, envia e marca SENT', async () => {
      const { service, repo, provider } = makeService();

      await service.sendEmailVerification({
        to: 'joao@test.com',
        userName: 'João',
        verifyUrl: 'https://app.test/verify?t=xyz',
      });

      expect(repo.createPending).toHaveBeenCalledWith({
        to: 'joao@test.com',
        subject: expect.stringMatching(/email/i),
        tag: 'email-verification',
      });
      expect(provider.send).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'email-verification' }),
      );
      expect(repo.markSent).toHaveBeenCalled();
    });
  });
});
