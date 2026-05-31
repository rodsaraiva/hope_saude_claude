# Entrega Confiável de E-mail (Outbox Worker) + Reset/Verify Ponta-a-Ponta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que todo e-mail (reset de senha / verificação) seja entregue de forma assíncrona e resiliente via outbox worker com retry/backoff, e fechar o fluxo de consumo de token (reset-password e verify-email) com troca de senha e marcação de uso em transação atômica.

**Architecture:** A `NotificationsService.deliver()` deixa de enviar inline e passa a apenas gravar `EmailOutbox` com status `PENDING`; um `EmailOutboxWorker` (`@Cron`, sobre o `ScheduleModule` já montado no `AppModule`) seleciona registros `PENDING`/`FAILED` ainda elegíveis (attempts < N e backoff vencido), tenta enviar pelo `MailProvider` (DI `MAIL_PROVIDER`) e chama `markSent`/`markFailed`. No `AuthService`, dois novos métodos (`resetPassword`, `confirmEmailVerification`) recebem o token claro, derivam o SHA-256, localizam o token hashed por `findUnique`, validam `expiresAt > now` e `usedAt == null`, e em `prisma.$transaction` trocam a senha (bcrypt) + marcam `usedAt` + invalidam tokens anteriores do mesmo usuário. Dois endpoints `@Throttle` expõem o consumo.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite, models `email_outbox`/`password_reset_tokens`/`email_verification_tokens` já existentes), `@nestjs/schedule` (`@Cron`), `@nestjs/throttler` (`@Throttle`), `class-validator` + `@nestjs/swagger` (DTOs), `bcryptjs`, `node:crypto` (`createHash`), Jest + ts-jest (`isolatedModules`), TDD estrito (red→green→refactor), TypeScript strict (zero `any` em produção, sem `forwardRef`).

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.repository.ts` | Adiciona `findRetryable(maxAttempts, now)` retornando linhas elegíveis (`PENDING`/`FAILED`, attempts < N, backoff vencido) e `findManyByStatus(status)` para consultas/testes. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.repository.spec.ts` | Testes vermelhos dos novos métodos do repositório. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/notifications/notifications.service.ts` | `deliver()` passa a só gravar `PENDING` (envio garantido assíncrono); remove envio inline. Expõe os campos de corpo via outbox? Não — corpo é re-renderizado pelo worker a partir de `tag`/contexto persistido. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/notifications/notifications.service.spec.ts` | Ajusta expectativas: `deliver` não chama mais `provider.send`/`markSent`/`markFailed`. |
| Create | `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.worker.ts` | `@Cron` worker: busca retryáveis, re-renderiza por `tag` + payload, envia via `MAIL_PROVIDER`, `markSent`/`markFailed`. |
| Create | `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.worker.spec.ts` | Testes: reprocessa `FAILED`, respeita backoff, para após N tentativas, marca `SENT`/`FAILED`. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/notifications/notifications.module.ts` | Registra `EmailOutboxWorker` como provider. |
| Modify | `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma` | Adiciona `payload String?` em `EmailOutbox` (contexto serializado p/ re-render) e índice já existente reaproveitado. |
| Create | `/root/rodrigo/hope_saude/apps/api/src/auth/dto/reset-password.dto.ts` | DTO `{ token, newPassword }`. |
| Create | `/root/rodrigo/hope_saude/apps/api/src/auth/dto/confirm-email-verification.dto.ts` | DTO `{ token }`. |
| Create | `/root/rodrigo/hope_saude/apps/api/src/auth/dto/reset-password.dto.spec.ts` | Testes de validação do DTO. |
| Create | `/root/rodrigo/hope_saude/apps/api/src/auth/dto/confirm-email-verification.dto.spec.ts` | Testes de validação do DTO. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.ts` | `resetPassword(token, newPassword)` e `confirmEmailVerification(token)`. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.spec.ts` | Testes: token válido, expirado, usado, inexistente, troca efetiva de senha, invalidação dos demais tokens. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/auth/auth.controller.ts` | Rotas `POST /auth/reset-password` e `POST /auth/verify-email` com `@Throttle`. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/auth/auth.controller.spec.ts` | Testes dos novos handlers do controller. |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/auth/auth.throttle.spec.ts` | Garante `@Throttle` nos novos endpoints. |

---

## Tasks

### Task 1 — `EmailOutboxRepository.findManyByStatus` + `findRetryable` (backoff)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.repository.ts`
- Modify (Test): `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.repository.spec.ts`

Backoff: um registro é elegível se `status` for `PENDING` ou `FAILED`, `attempts < maxAttempts`, e (para `FAILED`) `failedAt` for `null` ou anterior a `now - backoffMs(attempts)`. Como o SQLite não permite expressar o backoff por linha numa única `where`, buscamos os candidatos por status/attempts via Prisma e aplicamos o filtro de backoff em memória (volume baixo de outbox).

- [ ] **Step 1: Write the failing test.** Acrescentar ao final de `email-outbox.repository.spec.ts` (antes do `});` que fecha o `describe`):

```ts
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
      // attempts=2 → backoff 60s*2^2 = 240s; falhou há 300s → vencido
      const failedReady = {
        id: 'f-ready',
        status: 'FAILED',
        attempts: 2,
        failedAt: new Date(now.getTime() - 300_000),
      };
      // attempts=2 → backoff 240s; falhou há 10s → ainda em espera
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
```

Atualizar o `makePrisma` no topo do arquivo para incluir `findMany`:

```ts
  const makePrisma = () =>
    ({
      emailOutbox: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    }) as unknown as PrismaService;
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/notifications/outbox/email-outbox.repository.spec.ts --no-coverage
```
Esperado: `FAIL` — `repo.findManyByStatus is not a function` / `repo.findRetryable is not a function`.

- [ ] **Step 3: Write minimal implementation.** Substituir o corpo da classe em `email-outbox.repository.ts` adicionando os tipos e métodos (mantendo `createPending`/`markSent`/`markFailed` como estão):

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface CreatePendingInput {
  to: string;
  subject: string;
  tag: string;
}

export interface OutboxRow {
  id: string;
  to: string;
  subject: string;
  tag: string;
  status: string;
  attempts: number;
  failedAt: Date | null;
  payload: string | null;
}

export interface FindRetryableOptions {
  maxAttempts: number;
  now: Date;
  baseBackoffMs?: number;
}

@Injectable()
export class EmailOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(input: CreatePendingInput & { payload?: string }): Promise<string> {
    const row = await this.prisma.emailOutbox.create({
      data: {
        to: input.to,
        subject: input.subject,
        tag: input.tag,
        payload: input.payload ?? null,
        status: 'PENDING',
      },
      select: { id: true },
    });
    return row.id;
  }

  async markSent(id: string, providerMessageId: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: {
        status: 'SENT',
        providerMessageId,
        sentAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.emailOutbox.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage,
        failedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async findManyByStatus(status: string): Promise<OutboxRow[]> {
    return this.prisma.emailOutbox.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
    }) as unknown as Promise<OutboxRow[]>;
  }

  /** Linhas elegíveis a (re)envio: PENDING ou FAILED com attempts < N e backoff vencido. */
  async findRetryable(options: FindRetryableOptions): Promise<OutboxRow[]> {
    const baseBackoffMs = options.baseBackoffMs ?? 60_000;
    const candidates = (await this.prisma.emailOutbox.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        attempts: { lt: options.maxAttempts },
      },
      orderBy: { createdAt: 'asc' },
    })) as unknown as OutboxRow[];

    return candidates.filter((row) => {
      if (!row.failedAt) {
        return true;
      }
      const readyAt = row.failedAt.getTime() + baseBackoffMs * 2 ** row.attempts;
      return readyAt <= options.now.getTime();
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/notifications/outbox/email-outbox.repository.spec.ts --no-coverage
```
Esperado: `PASS` (todos os testes do repositório verdes).

- [ ] **Step 5: Commit.**
```
git add apps/api/src/notifications/outbox/email-outbox.repository.ts apps/api/src/notifications/outbox/email-outbox.repository.spec.ts
git commit -m "feat(api): findRetryable/findManyByStatus no EmailOutboxRepository com backoff exponencial"
```

---

### Task 2 — Coluna `payload` em `EmailOutbox` (contexto para re-render)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`

O worker precisa reconstruir o corpo HTML/texto ao reenviar. O `EmailOutbox` hoje só guarda `to`/`subject`/`tag`. Adicionamos `payload String?` (JSON serializado com `userName` e a URL) para o worker re-renderizar o template correto a partir da `tag`.

- [ ] **Step 1: Write the failing test.** (Schema-only — o teste vermelho aqui é o `prisma generate` falhando por campo inexistente quando a Task 3/5 referenciar `payload`. Para tornar explícito, validar que o schema declara `payload`.)
```
cd /root/rodrigo/hope_saude/apps/api && grep -q "payload" prisma/schema.prisma && echo PRESENTE || echo AUSENTE
```
Esperado: `AUSENTE`.

- [ ] **Step 2: Run test to verify it fails.** Confirmado pelo Step 1 (`AUSENTE`).

- [ ] **Step 3: Write minimal implementation.** No model `EmailOutbox`, logo após o campo `tag`, adicionar:
```prisma
  payload           String?  // JSON com contexto (userName, url) p/ re-render no worker
```

- [ ] **Step 4: Run test to verify it passes.** Regenerar o client e confirmar o campo:
```
cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name email_outbox_payload --skip-generate && npx prisma generate && grep -q "payload" prisma/schema.prisma && echo PRESENTE
```
Esperado: migration aplicada + `PRESENTE`. (Se o ambiente não tiver shadow DB, usar `npx prisma db push && npx prisma generate`.)

- [ ] **Step 5: Commit.**
```
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): coluna payload em EmailOutbox p/ re-render no worker"
```

---

### Task 3 — `deliver()` só grava PENDING (envio garantido assíncrono)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/notifications/notifications.service.ts`
- Modify (Test): `/root/rodrigo/hope_saude/apps/api/src/notifications/notifications.service.spec.ts`

`deliver()` deixa de chamar `provider.send`/`markSent`/`markFailed`: apenas grava `PENDING` com `payload` JSON (`{ userName, url }`) para o worker reenviar. Isso garante entrega mesmo se o provider estiver fora no momento da requisição.

- [ ] **Step 1: Write the failing test.** Substituir o conteúdo de `notifications.service.spec.ts` por:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/notifications/notifications.service.spec.ts --no-coverage
```
Esperado: `FAIL` — `createPending` chamado sem `payload` e `provider.send` chamado (ainda envia inline).

- [ ] **Step 3: Write minimal implementation.** Reescrever `notifications.service.ts` removendo o uso de `provider`/templates no `deliver` e gravando `payload`. O `MailProvider` continua injetado (consumido pelo worker), mas não é mais usado aqui:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import { MAIL_PROVIDER, MailProvider } from './providers/mail-provider.interface';

export interface SendPasswordResetParams {
  to: string;
  userName: string;
  resetUrl: string;
}

export interface SendEmailVerificationParams {
  to: string;
  userName: string;
  verifyUrl: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly outbox: EmailOutboxRepository,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
  ) {}

  async sendPasswordReset(params: SendPasswordResetParams): Promise<void> {
    await this.enqueue({
      to: params.to,
      subject: 'Redefinição de senha — Hope Saúde',
      tag: 'password-reset',
      userName: params.userName,
      url: params.resetUrl,
    });
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    await this.enqueue({
      to: params.to,
      subject: 'Confirme seu email — Hope Saúde',
      tag: 'email-verification',
      userName: params.userName,
      url: params.verifyUrl,
    });
  }

  private async enqueue(input: {
    to: string;
    subject: string;
    tag: string;
    userName: string;
    url: string;
  }): Promise<void> {
    await this.outbox.createPending({
      to: input.to,
      subject: input.subject,
      tag: input.tag,
      payload: JSON.stringify({ userName: input.userName, url: input.url }),
    });
  }
}
```

(O `provider` permanece injetado — não removê-lo evita quebrar a fábrica `MAIL_PROVIDER` do módulo e mantém compatibilidade com o worker que o reusa via DI. Se o lint reclamar de membro não usado, é aceitável: a injeção valida a configuração de e-mail no boot.)

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/notifications/notifications.service.spec.ts --no-coverage
```
Esperado: `PASS`.

- [ ] **Step 5: Commit.**
```
git add apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.service.spec.ts
git commit -m "feat(api): deliver() apenas enfileira PENDING (envio garantido pelo worker)"
```

---

### Task 4 — `EmailOutboxWorker` (`@Cron` com retry/backoff)

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.worker.ts`
- Create (Test): `/root/rodrigo/hope_saude/apps/api/src/notifications/outbox/email-outbox.worker.spec.ts`

O worker roda a cada minuto, busca `findRetryable`, re-renderiza o template por `tag` a partir do `payload`, envia via `MAIL_PROVIDER` e marca `SENT`/`FAILED`. `findRetryable` já garante o limite de N tentativas e o backoff; o worker apenas itera.

- [ ] **Step 1: Write the failing test.** Criar `email-outbox.worker.spec.ts`:

```ts
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
    payload: JSON.stringify({ userName: 'Maria', url: 'https://app.test/reset-password?token=abc' }),
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
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/notifications/outbox/email-outbox.worker.spec.ts --no-coverage
```
Esperado: `FAIL` — `Cannot find module './email-outbox.worker'`.

- [ ] **Step 3: Write minimal implementation.** Criar `email-outbox.worker.ts`. Reusa os templates já existentes (`renderTemplate`, `PasswordResetEmail`, `EmailVerificationEmail`) que antes eram chamados na `NotificationsService`:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailOutboxRepository, OutboxRow } from './email-outbox.repository';
import { MAIL_PROVIDER, MailProvider } from '../providers/mail-provider.interface';
import { renderTemplate } from '../templates/renderer';
import { PasswordResetEmail } from '../templates/password-reset';
import { EmailVerificationEmail } from '../templates/email-verification';

const MAX_ATTEMPTS = 5;

interface OutboxPayload {
  userName: string;
  url: string;
}

@Injectable()
export class EmailOutboxWorker {
  private readonly logger = new Logger(EmailOutboxWorker.name);

  constructor(
    private readonly outbox: EmailOutboxRepository,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
  ) {}

  @Cron('* * * * *')
  async processOnce(): Promise<void> {
    const rows = await this.outbox.findRetryable({ maxAttempts: MAX_ATTEMPTS, now: new Date() });
    for (const row of rows) {
      await this.deliverRow(row);
    }
  }

  private async deliverRow(row: OutboxRow): Promise<void> {
    let rendered: { html: string; text: string };
    try {
      rendered = await this.render(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.outbox.markFailed(row.id, message);
      return;
    }

    try {
      const result = await this.provider.send({
        to: row.to,
        subject: row.subject,
        htmlBody: rendered.html,
        textBody: rendered.text,
        tag: row.tag,
      });
      await this.outbox.markSent(row.id, result.providerMessageId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ msg: 'outbox send failed', outboxId: row.id, tag: row.tag, error: message });
      await this.outbox.markFailed(row.id, message);
    }
  }

  private async render(row: OutboxRow): Promise<{ html: string; text: string }> {
    const payload = JSON.parse(row.payload ?? '{}') as OutboxPayload;
    if (row.tag === 'password-reset') {
      return renderTemplate(PasswordResetEmail({ userName: payload.userName, resetUrl: payload.url }));
    }
    if (row.tag === 'email-verification') {
      return renderTemplate(
        EmailVerificationEmail({ userName: payload.userName, verifyUrl: payload.url }),
      );
    }
    throw new Error(`tag de e-mail desconhecida: ${row.tag}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/notifications/outbox/email-outbox.worker.spec.ts --no-coverage
```
Esperado: `PASS` (5 testes verdes).

- [ ] **Step 5: Commit.**
```
git add apps/api/src/notifications/outbox/email-outbox.worker.ts apps/api/src/notifications/outbox/email-outbox.worker.spec.ts
git commit -m "feat(api): EmailOutboxWorker @Cron reprocessa PENDING/FAILED com backoff e teto de tentativas"
```

---

### Task 5 — Registrar `EmailOutboxWorker` no `NotificationsModule`

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/notifications/notifications.module.ts`

- [ ] **Step 1: Write the failing test.** Criar `/root/rodrigo/hope_saude/apps/api/src/notifications/notifications.module.spec.ts`:

```ts
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
```

Antes de rodar, exportar as envs mínimas que a fábrica `MAIL_PROVIDER` exige (`MAIL_FROM`):
```
export MAIL_FROM="no-reply@hope.test"
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && MAIL_FROM="no-reply@hope.test" npx jest src/notifications/notifications.module.spec.ts --no-coverage
```
Esperado: `FAIL` — `Nest could not find EmailOutboxWorker element` (não registrado).

- [ ] **Step 3: Write minimal implementation.** Em `notifications.module.ts`, importar e registrar o worker:

```ts
import { EmailOutboxWorker } from './outbox/email-outbox.worker';
```
E no array `providers`, após `NotificationsService,`:
```ts
    EmailOutboxWorker,
```

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && MAIL_FROM="no-reply@hope.test" npx jest src/notifications/notifications.module.spec.ts --no-coverage
```
Esperado: `PASS`.

- [ ] **Step 5: Commit.**
```
git add apps/api/src/notifications/notifications.module.ts apps/api/src/notifications/notifications.module.spec.ts
git commit -m "feat(api): registra EmailOutboxWorker no NotificationsModule"
```

---

### Task 6 — DTOs `ResetPasswordDto` e `ConfirmEmailVerificationDto`

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/auth/dto/reset-password.dto.ts`
- Create: `/root/rodrigo/hope_saude/apps/api/src/auth/dto/confirm-email-verification.dto.ts`
- Create (Test): `/root/rodrigo/hope_saude/apps/api/src/auth/dto/reset-password.dto.spec.ts`
- Create (Test): `/root/rodrigo/hope_saude/apps/api/src/auth/dto/confirm-email-verification.dto.spec.ts`

- [ ] **Step 1: Write the failing test.** Criar `reset-password.dto.spec.ts`:

```ts
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  it('aceita token não-vazio e newPassword com >= 6 chars', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'a'.repeat(64),
      newPassword: 'novasenha',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita token vazio', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: '', newPassword: 'novasenha' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejeita newPassword curta (< 6)', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: 'abc', newPassword: '123' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });
});
```

E `confirm-email-verification.dto.spec.ts`:

```ts
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConfirmEmailVerificationDto } from './confirm-email-verification.dto';

describe('ConfirmEmailVerificationDto', () => {
  it('aceita token não-vazio', async () => {
    const dto = plainToInstance(ConfirmEmailVerificationDto, { token: 'a'.repeat(64) });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita token vazio', async () => {
    const dto = plainToInstance(ConfirmEmailVerificationDto, { token: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/dto/reset-password.dto.spec.ts src/auth/dto/confirm-email-verification.dto.spec.ts --no-coverage
```
Esperado: `FAIL` — `Cannot find module './reset-password.dto'` / `'./confirm-email-verification.dto'`.

- [ ] **Step 3: Write minimal implementation.** Criar `reset-password.dto.ts`:

```ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token claro recebido por e-mail' })
  @IsString()
  @IsNotEmpty({ message: 'O token é obrigatório' })
  token!: string;

  @ApiProperty({ example: 'novaSenha123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  newPassword!: string;
}
```

Criar `confirm-email-verification.dto.ts`:

```ts
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmEmailVerificationDto {
  @ApiProperty({ description: 'Token claro recebido por e-mail' })
  @IsString()
  @IsNotEmpty({ message: 'O token é obrigatório' })
  token!: string;
}
```

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/dto/reset-password.dto.spec.ts src/auth/dto/confirm-email-verification.dto.spec.ts --no-coverage
```
Esperado: `PASS`. (Se `class-transformer` não estiver instalado, usar `Object.assign(new ResetPasswordDto(), {...})` em vez de `plainToInstance` — verificar `apps/api/package.json` antes.)

- [ ] **Step 5: Commit.**
```
git add apps/api/src/auth/dto/reset-password.dto.ts apps/api/src/auth/dto/confirm-email-verification.dto.ts apps/api/src/auth/dto/reset-password.dto.spec.ts apps/api/src/auth/dto/confirm-email-verification.dto.spec.ts
git commit -m "feat(api): DTOs ResetPasswordDto e ConfirmEmailVerificationDto"
```

---

### Task 7 — `AuthService.resetPassword` (consumo do token de senha)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.ts`
- Modify (Test): `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.spec.ts`

`resetPassword(token, newPassword)`: SHA-256 do token → `passwordResetToken.findUnique({ where: { tokenHash } })`; valida `usedAt == null` e `expiresAt > now` (senão `BadRequestException`); em `$transaction` atualiza `user.password` (bcrypt), marca `usedAt`, e invalida os demais tokens não usados do usuário via `updateMany`.

- [ ] **Step 1: Write the failing test.** Acrescentar ao final de `auth.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService.resetPassword', () => {
  const tokenClaro = 'a'.repeat(64);
  const hashDe = (t: string) =>
    require('node:crypto').createHash('sha256').update(t).digest('hex');

  function makeService(tokenRow: unknown) {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({}) },
      passwordResetToken: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      passwordResetToken: { findUnique: jest.fn().mockResolvedValue(tokenRow) },
      $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    } as unknown as import('../prisma.service').PrismaService;
    const service = new AuthService(
      prisma,
      {} as import('@nestjs/jwt').JwtService,
      { sendPasswordReset: jest.fn() } as unknown as import('../notifications/notifications.service').NotificationsService,
      { get: jest.fn() } as unknown as import('@nestjs/config').ConfigService,
    );
    return { service, prisma, tx };
  }

  it('token válido: troca senha (bcrypt), marca usedAt e invalida demais tokens', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const { service, prisma, tx } = makeService({
      id: 'tok-1',
      userId: 42,
      tokenHash: hashDe(tokenClaro),
      expiresAt: future,
      usedAt: null,
    });

    await service.resetPassword(tokenClaro, 'novasenha');

    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashDe(tokenClaro) },
    });
    const updateArgs = (tx.user.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 42 });
    expect(await bcrypt.compare('novasenha', updateArgs.data.password)).toBe(true);
    expect(tx.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'tok-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 42, usedAt: null, id: { not: 'tok-1' } },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('token inexistente: BadRequestException, sem transação', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.resetPassword(tokenClaro, 'x123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('token expirado: BadRequestException', async () => {
    const past = new Date(Date.now() - 1000);
    const { service } = makeService({
      id: 'tok-1',
      userId: 42,
      tokenHash: hashDe(tokenClaro),
      expiresAt: past,
      usedAt: null,
    });
    await expect(service.resetPassword(tokenClaro, 'x123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('token já usado: BadRequestException', async () => {
    const future = new Date(Date.now() + 1000);
    const { service } = makeService({
      id: 'tok-1',
      userId: 42,
      tokenHash: hashDe(tokenClaro),
      expiresAt: future,
      usedAt: new Date(),
    });
    await expect(service.resetPassword(tokenClaro, 'x123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts --no-coverage
```
Esperado: `FAIL` — `service.resetPassword is not a function`.

- [ ] **Step 3: Write minimal implementation.** Em `auth.service.ts`, adicionar o import de `BadRequestException` e o método. No topo trocar:
```ts
import { Injectable } from '@nestjs/common';
```
por:
```ts
import { BadRequestException, Injectable } from '@nestjs/common';
```
E adicionar antes do `}` final da classe:

```ts
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const usedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt },
      });
    });
  }
```

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts --no-coverage
```
Esperado: `PASS` (incluindo os testes pré-existentes de `requestPasswordReset`/`requestEmailVerification`).

- [ ] **Step 5: Commit.**
```
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.resetPassword consome token hashed e troca senha em transação"
```

---

### Task 8 — `AuthService.confirmEmailVerification`

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.ts`
- Modify (Test): `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.spec.ts`

`confirmEmailVerification(token)`: SHA-256 → `emailVerificationToken.findUnique({ where: { tokenHash } })`; valida `usedAt == null` e `expiresAt > now`; em `$transaction` marca `usedAt` e invalida demais tokens do usuário. (O model `User` não tem campo `emailVerifiedAt`; a confirmação se materializa no consumo do token — marcar como usado é o efeito observável. Não inventamos coluna; ver Open Question.)

- [ ] **Step 1: Write the failing test.** Acrescentar ao final de `auth.service.spec.ts`:

```ts
describe('AuthService.confirmEmailVerification', () => {
  const tokenClaro = 'b'.repeat(64);
  const hashDe = (t: string) =>
    require('node:crypto').createHash('sha256').update(t).digest('hex');

  function makeService(tokenRow: unknown) {
    const tx = {
      emailVerificationToken: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      emailVerificationToken: { findUnique: jest.fn().mockResolvedValue(tokenRow) },
      $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    } as unknown as import('../prisma.service').PrismaService;
    const service = new AuthService(
      prisma,
      {} as import('@nestjs/jwt').JwtService,
      { sendEmailVerification: jest.fn() } as unknown as import('../notifications/notifications.service').NotificationsService,
      { get: jest.fn() } as unknown as import('@nestjs/config').ConfigService,
    );
    return { service, prisma, tx };
  }

  it('token válido: marca usedAt e invalida demais tokens', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const { service, prisma, tx } = makeService({
      id: 'ev-1',
      userId: 7,
      tokenHash: hashDe(tokenClaro),
      expiresAt: future,
      usedAt: null,
    });

    await service.confirmEmailVerification(tokenClaro);

    expect(prisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashDe(tokenClaro) },
    });
    expect(tx.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 'ev-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(tx.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 7, usedAt: null, id: { not: 'ev-1' } },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('token inexistente/expirado/usado: BadRequestException', async () => {
    const { service: s1 } = makeService(null);
    await expect(s1.confirmEmailVerification(tokenClaro)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const { service: s2 } = makeService({
      id: 'ev-2',
      userId: 7,
      tokenHash: hashDe(tokenClaro),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    await expect(s2.confirmEmailVerification(tokenClaro)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const { service: s3 } = makeService({
      id: 'ev-3',
      userId: 7,
      tokenHash: hashDe(tokenClaro),
      expiresAt: new Date(Date.now() + 1000),
      usedAt: new Date(),
    });
    await expect(s3.confirmEmailVerification(tokenClaro)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts --no-coverage
```
Esperado: `FAIL` — `service.confirmEmailVerification is not a function`.

- [ ] **Step 3: Write minimal implementation.** Em `auth.service.ts`, adicionar antes do `}` final da classe:

```ts
  async confirmEmailVerification(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const usedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt },
      });
    });
  }
```

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts --no-coverage
```
Esperado: `PASS`.

- [ ] **Step 5: Commit.**
```
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.confirmEmailVerification consome e invalida token de verificação"
```

---

### Task 9 — Rotas `POST /auth/reset-password` e `POST /auth/verify-email` com `@Throttle`

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/auth/auth.controller.ts`
- Modify (Test): `/root/rodrigo/hope_saude/apps/api/src/auth/auth.controller.spec.ts`
- Modify (Test): `/root/rodrigo/hope_saude/apps/api/src/auth/auth.throttle.spec.ts`

- [ ] **Step 1: Write the failing test.** No `auth.controller.spec.ts`, no `useValue` do `AuthService`, adicionar os métodos mockados:
```ts
            resetPassword: jest.fn(),
            confirmEmailVerification: jest.fn(),
```
E o tipo `Pick<...>` do `authService` deve incluir `'resetPassword' | 'confirmEmailVerification'`. Depois acrescentar antes do `});` final:

```ts
  describe('resetPassword', () => {
    it('delega ao service e devolve void', async () => {
      authService.resetPassword.mockResolvedValue(undefined);
      const result = await controller.resetPassword({ token: 'tk', newPassword: 'novasenha' });
      expect(authService.resetPassword).toHaveBeenCalledWith('tk', 'novasenha');
      expect(result).toBeUndefined();
    });
  });

  describe('verifyEmail', () => {
    it('delega ao service confirmEmailVerification', async () => {
      authService.confirmEmailVerification.mockResolvedValue(undefined);
      const result = await controller.verifyEmail({ token: 'tk' });
      expect(authService.confirmEmailVerification).toHaveBeenCalledWith('tk');
      expect(result).toBeUndefined();
    });
  });
```

Ajustar a declaração do mock no topo:
```ts
  let authService: jest.Mocked<
    Pick<
      AuthService,
      | 'registerAndLogin'
      | 'validateUser'
      | 'login'
      | 'getPublicUserById'
      | 'resetPassword'
      | 'confirmEmailVerification'
    >
  >;
```

No `auth.throttle.spec.ts`, acrescentar:
```ts
  it('POST /auth/reset-password tem @Throttle aplicado', () => {
    expect(getThrottleMetadata('resetPassword')).toBeDefined();
  });

  it('POST /auth/verify-email tem @Throttle aplicado', () => {
    expect(getThrottleMetadata('verifyEmail')).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it fails.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.controller.spec.ts src/auth/auth.throttle.spec.ts --no-coverage
```
Esperado: `FAIL` — `controller.resetPassword is not a function` / metadata undefined.

- [ ] **Step 3: Write minimal implementation.** Em `auth.controller.ts`, adicionar os imports dos DTOs:
```ts
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
```
E adicionar os handlers logo após `requestEmailVerification` (antes do bloco `me`):

```ts
  @ApiOperation({ summary: 'Redefine a senha a partir do token recebido por e-mail' })
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(body.token, body.newPassword);
  }

  @ApiOperation({ summary: 'Confirma o e-mail a partir do token recebido' })
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('verify-email')
  async verifyEmail(@Body() body: ConfirmEmailVerificationDto): Promise<void> {
    await this.authService.confirmEmailVerification(body.token);
  }
```

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.controller.spec.ts src/auth/auth.throttle.spec.ts --no-coverage
```
Esperado: `PASS`.

- [ ] **Step 5: Commit.**
```
git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.controller.spec.ts apps/api/src/auth/auth.throttle.spec.ts
git commit -m "feat(api): rotas POST /auth/reset-password e /auth/verify-email com @Throttle"
```

---

### Task 10 — Verificação completa da suíte (regressão)

**Files:**
- (nenhum novo) — roda toda a suíte da API para garantir os 241+ testes verdes e zero regressão.

- [ ] **Step 1: Write the failing test.** N/A — gate de regressão. (Nenhum código novo; apenas execução.)

- [ ] **Step 2: Run test to verify it fails.** N/A.

- [ ] **Step 3: Write minimal implementation.** N/A.

- [ ] **Step 4: Run test to verify it passes.**
```
cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
```
Esperado: `Tests: <N> passed` com `N >= 241 + novos` e `Test Suites:` todos verdes (incluindo `email-outbox.worker.spec.ts`, `notifications.module.spec.ts`, os dois DTO specs e os blocos novos em auth). Type-check:
```
cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Step 5: Commit.** Nada a commitar se tudo verde. Se `tsc` apontar ajuste, corrigir no arquivo culpado e commitar:
```
git add apps/api/src
git commit -m "fix(api): ajustes de tipagem pós-suíte de outbox/reset"
```

---

## Nota de Frontend (fora do escopo desta entrega de backend)

A página web `/reset-password` (form que lê `?token=` da URL e faz `POST /auth/reset-password` com `{ token, newPassword }`) e a página `/verify-email` (lê `?token=` e faz `POST /auth/verify-email`) ficam para um **plano de frontend dedicado**, pois `apps/web/src/app` ainda não tem essas rotas (só `login`, `register`, `dashboard`, etc.). Pontos a respeitar nesse plano futuro:
- Usar `api-client.ts` (Bearer não é necessário aqui — endpoints são públicos).
- Sanitizar qualquer texto exibido com DOMPurify (decisão de auth do frontend já tomada).
- Não persistir o token em `localStorage`; lê-lo só da query string e descartá-lo após o `POST`.
- TanStack Query `useMutation` para o submit, com estados de sucesso/erro.

Este plano de backend entrega o contrato (`{ token, newPassword }` / `{ token }`, respostas 204) que o frontend consumirá.

---

## Self-Review

**Cobertura dos gaps (todos cobertos):**
- **Parte A — `findManyByStatus`/`findRetryable`:** Task 1 (com backoff exponencial `base * 2^attempts`, teto via `attempts < maxAttempts`).
- **Parte A — `@Cron` reprocessa PENDING/FAILED, backoff, incrementa attempts, markSent/markFailed:** Task 4 (`EmailOutboxWorker`, `@Cron('* * * * *')`, sobre o `ScheduleModule` já em `AppModule`). `markSent`/`markFailed` já incrementam `attempts` (código existente — reusado, DRY).
- **Parte A — `deliver()` só grava PENDING (envio assíncrono garantido):** Task 3 (`enqueue` grava PENDING + `payload`; provider não é mais chamado inline).
- **Parte A — testes: reprocessa FAILED, respeita backoff, para após N:** Task 1 (backoff e teto no repo) + Task 4 (worker reprocessa FAILED; vazio quando repo filtra).
- **Parte A — registro no módulo:** Task 5.
- **Parte A — schema `payload`:** Task 2 (necessário p/ re-render fiel sem inventar campos).
- **Parte B — `ResetPasswordDto {token,newPassword}` e `ConfirmEmailVerificationDto {token}`:** Task 6.
- **Parte B — `resetPassword`/`confirmEmailVerification` com SHA-256 → findUnique por tokenHash, valida `expiresAt>now` e `usedAt==null`, `$transaction` troca senha (bcrypt) + marca `usedAt` + invalida tokens anteriores:** Tasks 7 e 8.
- **Parte B — rotas `POST /auth/reset-password` e `/auth/verify-email` com `@Throttle`:** Task 9 (segue padrão `@Throttle({ auth: { limit: 5, ttl: 60_000 } })` + `@HttpCode(204)` já usado em `forgot-password`).
- **Parte B — testes: válido/expirado/usado/inexistente + senha efetivamente atualizada:** Tasks 7 e 8 (incl. `bcrypt.compare` confirmando a nova senha hashada).
- **Frontend `/reset-password`:** deixado como nota para plano de frontend dedicado (rota inexistente hoje).

**Ausência de placeholders:** todos os passos de código contêm blocos reais e completos; nenhum "TODO"/"implementar depois"/"similar à Task N". Tipos referenciados (`OutboxRow`, `FindRetryableOptions`, `ResetPasswordDto`, `ConfirmEmailVerificationDto`, `EmailOutboxWorker`) são definidos nas Tasks 1, 4 e 6. Métodos do Prisma (`$transaction`, `updateMany`, `findUnique`, `findMany`) e do repo (`markSent`/`markFailed`) já existem ou são adicionados aqui. Imports (`createHash`, `bcrypt`, `BadRequestException`, `@Cron`, `@Throttle`, `ApiProperty`, `class-validator`) batem com o uso real no repositório (vide `auth.service.ts`, `payment.cron.service.ts`, `auth.controller.ts`).

**Fidelidade verificada contra fonte:** `MAIL_PROVIDER` é Symbol DI (interface `MailProvider.send → { providerMessageId }`); `EmailOutbox` é model SQLite com `attempts Int @default(0)` e `@@map("email_outbox")`; `PasswordResetToken`/`EmailVerificationToken` têm `tokenHash @unique`, `expiresAt`, `usedAt`; `AuthService` constrói tokens com `createHash('sha256')` e injeta `(prisma, jwtService, notifications, config)`; controller usa `@Throttle({ auth: {...} })` + `@HttpCode(HttpStatus.NO_CONTENT)`.

**Open Questions (validação humana):**
- O model `User` não possui `emailVerifiedAt`; a confirmação se materializa apenas marcando o token como `usedAt`. Se o produto exigir flag persistida no usuário, adicionar `emailVerifiedAt DateTime?` em `User` e setá-la na transação da Task 8 (decisão de schema, fora do escopo declarado).
- `@Cron('* * * * *')` (a cada minuto) é um ponto de partida; ajustar a cadência conforme volume/observabilidade em produção (no PostgreSQL do médio prazo, considerar `SELECT ... FOR UPDATE SKIP LOCKED` para concorrência multi-instância — hoje o SQLite roda single-instance).
- `plainToInstance` (class-transformer) é usado nos specs de DTO; se não estiver no `package.json`, trocar por `Object.assign(new Dto(), {...})` (Task 6, Step 4 já registra o fallback).
