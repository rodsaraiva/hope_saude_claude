import { NotificationsService } from './notifications.service';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import type { MailProvider } from './providers/mail-provider.interface';

describe('NotificationsService (apenas enfileira PENDING)', () => {
  const makeRepo = () =>
    ({
      createPending: jest.fn().mockResolvedValue('outbox-1'),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    }) as unknown as jest.Mocked<EmailOutboxRepository>;

  const makeProvider = (): jest.Mocked<MailProvider> =>
    ({
      send: jest.fn().mockResolvedValue({ providerMessageId: 'pm-1' }),
    }) as unknown as jest.Mocked<MailProvider>;

  function makeService(repo = makeRepo(), provider = makeProvider()) {
    return { service: new NotificationsService(repo, provider), repo, provider };
  }

  describe('sendPasswordReset', () => {
    it('grava PENDING com payload e NÃO envia inline', async () => {
      const { service, repo, provider } = makeService();

      await service.sendPasswordReset({
        to: 'maria@test.com',
        userName: 'Maria',
        resetUrl: 'https://app.test/reset-password?token=abc',
      });

      expect(repo.createPending).toHaveBeenCalledWith({
        to: 'maria@test.com',
        subject: expect.stringMatching(/senha/i),
        tag: 'password-reset',
        payload: JSON.stringify({
          userName: 'Maria',
          url: 'https://app.test/reset-password?token=abc',
        }),
      });
      expect(provider.send).not.toHaveBeenCalled();
      expect(repo.markSent).not.toHaveBeenCalled();
      expect(repo.markFailed).not.toHaveBeenCalled();
    });

    it('propaga erro de createPending (sem envio)', async () => {
      const repo = makeRepo();
      (repo.createPending as jest.Mock).mockRejectedValue(new Error('db down'));
      const { service, provider } = makeService(repo);

      await expect(
        service.sendPasswordReset({ to: 'a@b.com', userName: 'a', resetUrl: 'u' }),
      ).rejects.toThrow('db down');
      expect(provider.send).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailVerification', () => {
    it('grava PENDING com tag email-verification e payload', async () => {
      const { service, repo, provider } = makeService();

      await service.sendEmailVerification({
        to: 'joao@test.com',
        userName: 'João',
        verifyUrl: 'https://app.test/verify-email?token=xyz',
      });

      expect(repo.createPending).toHaveBeenCalledWith({
        to: 'joao@test.com',
        subject: expect.stringMatching(/email/i),
        tag: 'email-verification',
        payload: JSON.stringify({
          userName: 'João',
          url: 'https://app.test/verify-email?token=xyz',
        }),
      });
      expect(provider.send).not.toHaveBeenCalled();
    });
  });
});
