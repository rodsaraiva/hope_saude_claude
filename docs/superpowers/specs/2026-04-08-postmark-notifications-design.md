# Design — Notificações por email via Postmark

**Data:** 2026-04-08
**Escopo:** `apps/api` (NestJS)
**Status:** Aprovado para implementação

## 1. Objetivo

Introduzir um subsistema de notificações por email no `hope_saude`, cobrindo no MVP:

1. **Recuperação de senha** (`password-reset`)
2. **Verificação de email no cadastro** (`email-verification`)

O sistema deve ser extensível para futuras notificações (confirmação/lembrete de consulta, prescrição emitida, etc.) sem refatoração estrutural.

## 2. Princípios de design

- **SOLID / DIP:** consumidores dependem de abstrações (`NotificationsService`, `MailProvider`), nunca de SDKs concretos.
- **TDD:** cada unidade tem testes unitários; fluxos críticos têm e2e.
- **Isolamento:** um único módulo (`NotificationsModule`) expõe uma única porta de entrada (`NotificationsService`) e depende de uma única porta de saída por rede (`MailProvider`).
- **Sem sobre-engenharia:** envio síncrono, sem fila. Outbox leve preparada para adicionar retry worker no futuro.
- **Segurança por padrão:** endpoints de auth retornam resposta uniforme independentemente do resultado do envio (anti enumeração de usuários).

## 3. Arquitetura

### 3.1 Componentes

```
apps/api/src/notifications/
├── notifications.module.ts
├── notifications.service.ts           # API de domínio (porta de entrada)
├── notifications.service.spec.ts
├── providers/
│   ├── mail-provider.interface.ts     # porta de saída
│   ├── postmark.provider.ts
│   ├── postmark.provider.spec.ts
│   ├── smtp.provider.ts               # dev/staging via Mailpit
│   └── smtp.provider.spec.ts
├── outbox/
│   ├── email-outbox.repository.ts     # acesso via PrismaService
│   └── email-outbox.repository.spec.ts
├── templates/
│   ├── renderer.ts                    # wrapper sobre @react-email/render
│   ├── renderer.spec.ts
│   ├── password-reset.tsx
│   ├── password-reset.spec.tsx
│   ├── email-verification.tsx
│   └── email-verification.spec.tsx
└── dto/
    └── send-email.dto.ts
```

### 3.2 Fluxo de dependência

```
AuthService
    │ depende de
    ▼
NotificationsService  (API de domínio; métodos por caso de uso)
    │ usa
    ▼
TemplateRenderer  +  EmailOutboxRepository  +  MailProvider (interface)
                                                     ▲
                                                     │ implementa
                                           ┌─────────┴─────────┐
                                  PostmarkMailProvider   SmtpMailProvider
                                      (prod)                (dev/staging)
```

### 3.3 Seleção de provider por ambiente

Variável `MAIL_DRIVER` no `.env`:

| Ambiente | `MAIL_DRIVER` | Backend                         |
|----------|---------------|---------------------------------|
| dev      | `smtp`        | Mailpit em container Docker     |
| test     | `smtp`        | Mailpit (mesmo container)       |
| staging  | `smtp`        | Mailpit (mesmo container)       |
| prod     | `postmark`    | API HTTP do Postmark            |

Injeção via factory no `NotificationsModule`:

```ts
{
  provide: MAIL_PROVIDER,
  useFactory: (config: ConfigService) =>
    config.get<string>('MAIL_DRIVER') === 'postmark'
      ? new PostmarkProvider(config)
      : new SmtpProvider(config),
  inject: [ConfigService],
}
```

## 4. Interfaces principais

### 4.1 `MailProvider` (porta de saída)

```ts
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface OutgoingEmail {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  tag: string;              // 'password-reset' | 'email-verification'
  messageStream?: string;   // Postmark: 'outbound' (transactional stream)
}

export interface MailSendResult {
  providerMessageId: string;
}

export interface MailProvider {
  send(message: OutgoingEmail): Promise<MailSendResult>;
}
```

### 4.2 `NotificationsService` (porta de entrada)

```ts
class NotificationsService {
  sendPasswordReset(params: {
    to: string;
    userName: string;
    resetUrl: string;
  }): Promise<void>;

  sendEmailVerification(params: {
    to: string;
    userName: string;
    verifyUrl: string;
  }): Promise<void>;
}
```

Retorno é `void` por design — o chamador (ex.: `AuthService`) não deve reagir a falha de envio em endpoints de auth (ver Seção 6).

## 5. Persistência — `email_outbox`

Nova tabela via Prisma:

```prisma
model EmailOutbox {
  id                String            @id @default(uuid())
  to                String
  subject           String
  tag               String
  status            EmailOutboxStatus @default(PENDING)
  providerMessageId String?
  errorMessage      String?
  attempts          Int               @default(0)
  createdAt         DateTime          @default(now())
  sentAt            DateTime?
  failedAt          DateTime?

  @@index([status, createdAt])
  @@index([tag, createdAt])
  @@map("email_outbox")
}

enum EmailOutboxStatus {
  PENDING
  SENT
  FAILED
}
```

**Decisões:**

- **Não persistir o HTML/textBody.** O conteúdo é determinístico a partir de template + payload; armazenar aumentaria risco de vazamento de tokens (reset/verificação) em dumps de banco.
- **Não persistir o payload.** Mesmo motivo.
- **Índices** preparam retry worker futuro (`status=PENDING ORDER BY createdAt`) e relatórios por tipo.
- **LGPD:** `to` é dado pessoal; política de retenção fica para trabalho futuro (não bloqueante para MVP).

## 6. Tratamento de erro

Dentro de `NotificationsService.sendX()`:

1. `outbox.create(status=PENDING)` — se falhar, **propaga** (falha real de infraestrutura do app).
2. `provider.send()` dentro de try/catch.
3. **Sucesso:** `outbox.markSent(id, providerMessageId)`.
4. **Falha do provider:** `outbox.markFailed(id, error.message)`, log `error` estruturado, **não relança**.
5. Método retorna `void` em ambos os casos.

### 6.1 Razão do swallow

Em `POST /auth/forgot-password` e `POST /auth/verify-email-request`, a resposta HTTP deve ser idêntica para email existente ou inexistente (anti enumeração). Se o envio falhar, o endpoint ainda deve responder igualmente. Log + outbox.FAILED são os canais de auditoria/alerting.

### 6.2 Observabilidade

Logger do Nest em nível `error` com payload estruturado:

```ts
{
  outboxId,
  tag,
  provider: 'postmark' | 'smtp',
  error: err.message,
}
```

Alertas/monitoramento ficam fora de escopo deste spec.

## 7. Templates

- **Engine:** `@react-email/components` + `@react-email/render` → HTML + text.
- **Localização:** `apps/api/src/notifications/templates/*.tsx`.
- **Testes:** snapshot de cada template com payload fixo garante regressão visual mínima e estabilidade dos assets.
- **Componentização:** um `BaseLayout.tsx` compartilhado com header/footer e cores básicas da marca hope_saude. Mantido minimalista no MVP.
- **i18n:** fora de escopo. Textos em pt-BR hard-coded.

## 8. Variáveis de ambiente

Adicionar ao `.env.example` em `apps/api`:

```env
# Notifications
MAIL_DRIVER=smtp                          # smtp | postmark
MAIL_FROM="Hope Saúde <no-reply@hopesaude.com.br>"
MAIL_APP_URL=http://localhost:3000        # base para links em templates

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

## 9. Infraestrutura local (Mailpit)

Adicionar serviço ao `docker-compose.yml` do projeto:

```yaml
mailpit:
  image: axllent/mailpit:latest
  ports:
    - "1025:1025"   # SMTP
    - "8025:8025"   # Web UI
  environment:
    MP_SMTP_AUTH_ACCEPT_ANY: 1
    MP_SMTP_AUTH_ALLOW_INSECURE: 1
```

Prod (`docker-compose.prod.yml`) **não** adiciona Mailpit.

## 10. Integração no `AuthModule`

- `AuthModule` importa `NotificationsModule`.
- `AuthService` recebe `NotificationsService` via DI.
- Nos fluxos de esqueci-senha e cadastro, após gerar token, chama o método de domínio correspondente.
- Nenhuma lógica de email (HTML, provider, outbox) vaza para o `AuthService`.

## 11. Estratégia de testes (TDD)

### 11.1 Unitários (Jest)

| Unit                    | Mocks                                      | Cobertura                                                               |
|-------------------------|--------------------------------------------|-------------------------------------------------------------------------|
| `NotificationsService`  | repo, provider, renderer                   | happy path; provider falha (FAILED, não relança); repo falha (propaga)  |
| `PostmarkProvider`      | SDK `postmark`                             | mapeia payload, extrai MessageID, traduz erro                           |
| `SmtpProvider`          | `nodemailer` transporter                   | mapeia payload, extrai messageId, traduz erro                           |
| `TemplateRenderer`      | —                                          | render produz HTML e text não-vazios                                    |
| Templates `.tsx`        | —                                          | snapshot com payload fixo                                               |
| `EmailOutboxRepository` | `PrismaService`                            | create, markSent, markFailed                                            |

### 11.2 E2E (`.e2e-spec.ts`)

- `POST /auth/forgot-password` com email existente → 204; `email_outbox` tem 1 linha `SENT`; Mailpit API retorna o email.
- `POST /auth/forgot-password` com email inexistente → 204; `email_outbox` vazio; Mailpit vazio.
- Idem para verificação de email.

`MAIL_DRIVER=smtp` no `.env.test`, Mailpit via mesmo container do docker-compose de dev.

## 12. Dependências a adicionar

Em `apps/api/package.json`:

- `postmark` (SDK oficial)
- `nodemailer` + `@types/nodemailer`
- `@react-email/components`
- `@react-email/render`
- `react` + `react-dom` (peer deps do React Email; apenas como devDependencies/runtime server-side render)

## 13. Fora de escopo (explicitamente)

- Fila / retry assíncrono (BullMQ, Redis).
- Worker de retry periódico.
- Notificações de consulta (C/D/E da pergunta 1).
- Notificações de prescrição.
- i18n de templates.
- Política de retenção da `email_outbox`.
- DMARC/SPF/DKIM do domínio (trabalho de ops, não de código).
- Webhooks do Postmark (bounces, spam reports).

## 14. Premissa de escopo de arquivos

Toda mudança é **estritamente dentro de `/root/hope_saude`**. Nenhum arquivo fora do repo do projeto é criado ou alterado.
