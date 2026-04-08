# Postmark Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar MVP de notificações por email no `hope_saude` cobrindo recuperação de senha e verificação de email, com abstração `MailProvider` (Postmark em prod, Mailpit/SMTP em dev), outbox leve e integração no `AuthModule`.

**Architecture:** Novo módulo `NotificationsModule` em `apps/api/src/notifications/` com porta de entrada única (`NotificationsService`), porta de saída única (`MailProvider` interface), persistência em `EmailOutbox` (Prisma/SQLite), templates React Email em `.tsx`. Seleção de provider por env var `MAIL_DRIVER`. Envio síncrono, sem fila.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite), React Email, `postmark` SDK, `nodemailer` (SMTP), Jest, supertest, Mailpit (docker).

**Spec de referência:** `docs/superpowers/specs/2026-04-08-postmark-notifications-design.md`

**Premissa de escopo:** toda alteração fica dentro de `/root/hope_saude`.

---

## Estrutura de arquivos a criar/modificar

**Criar:**
- `apps/api/src/notifications/notifications.module.ts`
- `apps/api/src/notifications/notifications.service.ts`
- `apps/api/src/notifications/notifications.service.spec.ts`
- `apps/api/src/notifications/providers/mail-provider.interface.ts`
- `apps/api/src/notifications/providers/postmark.provider.ts`
- `apps/api/src/notifications/providers/postmark.provider.spec.ts`
- `apps/api/src/notifications/providers/smtp.provider.ts`
- `apps/api/src/notifications/providers/smtp.provider.spec.ts`
- `apps/api/src/notifications/outbox/email-outbox.repository.ts`
- `apps/api/src/notifications/outbox/email-outbox.repository.spec.ts`
- `apps/api/src/notifications/templates/renderer.ts`
- `apps/api/src/notifications/templates/renderer.spec.ts`
- `apps/api/src/notifications/templates/base-layout.tsx`
- `apps/api/src/notifications/templates/password-reset.tsx`
- `apps/api/src/notifications/templates/password-reset.spec.tsx`
- `apps/api/src/notifications/templates/email-verification.tsx`
- `apps/api/src/notifications/templates/email-verification.spec.tsx`
- `apps/api/test/notifications-auth.e2e-spec.ts`

**Modificar:**
- `apps/api/package.json` — novas deps
- `apps/api/prisma/schema.prisma` — modelos `EmailOutbox`, `PasswordResetToken`, `EmailVerificationToken`
- `apps/api/.env.example` — novas variáveis
- `apps/api/src/auth/auth.module.ts` — importar `NotificationsModule`
- `apps/api/src/auth/auth.service.ts` — métodos `requestPasswordReset`, `requestEmailVerification`
- `apps/api/src/auth/auth.service.spec.ts` (pode não existir ainda — criar se precisar)
- `apps/api/src/auth/auth.controller.ts` — endpoints `POST /auth/forgot-password` e `POST /auth/verify-email/request`
- `apps/api/src/auth/dto/` — novos DTOs
- `docker-compose.yml` — serviço `mailpit`

---

## Task 1: Dependências e variáveis de ambiente

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example` (criar se não existir)

- [ ] **Step 1: Adicionar dependências**

Run (a partir de `/root/hope_saude/apps/api`):

```bash
npm install postmark nodemailer @react-email/components @react-email/render react react-dom
npm install -D @types/nodemailer @types/react @types/react-dom
```

- [ ] **Step 2: Adicionar variáveis ao .env.example**

Append ao final de `apps/api/.env.example` (criar o arquivo se não existir, preservando conteúdo atual):

```env

# --- Notifications ---
MAIL_DRIVER=smtp
MAIL_FROM="Hope Saúde <no-reply@hopesaude.com.br>"
MAIL_APP_URL=http://localhost:3001

# Postmark (prod)
POSTMARK_SERVER_TOKEN=
POSTMARK_MESSAGE_STREAM=outbound

# SMTP (dev/staging via Mailpit)
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
```

- [ ] **Step 3: Commit**

```bash
cd /root/hope_saude && git add apps/api/package.json apps/api/package-lock.json apps/api/.env.example && git commit -m "chore(api): deps e env vars para notifications module"
```

---

## Task 2: Mailpit no docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Adicionar serviço mailpit**

Adicionar ao `services:` do `docker-compose.yml` (antes de `volumes:`):

```yaml
  mailpit:
    image: axllent/mailpit:latest
    container_name: hope-saude-mailpit
    ports:
      - "1025:1025"
      - "8025:8025"
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1
    restart: unless-stopped
```

- [ ] **Step 2: Verificar subida**

Run: `cd /root/hope_saude && docker compose up -d mailpit && docker compose ps mailpit`
Expected: mailpit listado como `running` / `healthy`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml && git commit -m "chore(infra): mailpit em docker-compose de dev"
```

---

## Task 3: Modelos Prisma (EmailOutbox + tokens)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Adicionar modelos ao schema**

Append ao final de `apps/api/prisma/schema.prisma`:

```prisma
model EmailOutbox {
  id                String   @id @default(uuid())
  to                String
  subject           String
  tag               String
  status            String   @default("PENDING") // PENDING | SENT | FAILED
  providerMessageId String?
  errorMessage      String?
  attempts          Int      @default(0)
  createdAt         DateTime @default(now())
  sentAt            DateTime?
  failedAt          DateTime?

  @@index([status, createdAt])
  @@index([tag, createdAt])
  @@map("email_outbox")
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    Int
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("password_reset_tokens")
}

model EmailVerificationToken {
  id        String   @id @default(uuid())
  userId    Int
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("email_verification_tokens")
}
```

Nota: `status` é `String` (não enum) por compatibilidade com SQLite, seguindo o padrão já usado em `User.role` no mesmo schema.

- [ ] **Step 2: Gerar migration**

Run: `cd /root/hope_saude/apps/api && npx prisma migrate dev --name add_email_outbox_and_auth_tokens`
Expected: migration criada em `prisma/migrations/`, cliente Prisma regenerado.

- [ ] **Step 3: Commit**

```bash
cd /root/hope_saude && git add apps/api/prisma && git commit -m "feat(api): schema email_outbox + tokens de auth"
```

---

## Task 4: Interface `MailProvider`

**Files:**
- Create: `apps/api/src/notifications/providers/mail-provider.interface.ts`

- [ ] **Step 1: Criar arquivo de interface**

```ts
// apps/api/src/notifications/providers/mail-provider.interface.ts
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface OutgoingEmail {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  tag: string;
  messageStream?: string;
}

export interface MailSendResult {
  providerMessageId: string;
}

export interface MailProvider {
  send(message: OutgoingEmail): Promise<MailSendResult>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/notifications/providers/mail-provider.interface.ts && git commit -m "feat(api): interface MailProvider"
```

---

## Task 5: `SmtpMailProvider` (Mailpit) — TDD

**Files:**
- Create: `apps/api/src/notifications/providers/smtp.provider.ts`
- Test: `apps/api/src/notifications/providers/smtp.provider.spec.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
// smtp.provider.spec.ts
import { SmtpMailProvider } from './smtp.provider';
import type { Transporter } from 'nodemailer';

describe('SmtpMailProvider', () => {
  const makeTransporter = (sendMailImpl: jest.Mock) =>
    ({ sendMail: sendMailImpl } as unknown as Transporter);

  it('envia email e retorna providerMessageId', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc-123' });
    const provider = new SmtpMailProvider({
      transporter: makeTransporter(sendMail),
      from: 'Hope <no-reply@hope.test>',
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Olá',
      htmlBody: '<p>oi</p>',
      textBody: 'oi',
      tag: 'password-reset',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Hope <no-reply@hope.test>',
      to: 'user@test.com',
      subject: 'Olá',
      html: '<p>oi</p>',
      text: 'oi',
      headers: { 'X-Tag': 'password-reset' },
    });
    expect(result).toEqual({ providerMessageId: 'abc-123' });
  });

  it('propaga erro do transporter', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('smtp down'));
    const provider = new SmtpMailProvider({
      transporter: makeTransporter(sendMail),
      from: 'Hope <no-reply@hope.test>',
    });

    await expect(
      provider.send({
        to: 'a@b.com',
        subject: 's',
        htmlBody: 'h',
        tag: 't',
      }),
    ).rejects.toThrow('smtp down');
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar falha**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/providers/smtp.provider.spec.ts`
Expected: FAIL — `Cannot find module './smtp.provider'`.

- [ ] **Step 3: Implementar provider mínimo**

```ts
// smtp.provider.ts
import type { Transporter } from 'nodemailer';
import type {
  MailProvider,
  MailSendResult,
  OutgoingEmail,
} from './mail-provider.interface';

export interface SmtpMailProviderDeps {
  transporter: Transporter;
  from: string;
}

export class SmtpMailProvider implements MailProvider {
  constructor(private readonly deps: SmtpMailProviderDeps) {}

  async send(message: OutgoingEmail): Promise<MailSendResult> {
    const info = await this.deps.transporter.sendMail({
      from: this.deps.from,
      to: message.to,
      subject: message.subject,
      html: message.htmlBody,
      text: message.textBody,
      headers: { 'X-Tag': message.tag },
    });
    return { providerMessageId: info.messageId };
  }
}
```

- [ ] **Step 4: Rodar teste**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/providers/smtp.provider.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd /root/hope_saude && git add apps/api/src/notifications/providers/smtp.provider.ts apps/api/src/notifications/providers/smtp.provider.spec.ts && git commit -m "feat(api): SmtpMailProvider com testes"
```

---

## Task 6: `PostmarkMailProvider` — TDD

**Files:**
- Create: `apps/api/src/notifications/providers/postmark.provider.ts`
- Test: `apps/api/src/notifications/providers/postmark.provider.spec.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
// postmark.provider.spec.ts
import { PostmarkMailProvider } from './postmark.provider';

describe('PostmarkMailProvider', () => {
  const makeClient = (sendEmailImpl: jest.Mock) =>
    ({ sendEmail: sendEmailImpl } as unknown as import('postmark').ServerClient);

  it('envia via SDK do Postmark e retorna providerMessageId', async () => {
    const sendEmail = jest.fn().mockResolvedValue({ MessageID: 'pm-999' });
    const provider = new PostmarkMailProvider({
      client: makeClient(sendEmail),
      from: 'Hope <no-reply@hope.test>',
      messageStream: 'outbound',
    });

    const result = await provider.send({
      to: 'user@test.com',
      subject: 'Olá',
      htmlBody: '<p>oi</p>',
      textBody: 'oi',
      tag: 'password-reset',
    });

    expect(sendEmail).toHaveBeenCalledWith({
      From: 'Hope <no-reply@hope.test>',
      To: 'user@test.com',
      Subject: 'Olá',
      HtmlBody: '<p>oi</p>',
      TextBody: 'oi',
      Tag: 'password-reset',
      MessageStream: 'outbound',
    });
    expect(result).toEqual({ providerMessageId: 'pm-999' });
  });

  it('propaga erro da API', async () => {
    const sendEmail = jest.fn().mockRejectedValue(new Error('rate limited'));
    const provider = new PostmarkMailProvider({
      client: makeClient(sendEmail),
      from: 'f@f.com',
      messageStream: 'outbound',
    });
    await expect(
      provider.send({ to: 'a@b.com', subject: 's', htmlBody: 'h', tag: 't' }),
    ).rejects.toThrow('rate limited');
  });
});
```

- [ ] **Step 2: Rodar — confirmar fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/providers/postmark.provider.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// postmark.provider.ts
import type { ServerClient } from 'postmark';
import type {
  MailProvider,
  MailSendResult,
  OutgoingEmail,
} from './mail-provider.interface';

export interface PostmarkMailProviderDeps {
  client: ServerClient;
  from: string;
  messageStream: string;
}

export class PostmarkMailProvider implements MailProvider {
  constructor(private readonly deps: PostmarkMailProviderDeps) {}

  async send(message: OutgoingEmail): Promise<MailSendResult> {
    const response = await this.deps.client.sendEmail({
      From: this.deps.from,
      To: message.to,
      Subject: message.subject,
      HtmlBody: message.htmlBody,
      TextBody: message.textBody,
      Tag: message.tag,
      MessageStream: message.messageStream ?? this.deps.messageStream,
    });
    return { providerMessageId: response.MessageID };
  }
}
```

- [ ] **Step 4: Rodar**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/providers/postmark.provider.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/providers/postmark.provider.ts apps/api/src/notifications/providers/postmark.provider.spec.ts && git commit -m "feat(api): PostmarkMailProvider com testes"
```

---

## Task 7: `EmailOutboxRepository` — TDD

**Files:**
- Create: `apps/api/src/notifications/outbox/email-outbox.repository.ts`
- Test: `apps/api/src/notifications/outbox/email-outbox.repository.spec.ts`

- [ ] **Step 1: Teste falhando**

```ts
// email-outbox.repository.spec.ts
import { EmailOutboxRepository } from './email-outbox.repository';
import { PrismaService } from '../../prisma.service';

describe('EmailOutboxRepository', () => {
  const makePrisma = () =>
    ({
      emailOutbox: {
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as PrismaService);

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

  it('markSent atualiza status SENT + providerMessageId + sentAt', async () => {
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

  it('markFailed atualiza status FAILED + errorMessage + failedAt', async () => {
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
```

- [ ] **Step 2: Rodar — fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/outbox/email-outbox.repository.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// email-outbox.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface CreatePendingInput {
  to: string;
  subject: string;
  tag: string;
}

@Injectable()
export class EmailOutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(input: CreatePendingInput): Promise<string> {
    const row = await this.prisma.emailOutbox.create({
      data: {
        to: input.to,
        subject: input.subject,
        tag: input.tag,
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
}
```

- [ ] **Step 4: Rodar**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/outbox/email-outbox.repository.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/outbox && git commit -m "feat(api): EmailOutboxRepository com testes"
```

---

## Task 8: `TemplateRenderer` e `BaseLayout`

**Files:**
- Create: `apps/api/src/notifications/templates/renderer.ts`
- Create: `apps/api/src/notifications/templates/base-layout.tsx`
- Test: `apps/api/src/notifications/templates/renderer.spec.ts`

- [ ] **Step 1: Verificar que tsconfig aceita JSX**

Run: `grep -E '"jsx"' /root/hope_saude/apps/api/tsconfig.json`
Expected: deve existir linha com `"jsx"`. **Se não existir**, adicionar `"jsx": "react-jsx"` em `compilerOptions` do `apps/api/tsconfig.json` antes de prosseguir. Commit isolado: `chore(api): habilita jsx no tsconfig`.

- [ ] **Step 2: Criar BaseLayout**

```tsx
// base-layout.tsx
import * as React from 'react';
import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components';

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f4f6f8', fontFamily: 'Arial, sans-serif', margin: 0, padding: '24px' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', maxWidth: '560px' }}>
          <Section>
            <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f766e', margin: '0 0 16px 0' }}>
              Hope Saúde
            </Text>
          </Section>
          {children}
          <Section>
            <Text style={{ fontSize: '12px', color: '#64748b', marginTop: '32px' }}>
              Este é um email automático. Não responda.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 3: Teste falhando do renderer**

```ts
// renderer.spec.ts
import * as React from 'react';
import { renderTemplate } from './renderer';
import { BaseLayout } from './base-layout';

describe('renderTemplate', () => {
  it('devolve html e text não-vazios', async () => {
    const element = React.createElement(
      BaseLayout,
      { preview: 'oi' },
      React.createElement('p', null, 'conteudo teste'),
    );
    const out = await renderTemplate(element);
    expect(out.html).toContain('conteudo teste');
    expect(out.html).toContain('<html');
    expect(out.text).toContain('conteudo teste');
    expect(out.text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Rodar — fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/templates/renderer.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 5: Implementar renderer**

```ts
// renderer.ts
import { render } from '@react-email/render';
import type { ReactElement } from 'react';

export interface RenderedTemplate {
  html: string;
  text: string;
}

export async function renderTemplate(element: ReactElement): Promise<RenderedTemplate> {
  const [html, text] = await Promise.all([
    render(element, { pretty: false }),
    render(element, { plainText: true }),
  ]);
  return { html, text };
}
```

- [ ] **Step 6: Rodar**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/templates/renderer.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/notifications/templates/ apps/api/tsconfig.json && git commit -m "feat(api): TemplateRenderer + BaseLayout"
```

---

## Task 9: Template `password-reset.tsx` + snapshot test

**Files:**
- Create: `apps/api/src/notifications/templates/password-reset.tsx`
- Test: `apps/api/src/notifications/templates/password-reset.spec.tsx`

- [ ] **Step 1: Escrever snapshot test**

```tsx
// password-reset.spec.tsx
import { renderTemplate } from './renderer';
import { PasswordResetEmail } from './password-reset';

describe('PasswordResetEmail', () => {
  it('renderiza html com nome, link e expiração', async () => {
    const out = await renderTemplate(
      PasswordResetEmail({
        userName: 'Maria',
        resetUrl: 'https://hope.test/reset?token=abc',
      }),
    );
    expect(out.html).toContain('Maria');
    expect(out.html).toContain('https://hope.test/reset?token=abc');
    expect(out.html).toContain('redefinir sua senha');
    expect(out.html).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Rodar — fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/templates/password-reset.spec.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar template**

```tsx
// password-reset.tsx
import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
}

export function PasswordResetEmail({ userName, resetUrl }: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Redefina sua senha do Hope Saúde">
      <Section>
        <Text style={{ fontSize: '16px', color: '#0f172a' }}>Olá, {userName}.</Text>
        <Text style={{ fontSize: '14px', color: '#334155' }}>
          Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para continuar.
          Este link é válido por 1 hora. Se você não solicitou, ignore esta mensagem.
        </Text>
        <Section style={{ margin: '24px 0' }}>
          <Button
            href={resetUrl}
            style={{
              backgroundColor: '#0f766e',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            redefinir sua senha
          </Button>
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Se o botão não funcionar, copie e cole este link no navegador: {resetUrl}
        </Text>
      </Section>
    </BaseLayout>
  );
}
```

- [ ] **Step 4: Rodar (cria snapshot)**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/templates/password-reset.spec.tsx`
Expected: PASS. Snapshot criado em `__snapshots__/`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/templates/password-reset.tsx apps/api/src/notifications/templates/password-reset.spec.tsx apps/api/src/notifications/templates/__snapshots__ && git commit -m "feat(api): template password-reset com snapshot"
```

---

## Task 10: Template `email-verification.tsx` + snapshot test

**Files:**
- Create: `apps/api/src/notifications/templates/email-verification.tsx`
- Test: `apps/api/src/notifications/templates/email-verification.spec.tsx`

- [ ] **Step 1: Teste falhando**

```tsx
// email-verification.spec.tsx
import { renderTemplate } from './renderer';
import { EmailVerificationEmail } from './email-verification';

describe('EmailVerificationEmail', () => {
  it('renderiza html com nome e link de verificação', async () => {
    const out = await renderTemplate(
      EmailVerificationEmail({
        userName: 'João',
        verifyUrl: 'https://hope.test/verify?token=xyz',
      }),
    );
    expect(out.html).toContain('João');
    expect(out.html).toContain('https://hope.test/verify?token=xyz');
    expect(out.html).toContain('confirmar seu email');
    expect(out.html).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Rodar — fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/templates/email-verification.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```tsx
// email-verification.tsx
import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface EmailVerificationEmailProps {
  userName: string;
  verifyUrl: string;
}

export function EmailVerificationEmail({ userName, verifyUrl }: EmailVerificationEmailProps) {
  return (
    <BaseLayout preview="Confirme seu email no Hope Saúde">
      <Section>
        <Text style={{ fontSize: '16px', color: '#0f172a' }}>Bem-vindo, {userName}!</Text>
        <Text style={{ fontSize: '14px', color: '#334155' }}>
          Para ativar sua conta no Hope Saúde, precisamos confirmar seu email. Clique no botão abaixo.
          Este link é válido por 24 horas.
        </Text>
        <Section style={{ margin: '24px 0' }}>
          <Button
            href={verifyUrl}
            style={{
              backgroundColor: '#0f766e',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            confirmar seu email
          </Button>
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Se o botão não funcionar, copie e cole este link no navegador: {verifyUrl}
        </Text>
      </Section>
    </BaseLayout>
  );
}
```

- [ ] **Step 4: Rodar**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/templates/email-verification.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/templates/email-verification.tsx apps/api/src/notifications/templates/email-verification.spec.tsx apps/api/src/notifications/templates/__snapshots__ && git commit -m "feat(api): template email-verification com snapshot"
```

---

## Task 11: `NotificationsService` — TDD

**Files:**
- Create: `apps/api/src/notifications/notifications.service.ts`
- Test: `apps/api/src/notifications/notifications.service.spec.ts`

- [ ] **Step 1: Teste falhando**

```ts
// notifications.service.spec.ts
import { NotificationsService } from './notifications.service';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import type { MailProvider } from './providers/mail-provider.interface';

describe('NotificationsService', () => {
  const makeRepo = () =>
    ({
      createPending: jest.fn().mockResolvedValue('outbox-1'),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmailOutboxRepository>);

  const makeProvider = (impl?: Partial<MailProvider>): jest.Mocked<MailProvider> =>
    ({
      send: jest.fn().mockResolvedValue({ providerMessageId: 'pm-1' }),
      ...impl,
    } as unknown as jest.Mocked<MailProvider>);

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
```

- [ ] **Step 2: Rodar — fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/notifications.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// notifications.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailOutboxRepository } from './outbox/email-outbox.repository';
import { MAIL_PROVIDER, MailProvider } from './providers/mail-provider.interface';
import { renderTemplate } from './templates/renderer';
import { PasswordResetEmail } from './templates/password-reset';
import { EmailVerificationEmail } from './templates/email-verification';

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
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly outbox: EmailOutboxRepository,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
  ) {}

  async sendPasswordReset(params: SendPasswordResetParams): Promise<void> {
    const subject = 'Redefinição de senha — Hope Saúde';
    const rendered = await renderTemplate(
      PasswordResetEmail({ userName: params.userName, resetUrl: params.resetUrl }),
    );
    await this.deliver({
      to: params.to,
      subject,
      tag: 'password-reset',
      html: rendered.html,
      text: rendered.text,
    });
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    const subject = 'Confirme seu email — Hope Saúde';
    const rendered = await renderTemplate(
      EmailVerificationEmail({ userName: params.userName, verifyUrl: params.verifyUrl }),
    );
    await this.deliver({
      to: params.to,
      subject,
      tag: 'email-verification',
      html: rendered.html,
      text: rendered.text,
    });
  }

  private async deliver(input: {
    to: string;
    subject: string;
    tag: string;
    html: string;
    text: string;
  }): Promise<void> {
    const outboxId = await this.outbox.createPending({
      to: input.to,
      subject: input.subject,
      tag: input.tag,
    });

    try {
      const result = await this.provider.send({
        to: input.to,
        subject: input.subject,
        htmlBody: input.html,
        textBody: input.text,
        tag: input.tag,
      });
      await this.outbox.markSent(outboxId, result.providerMessageId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({
        msg: 'email send failed',
        outboxId,
        tag: input.tag,
        error: message,
      });
      await this.outbox.markFailed(outboxId, message);
    }
  }
}
```

- [ ] **Step 4: Rodar**

Run: `cd /root/hope_saude/apps/api && npx jest src/notifications/notifications.service.spec.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.service.spec.ts && git commit -m "feat(api): NotificationsService (porta de entrada)"
```

---

## Task 12: `NotificationsModule` com factory de provider

**Files:**
- Create: `apps/api/src/notifications/notifications.module.ts`

- [ ] **Step 1: Implementar módulo**

```ts
// notifications.module.ts
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
```

- [ ] **Step 2: Smoke check — compila e app sobe**

Run: `cd /root/hope_saude/apps/api && npx nest build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/notifications/notifications.module.ts && git commit -m "feat(api): NotificationsModule com factory de provider por env"
```

---

## Task 13: `AuthService` — `requestPasswordReset` (TDD)

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify/Create: `apps/api/src/auth/auth.service.spec.ts`

Nota: as rotas de reset não existem ainda. Criaremos token aleatório, salvaremos seu hash (`sha256`) em `PasswordResetToken`, e passaremos o token claro para o `NotificationsService`.

- [ ] **Step 1: Teste falhando**

Adicionar ao `apps/api/src/auth/auth.service.spec.ts` (criar se não existir):

```ts
// auth.service.spec.ts (adicionar describe novo)
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';

describe('AuthService.requestPasswordReset', () => {
  const makeUser = () => ({
    id: 42,
    email: 'maria@test.com',
    name: 'Maria',
    role: 'PATIENT',
    password: 'hash',
  });

  function makeService(overrides: {
    findUnique?: jest.Mock;
    createToken?: jest.Mock;
    sendReset?: jest.Mock;
    configGet?: jest.Mock;
  } = {}) {
    const prisma = {
      user: { findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(makeUser()) },
      passwordResetToken: { create: overrides.createToken ?? jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const notifications = {
      sendPasswordReset: overrides.sendReset ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationsService;
    const config = {
      get: overrides.configGet ?? jest.fn().mockReturnValue('https://app.test'),
    } as unknown as ConfigService;
    const jwt = {} as JwtService;
    return {
      service: new AuthService(prisma, jwt, notifications, config),
      prisma,
      notifications,
      config,
    };
  }

  it('usuário existente: cria token hashed, envia email, não vaza token claro', async () => {
    const createToken = jest.fn().mockResolvedValue({});
    const sendReset = jest.fn().mockResolvedValue(undefined);
    const { service } = makeService({ createToken, sendReset });

    await service.requestPasswordReset('maria@test.com');

    expect(createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 42,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    const savedHash = (createToken.mock.calls[0][0] as { data: { tokenHash: string } }).data.tokenHash;
    // hash sha256 hex tem 64 chars
    expect(savedHash).toMatch(/^[a-f0-9]{64}$/);

    expect(sendReset).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'maria@test.com',
        userName: 'Maria',
        resetUrl: expect.stringContaining('https://app.test/reset-password?token='),
      }),
    );
    // URL contém o token claro (não o hash)
    const url: string = (sendReset.mock.calls[0][0] as { resetUrl: string }).resetUrl;
    expect(url).not.toContain(savedHash);
  });

  it('usuário inexistente: não cria token, não envia email, não lança', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const createToken = jest.fn();
    const sendReset = jest.fn();
    const { service } = makeService({ findUnique, createToken, sendReset });

    await expect(service.requestPasswordReset('naoexiste@test.com')).resolves.toBeUndefined();
    expect(createToken).not.toHaveBeenCalled();
    expect(sendReset).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar — fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts`
Expected: FAIL — `AuthService` não aceita `NotificationsService` no construtor.

- [ ] **Step 3: Atualizar `AuthService`**

Modificar `apps/api/src/auth/auth.service.ts`:

1. Adicionar imports ao topo:

```ts
import { randomBytes, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
```

2. Alterar construtor:

```ts
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {}
```

3. Adicionar método (no final da classe, antes do `}` final):

```ts
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return; // silencioso por segurança (anti-enumeração)
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appUrl = this.config.get<string>('MAIL_APP_URL') ?? 'http://localhost:3001';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await this.notifications.sendPasswordReset({
      to: user.email,
      userName: user.name,
      resetUrl,
    });
  }
```

- [ ] **Step 4: Rodar teste novo**

Run: `cd /root/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts -t requestPasswordReset`
Expected: PASS (2 testes).

- [ ] **Step 5: Rodar todos os testes de auth para não quebrar existentes**

Run: `cd /root/hope_saude/apps/api && npx jest src/auth`
Expected: todos PASS. Se algum teste antigo quebrar por causa dos novos parâmetros do construtor, atualizar apenas os mocks no teste antigo para injetar `NotificationsService` e `ConfigService` como `{} as any`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts && git commit -m "feat(api): AuthService.requestPasswordReset com token hashed"
```

---

## Task 14: `AuthService` — `requestEmailVerification` (TDD)

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Teste falhando**

Adicionar ao `auth.service.spec.ts`:

```ts
describe('AuthService.requestEmailVerification', () => {
  it('usuário existente: cria token e envia email de verificação', async () => {
    const makeUser = () => ({
      id: 7,
      email: 'joao@test.com',
      name: 'João',
      role: 'PATIENT',
      password: 'h',
    });
    const createToken = jest.fn().mockResolvedValue({});
    const sendVerif = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(makeUser()) },
      emailVerificationToken: { create: createToken },
    } as unknown as PrismaService;
    const notifications = {
      sendEmailVerification: sendVerif,
    } as unknown as NotificationsService;
    const config = {
      get: jest.fn().mockReturnValue('https://app.test'),
    } as unknown as ConfigService;
    const service = new AuthService(prisma, {} as JwtService, notifications, config);

    await service.requestEmailVerification('joao@test.com');

    expect(createToken).toHaveBeenCalled();
    expect(sendVerif).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'joao@test.com',
        userName: 'João',
        verifyUrl: expect.stringContaining('https://app.test/verify-email?token='),
      }),
    );
  });

  it('usuário inexistente: silencioso', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      emailVerificationToken: { create: jest.fn() },
    } as unknown as PrismaService;
    const notifications = {
      sendEmailVerification: jest.fn(),
    } as unknown as NotificationsService;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const service = new AuthService(prisma, {} as JwtService, notifications, config);

    await expect(service.requestEmailVerification('nope@test.com')).resolves.toBeUndefined();
    expect(notifications.sendEmailVerification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar — fail**

Run: `cd /root/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts -t requestEmailVerification`
Expected: FAIL.

- [ ] **Step 3: Implementar método**

Adicionar ao final de `AuthService`:

```ts
  async requestEmailVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appUrl = this.config.get<string>('MAIL_APP_URL') ?? 'http://localhost:3001';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    await this.notifications.sendEmailVerification({
      to: user.email,
      userName: user.name,
      verifyUrl,
    });
  }
```

- [ ] **Step 4: Rodar**

Run: `cd /root/hope_saude/apps/api && npx jest src/auth/auth.service.spec.ts`
Expected: todos os describes PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts && git commit -m "feat(api): AuthService.requestEmailVerification"
```

---

## Task 15: Endpoints no `AuthController` + DTOs + importar `NotificationsModule`

**Files:**
- Create: `apps/api/src/auth/dto/forgot-password.dto.ts`
- Create: `apps/api/src/auth/dto/request-email-verification.dto.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: DTOs**

```ts
// dto/forgot-password.dto.ts
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
```

```ts
// dto/request-email-verification.dto.ts
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestEmailVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
```

- [ ] **Step 2: Atualizar `AuthModule` para importar `NotificationsModule`**

Em `apps/api/src/auth/auth.module.ts`:

1. Adicionar import:

```ts
import { NotificationsModule } from '../notifications/notifications.module';
```

2. Adicionar `NotificationsModule` à lista `imports:` do `@Module`, mantendo os demais intactos. A lista `imports` do módulo deve ficar:

```ts
  imports: [
    PassportModule,
    NotificationsModule,
    JwtModule.registerAsync({
      // ... (conteúdo existente inalterado)
    }),
  ],
```

- [ ] **Step 3: Adicionar endpoints ao `AuthController`**

Adicionar imports no topo se faltarem:

```ts
import { HttpCode, HttpStatus } from '@nestjs/common';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
```

Adicionar métodos dentro da classe `AuthController`:

```ts
  @ApiOperation({ summary: 'Solicita email de recuperação de senha' })
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.authService.requestPasswordReset(body.email);
  }

  @ApiOperation({ summary: 'Solicita email de verificação de conta' })
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('verify-email/request')
  async requestEmailVerification(
    @Body() body: RequestEmailVerificationDto,
  ): Promise<void> {
    await this.authService.requestEmailVerification(body.email);
  }
```

- [ ] **Step 4: Build check**

Run: `cd /root/hope_saude/apps/api && npx nest build`
Expected: build sem erros.

- [ ] **Step 5: Rodar todos os testes unitários**

Run: `cd /root/hope_saude/apps/api && npx jest --testPathIgnorePatterns=e2e`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth && git commit -m "feat(api): endpoints forgot-password e verify-email/request"
```

---

## Task 16: Teste E2E via Mailpit

**Files:**
- Create: `apps/api/test/notifications-auth.e2e-spec.ts`

Nota: este teste usa `MAIL_DRIVER=smtp` apontando para o Mailpit subido no Task 2, e consulta a API HTTP do Mailpit (`http://localhost:8025/api/v1/messages`) para verificar recebimento.

- [ ] **Step 1: Garantir Mailpit rodando**

Run: `curl -s http://localhost:8025/api/v1/info | head -20`
Expected: JSON com info do Mailpit. Se falhar, `cd /root/hope_saude && docker compose up -d mailpit`.

- [ ] **Step 2: Escrever teste e2e**

```ts
// apps/api/test/notifications-auth.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';

const MAILPIT_API = 'http://localhost:8025/api/v1';

async function clearMailpit() {
  await fetch(`${MAILPIT_API}/messages`, { method: 'DELETE' });
}

async function mailpitMessages(): Promise<{ messages: Array<{ To: Array<{ Address: string }>; Subject: string; Tags: string[] }> }> {
  const res = await fetch(`${MAILPIT_API}/messages`);
  return res.json() as Promise<{ messages: Array<{ To: Array<{ Address: string }>; Subject: string; Tags: string[] }> }>;
}

describe('Notifications + Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.MAIL_DRIVER = 'smtp';
    process.env.MAIL_FROM = 'Hope <no-reply@hope.test>';
    process.env.MAIL_APP_URL = 'http://localhost:3001';
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '1025';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.emailOutbox.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.emailVerificationToken.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await clearMailpit();
    await prisma.emailOutbox.deleteMany({});
  });

  describe('POST /auth/forgot-password', () => {
    const email = `forgot-${Date.now()}@hope.test`;

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          email,
          name: 'Forgot Test',
          password: 'irrelevant-hash',
          role: 'PATIENT',
        },
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email } });
    });

    it('com email existente: 204, outbox SENT, mailpit recebeu', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(204);

      // dar um respiro pra o SMTP entregar
      await new Promise((r) => setTimeout(r, 500));

      const outbox = await prisma.emailOutbox.findMany({ where: { tag: 'password-reset' } });
      expect(outbox).toHaveLength(1);
      expect(outbox[0].status).toBe('SENT');

      const { messages } = await mailpitMessages();
      const mine = messages.filter((m) => m.To.some((t) => t.Address === email));
      expect(mine.length).toBeGreaterThanOrEqual(1);
      expect(mine[0].Subject).toMatch(/senha/i);
    });

    it('com email inexistente: 204, outbox vazio, mailpit vazio', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'naoexiste@hope.test' })
        .expect(204);

      const outbox = await prisma.emailOutbox.findMany({});
      expect(outbox).toHaveLength(0);

      const { messages } = await mailpitMessages();
      expect(messages ?? []).toHaveLength(0);
    });
  });

  describe('POST /auth/verify-email/request', () => {
    const email = `verify-${Date.now()}@hope.test`;

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          email,
          name: 'Verify Test',
          password: 'irrelevant-hash',
          role: 'PATIENT',
        },
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email } });
    });

    it('com email existente: 204, outbox SENT, mailpit recebeu', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email/request')
        .send({ email })
        .expect(204);

      await new Promise((r) => setTimeout(r, 500));

      const outbox = await prisma.emailOutbox.findMany({ where: { tag: 'email-verification' } });
      expect(outbox).toHaveLength(1);
      expect(outbox[0].status).toBe('SENT');

      const { messages } = await mailpitMessages();
      const mine = messages.filter((m) => m.To.some((t) => t.Address === email));
      expect(mine.length).toBeGreaterThanOrEqual(1);
      expect(mine[0].Subject).toMatch(/email/i);
    });
  });
});
```

- [ ] **Step 3: Rodar teste e2e**

Run: `cd /root/hope_saude/apps/api && npx jest --config test/jest-e2e.json test/notifications-auth.e2e-spec.ts`

Se o projeto não tiver `test/jest-e2e.json`, olhar como o teste `auth-rbac.e2e-spec.ts` existente é rodado (ver `package.json` ou rodar sem flag `--config` apontando direto para o arquivo).

Fallback: `cd /root/hope_saude/apps/api && npx jest test/notifications-auth.e2e-spec.ts --runInBand`

Expected: PASS em todos os casos.

- [ ] **Step 4: Rodar suíte completa (unit + e2e) para regressão**

Run: `cd /root/hope_saude/apps/api && npx jest --runInBand`
Expected: todos PASS, sem quebras em testes pré-existentes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/notifications-auth.e2e-spec.ts && git commit -m "test(api): e2e de notifications+auth via Mailpit"
```

---

## Cobertura do spec × plano

| Requisito do spec                                  | Task(s)     |
|----------------------------------------------------|-------------|
| § 3.1 Componentes do módulo                        | 4–12        |
| § 3.2 Fluxo de dependência (DIP)                   | 11, 12      |
| § 3.3 Seleção de provider por `MAIL_DRIVER`        | 12          |
| § 4.1 Interface `MailProvider`                     | 4           |
| § 4.2 `NotificationsService` domain API            | 11          |
| § 5 Modelo `EmailOutbox`                           | 3, 7        |
| § 6 Tratamento de erro (swallow + log + outbox)    | 11          |
| § 7 Templates React Email + snapshot               | 8, 9, 10    |
| § 8 Variáveis de ambiente                          | 1           |
| § 9 Mailpit no docker-compose dev                  | 2           |
| § 10 Integração no `AuthModule`                    | 13, 14, 15  |
| § 11.1 Testes unitários                            | 5–11, 13, 14 |
| § 11.2 E2E                                         | 16          |
| § 12 Dependências                                  | 1           |
| § 13 Fora de escopo                                | (respeitado) |
| § 14 Nada fora de `/root/hope_saude`               | (respeitado) |
