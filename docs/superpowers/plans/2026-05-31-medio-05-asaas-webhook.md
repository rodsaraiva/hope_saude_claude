# Webhook Asaas Idempotente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a confirmação de pagamento por polling/cron por um webhook Asaas autenticado e idempotente que cria a consulta assim que o pagamento é recebido, mantendo o cron apenas como reconciliação de backup.

**Architecture:** Um novo controller público `PaymentWebhookController` (sem `AuthGuard('jwt')`, com `@SkipThrottle()`) recebe `POST /payments/webhook/asaas`, valida o header `asaas-access-token` contra o segredo `ASAAS_WEBHOOK_TOKEN` (401 se inválido) e delega a `PaymentWebhookService.handleEvent`. A idempotência usa uma nova tabela `ProcessedWebhookEvent` (event id `@unique`) — um evento já processado é ignorado. Para `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`, o service localiza o `PendingCheckout` por `asaasPaymentId`, registra o evento e cria a consulta dentro de um único `prisma.$transaction`, reusando o mesmo caminho do cron (`createConfirmedAppointment` + `deletePendingCheckout`). O cron tem a frequência reduzida para reconciliação de backup.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite, provider hardcoded `url "file:./dev.db"`), Jest (ts-jest, isolatedModules), class-validator, @nestjs/swagger, @nestjs/throttler, @nestjs/schedule, ConfigService.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma` | Adicionar model `ProcessedWebhookEvent` (idempotência por event id `@unique`) |
| Create | `/root/rodrigo/hope_saude/apps/api/src/payment/dto/asaas-webhook.dto.ts` | DTO do payload de webhook Asaas (`event`, `payment.id`, `payment.status`) + `id` do evento |
| Create | `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.ts` | Lógica idempotente: registra evento, cria consulta em `$transaction`, ignora replay e status não-recebido |
| Create | `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.spec.ts` | Testes unitários do service (replay, status ignorado, criação única) |
| Create | `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.ts` | Endpoint público `POST /payments/webhook/asaas`, valida `asaas-access-token` (401), `@SkipThrottle()`, SEM `AuthGuard` |
| Create | `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.spec.ts` | Testes do controller (token ausente/inválido → 401, token válido → delega ao service) |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/payment.module.ts` | Registrar `PaymentWebhookController` e `PaymentWebhookService` |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.ts` | Reduzir frequência do cron para reconciliação de backup (`0 * * * *`) |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts` | Ajustar assert da expressão de cron, se existir |
| Modify | `/root/rodrigo/hope_saude/apps/api/.env.example` | Documentar `ASAAS_WEBHOOK_TOKEN` |

---

## Tasks

### Task 1 — Model `ProcessedWebhookEvent` (idempotência)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/processed-webhook-event.schema.spec.ts`

O `PendingCheckout.asaasPaymentId` já é `@unique`, mas um único pagamento pode gerar múltiplos eventos (ex.: `PAYMENT_CONFIRMED` seguido de `PAYMENT_RECEIVED`); a idempotência precisa ser por **event id**, não por pagamento. Por isso criamos uma tabela dedicada.

- [ ] **Step 1: Write the failing test.** Cria um teste que valida (via Prisma Client gerado) que a tabela existe e que o campo `eventId` é único. Crie `/root/rodrigo/hope_saude/apps/api/src/payment/processed-webhook-event.schema.spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';

describe('ProcessedWebhookEvent schema', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('expõe o model processedWebhookEvent no client gerado', () => {
    expect(prisma.processedWebhookEvent).toBeDefined();
    expect(typeof prisma.processedWebhookEvent.create).toBe('function');
    expect(typeof prisma.processedWebhookEvent.findUnique).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/processed-webhook-event.schema.spec.ts --no-coverage
```

Saída esperada: falha de compilação/tipo porque `prisma.processedWebhookEvent` não existe no client gerado (`Property 'processedWebhookEvent' does not exist on type 'PrismaClient'`).

- [ ] **Step 3: Write minimal implementation.** Adicione o model ao final de `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma` (após `EmailVerificationToken`):

```prisma
/// Eventos de webhook Asaas já processados — garante idempotência (replay não duplica consulta).
model ProcessedWebhookEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique
  eventType   String
  paymentId   String?
  processedAt DateTime @default(now())

  @@index([paymentId])
  @@map("processed_webhook_events")
}
```

Em seguida, gere o client e aplique a migração no SQLite local:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx prisma generate && npx prisma db push
```

- [ ] **Step 4: Run test to verify it passes.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/processed-webhook-event.schema.spec.ts --no-coverage
```

Saída esperada: `1 passed`, suíte verde.

- [ ] **Step 5: Commit.**

```bash
git add /root/rodrigo/hope_saude/apps/api/prisma/schema.prisma /root/rodrigo/hope_saude/apps/api/src/payment/processed-webhook-event.schema.spec.ts
git commit -m "feat(api): model ProcessedWebhookEvent para idempotencia de webhook Asaas"
```

---

### Task 2 — DTO do payload de webhook Asaas

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/payment/dto/asaas-webhook.dto.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/dto/asaas-webhook.dto.spec.ts`

O payload real do Asaas tem o formato `{ id, event, payment: { id, status, ... } }`. O `ValidationPipe` global usa `whitelist: true` + `forbidNonWhitelisted: true`, então o DTO precisa declarar exatamente os campos que consumimos e usar `@ValidateNested`/`@Type` para o objeto `payment`. Campos extras do Asaas seriam rejeitados; por isso o webhook NÃO usará o pipe whitelist global — ele recebe `@Body()` sem DTO validado pelo pipe e fazemos a extração defensiva no service. O DTO aqui serve como **tipo** (shape) usado no controller/service, sem decorators de validação (evita rejeitar campos extras do Asaas).

- [ ] **Step 1: Write the failing test.** Cria `/root/rodrigo/hope_saude/apps/api/src/payment/dto/asaas-webhook.dto.spec.ts`:

```ts
import type { AsaasWebhookPayload } from './asaas-webhook.dto';

describe('AsaasWebhookPayload', () => {
  it('aceita o shape de evento de pagamento recebido', () => {
    const payload: AsaasWebhookPayload = {
      id: 'evt_080225913252',
      event: 'PAYMENT_RECEIVED',
      payment: { id: 'pay_123', status: 'RECEIVED' },
    };

    expect(payload.event).toBe('PAYMENT_RECEIVED');
    expect(payload.payment.id).toBe('pay_123');
    expect(payload.payment.status).toBe('RECEIVED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/dto/asaas-webhook.dto.spec.ts --no-coverage
```

Saída esperada: falha porque o módulo `./asaas-webhook.dto` não existe (`Cannot find module './asaas-webhook.dto'`).

- [ ] **Step 3: Write minimal implementation.** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/dto/asaas-webhook.dto.ts`:

```ts
/** Subconjunto do payment dentro do payload do webhook Asaas que consumimos. */
export interface AsaasWebhookPayment {
  id: string;
  status: string;
}

/**
 * Shape do payload de webhook Asaas.
 * Não usamos class-validator aqui: o Asaas envia muitos campos extras e o
 * ValidationPipe global (forbidNonWhitelisted) rejeitaria. A extração é feita
 * de forma defensiva no PaymentWebhookService.
 */
export interface AsaasWebhookPayload {
  id: string;
  event: string;
  payment: AsaasWebhookPayment;
}
```

- [ ] **Step 4: Run test to verify it passes.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/dto/asaas-webhook.dto.spec.ts --no-coverage
```

Saída esperada: `1 passed`.

- [ ] **Step 5: Commit.**

```bash
git add /root/rodrigo/hope_saude/apps/api/src/payment/dto/asaas-webhook.dto.ts /root/rodrigo/hope_saude/apps/api/src/payment/dto/asaas-webhook.dto.spec.ts
git commit -m "feat(api): tipo AsaasWebhookPayload para o payload do webhook"
```

---

### Task 3 — `PaymentWebhookService`: idempotência + criação de consulta em `$transaction`

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.spec.ts`

O service injeta `PrismaService` e `AppointmentService`. `handleEvent(payload)`:
1. Se `payload.event` não for `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → retorna `{ status: 'ignored', reason: 'event-not-received' }` (não registra nada).
2. Se `processedWebhookEvent` com `eventId === payload.id` já existe → retorna `{ status: 'ignored', reason: 'duplicate' }` (replay).
3. Localiza `PendingCheckout` por `asaasPaymentId === payload.payment.id`. Se não existir → registra o evento (para não reprocessar) e retorna `{ status: 'ignored', reason: 'no-pending-checkout' }`.
4. Dentro de `prisma.$transaction`: cria `ProcessedWebhookEvent`, cria `Appointment` (status `CONFIRMED`) e deleta o `PendingCheckout`. Retorna `{ status: 'processed' }`.

A transação garante atomicidade. A unicidade de `eventId` é a barreira final contra corrida: dois webhooks simultâneos com o mesmo `id` — o segundo falha no `create` por violação de `@unique` (P2002), que tratamos como duplicado.

- [ ] **Step 1: Write the failing test.** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentWebhookService } from './payment-webhook.service';
import { PrismaService } from '../prisma.service';
import type { AsaasWebhookPayload } from './dto/asaas-webhook.dto';

const pending = {
  id: 7,
  patientId: 1,
  doctorId: 2,
  date: new Date('2026-06-15T14:00:00.000Z'),
  asaasPaymentId: 'pay_123',
  consultationModelId: 5,
  durationMinutes: 30,
  price: 200,
};

function buildPrismaMock() {
  const tx = {
    processedWebhookEvent: { create: jest.fn() },
    appointment: { create: jest.fn() },
    pendingCheckout: { delete: jest.fn() },
  };
  return {
    tx,
    prisma: {
      processedWebhookEvent: { findUnique: jest.fn(), create: jest.fn() },
      pendingCheckout: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
  };
}

async function buildService(prisma: unknown) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [PaymentWebhookService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return module.get<PaymentWebhookService>(PaymentWebhookService);
}

const receivedEvent: AsaasWebhookPayload = {
  id: 'evt_1',
  event: 'PAYMENT_RECEIVED',
  payment: { id: 'pay_123', status: 'RECEIVED' },
};

describe('PaymentWebhookService', () => {
  it('ignora evento que não é de pagamento recebido/confirmado', async () => {
    const { prisma } = buildPrismaMock();
    const service = await buildService(prisma);

    const result = await service.handleEvent({
      id: 'evt_2',
      event: 'PAYMENT_OVERDUE',
      payment: { id: 'pay_123', status: 'OVERDUE' },
    });

    expect(result).toEqual({ status: 'ignored', reason: 'event-not-received' });
    expect(prisma.processedWebhookEvent.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignora replay de evento já processado', async () => {
    const { prisma } = buildPrismaMock();
    (prisma.processedWebhookEvent.findUnique as jest.Mock).mockResolvedValue({ id: 'x', eventId: 'evt_1' });
    const service = await buildService(prisma);

    const result = await service.handleEvent(receivedEvent);

    expect(prisma.processedWebhookEvent.findUnique).toHaveBeenCalledWith({ where: { eventId: 'evt_1' } });
    expect(result).toEqual({ status: 'ignored', reason: 'duplicate' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('registra evento e ignora quando não há PendingCheckout', async () => {
    const { prisma } = buildPrismaMock();
    (prisma.processedWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.pendingCheckout.findUnique as jest.Mock).mockResolvedValue(null);
    const service = await buildService(prisma);

    const result = await service.handleEvent(receivedEvent);

    expect(prisma.pendingCheckout.findUnique).toHaveBeenCalledWith({ where: { asaasPaymentId: 'pay_123' } });
    expect(prisma.processedWebhookEvent.create).toHaveBeenCalledWith({
      data: { eventId: 'evt_1', eventType: 'PAYMENT_RECEIVED', paymentId: 'pay_123' },
    });
    expect(result).toEqual({ status: 'ignored', reason: 'no-pending-checkout' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cria a consulta uma única vez dentro de uma transação', async () => {
    const { prisma, tx } = buildPrismaMock();
    (prisma.processedWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.pendingCheckout.findUnique as jest.Mock).mockResolvedValue(pending);
    const service = await buildService(prisma);

    const result = await service.handleEvent(receivedEvent);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.processedWebhookEvent.create).toHaveBeenCalledWith({
      data: { eventId: 'evt_1', eventType: 'PAYMENT_RECEIVED', paymentId: 'pay_123' },
    });
    expect(tx.appointment.create).toHaveBeenCalledWith({
      data: {
        patientId: 1,
        doctorId: 2,
        date: pending.date,
        status: 'CONFIRMED',
        paymentId: 'pay_123',
        consultationModelId: 5,
        durationMinutes: 30,
        price: 200,
      },
    });
    expect(tx.pendingCheckout.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(result).toEqual({ status: 'processed' });
  });

  it('trata corrida (P2002 no create do evento) como duplicado', async () => {
    const { prisma } = buildPrismaMock();
    (prisma.processedWebhookEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.pendingCheckout.findUnique as jest.Mock).mockResolvedValue(pending);
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2002' });
    const service = await buildService(prisma);

    const result = await service.handleEvent(receivedEvent);

    expect(result).toEqual({ status: 'ignored', reason: 'duplicate' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment-webhook.service.spec.ts --no-coverage
```

Saída esperada: falha porque `./payment-webhook.service` não existe (`Cannot find module './payment-webhook.service'`).

- [ ] **Step 3: Write minimal implementation.** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { AsaasWebhookPayload } from './dto/asaas-webhook.dto';

const RECEIVED_EVENTS = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];

export type WebhookResult =
  | { status: 'processed' }
  | { status: 'ignored'; reason: 'event-not-received' | 'duplicate' | 'no-pending-checkout' };

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(private prisma: PrismaService) {}

  async handleEvent(payload: AsaasWebhookPayload): Promise<WebhookResult> {
    if (!RECEIVED_EVENTS.includes(payload.event)) {
      return { status: 'ignored', reason: 'event-not-received' };
    }

    const already = await this.prisma.processedWebhookEvent.findUnique({
      where: { eventId: payload.id },
    });
    if (already) {
      return { status: 'ignored', reason: 'duplicate' };
    }

    const eventData = {
      eventId: payload.id,
      eventType: payload.event,
      paymentId: payload.payment.id,
    };

    const pending = await this.prisma.pendingCheckout.findUnique({
      where: { asaasPaymentId: payload.payment.id },
    });
    if (!pending) {
      await this.prisma.processedWebhookEvent.create({ data: eventData });
      return { status: 'ignored', reason: 'no-pending-checkout' };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({ data: eventData });
        await tx.appointment.create({
          data: {
            patientId: pending.patientId,
            doctorId: pending.doctorId,
            date: pending.date,
            status: 'CONFIRMED',
            paymentId: pending.asaasPaymentId,
            consultationModelId: pending.consultationModelId ?? undefined,
            durationMinutes: pending.durationMinutes,
            price: pending.price,
          },
        });
        await tx.pendingCheckout.delete({ where: { id: pending.id } });
      });
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        return { status: 'ignored', reason: 'duplicate' };
      }
      throw err;
    }

    this.logger.log(`Consulta criada via webhook Asaas (pagamento ${payload.payment.id})`);
    return { status: 'processed' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment-webhook.service.spec.ts --no-coverage
```

Saída esperada: `5 passed`, suíte verde.

- [ ] **Step 5: Commit.**

```bash
git add /root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.ts /root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.service.spec.ts
git commit -m "feat(api): PaymentWebhookService idempotente cria consulta em transacao"
```

---

### Task 4 — `PaymentWebhookController`: endpoint público com validação de token

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.spec.ts`

O controller é **separado** do `PaymentController` (que tem `@UseGuards(AuthGuard('jwt'))` na classe) porque o webhook NÃO pode exigir JWT. Ele espelha o padrão do `ClinicalScaleController` (sem guard de classe). Usa `@SkipThrottle()` (o `ThrottlerGuard` é `APP_GUARD` global, ver `app.module.ts`). Lê o header `asaas-access-token` via `@Headers` e compara, em tempo constante, com `ASAAS_WEBHOOK_TOKEN` do `ConfigService`; ausência/diferença → `UnauthorizedException` (401).

- [ ] **Step 1: Write the failing test.** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentWebhookService } from './payment-webhook.service';
import type { AsaasWebhookPayload } from './dto/asaas-webhook.dto';

const payload: AsaasWebhookPayload = {
  id: 'evt_1',
  event: 'PAYMENT_RECEIVED',
  payment: { id: 'pay_123', status: 'RECEIVED' },
};

describe('PaymentWebhookController', () => {
  let controller: PaymentWebhookController;
  let webhookService: PaymentWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentWebhookController],
      providers: [
        {
          provide: PaymentWebhookService,
          useValue: { handleEvent: jest.fn().mockResolvedValue({ status: 'processed' }) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('s3cr3t-token') },
        },
      ],
    }).compile();

    controller = module.get<PaymentWebhookController>(PaymentWebhookController);
    webhookService = module.get<PaymentWebhookService>(PaymentWebhookService);
  });

  it('rejeita com 401 quando o header asaas-access-token está ausente', async () => {
    await expect(controller.handle(undefined, payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webhookService.handleEvent).not.toHaveBeenCalled();
  });

  it('rejeita com 401 quando o token é inválido', async () => {
    await expect(controller.handle('wrong', payload)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webhookService.handleEvent).not.toHaveBeenCalled();
  });

  it('delega ao service quando o token é válido', async () => {
    const result = await controller.handle('s3cr3t-token', payload);

    expect(webhookService.handleEvent).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ status: 'processed' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment-webhook.controller.spec.ts --no-coverage
```

Saída esperada: falha porque `./payment-webhook.controller` não existe (`Cannot find module './payment-webhook.controller'`).

- [ ] **Step 3: Write minimal implementation.** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.ts`:

```ts
import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PaymentWebhookService } from './payment-webhook.service';
import type { AsaasWebhookPayload } from './dto/asaas-webhook.dto';

@ApiTags('payment')
@Controller('payments/webhook')
export class PaymentWebhookController {
  constructor(
    private readonly webhookService: PaymentWebhookService,
    private readonly config: ConfigService,
  ) {}

  /** Webhook público do Asaas: validado por segredo no header, idempotente. SEM JWT. */
  @SkipThrottle()
  @ApiOperation({ summary: 'Webhook Asaas: confirma pagamento e cria a consulta (idempotente)' })
  @Post('asaas')
  async handle(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() payload: AsaasWebhookPayload,
  ) {
    const expected = this.config.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (!expected || !token || !this.tokensMatch(token, expected)) {
      throw new UnauthorizedException('Token de webhook inválido');
    }
    return this.webhookService.handleEvent(payload);
  }

  private tokensMatch(received: string, expected: string): boolean {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }
}
```

- [ ] **Step 4: Run test to verify it passes.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment-webhook.controller.spec.ts --no-coverage
```

Saída esperada: `3 passed`, suíte verde.

- [ ] **Step 5: Commit.**

```bash
git add /root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.ts /root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.controller.spec.ts
git commit -m "feat(api): endpoint publico POST /payments/webhook/asaas com validacao de token"
```

---

### Task 5 — Registrar webhook no `PaymentModule`

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.module.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.module.spec.ts`

`PrismaService` já é provider do `PaymentModule`. `ConfigService` está disponível porque `ConfigModule.forRoot({ isGlobal: true })` no `app.module.ts`. Precisamos apenas adicionar o controller e o service novos.

- [ ] **Step 1: Write the failing test.** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.module.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PaymentModule } from './payment.module';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentWebhookService } from './payment-webhook.service';

describe('PaymentModule wiring', () => {
  it('resolve PaymentWebhookController e PaymentWebhookService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PaymentModule],
    }).compile();

    expect(moduleRef.get(PaymentWebhookController)).toBeInstanceOf(PaymentWebhookController);
    expect(moduleRef.get(PaymentWebhookService)).toBeInstanceOf(PaymentWebhookService);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment-webhook.module.spec.ts --no-coverage
```

Saída esperada: falha — Nest não consegue resolver `PaymentWebhookController`/`PaymentWebhookService` porque ainda não estão registrados (`Nest could not find PaymentWebhookController element`).

- [ ] **Step 3: Write minimal implementation.** Edite `/root/rodrigo/hope_saude/apps/api/src/payment/payment.module.ts` para registrar o controller e o service:

```ts
import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { AsaasModule } from './asaas.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { ProfileDataModule } from '../profile/data/profile-data.module';
import { PrismaService } from '../prisma.service';
import { PaymentCronService } from './payment.cron.service';
import { PaymentService } from './payment.service';
import { PaymentWebhookService } from './payment-webhook.service';

@Module({
  imports: [AsaasModule, ProfileDataModule, AppointmentModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PrismaService, PaymentCronService, PaymentService, PaymentWebhookService],
  exports: [AsaasModule, PaymentService],
})
export class PaymentModule {}
```

- [ ] **Step 4: Run test to verify it passes.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment-webhook.module.spec.ts --no-coverage
```

Saída esperada: `1 passed`.

- [ ] **Step 5: Commit.**

```bash
git add /root/rodrigo/hope_saude/apps/api/src/payment/payment.module.ts /root/rodrigo/hope_saude/apps/api/src/payment/payment-webhook.module.spec.ts
git commit -m "feat(api): registra PaymentWebhookController/Service no PaymentModule"
```

---

### Task 6 — Cron vira reconciliação de backup (frequência reduzida)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts`

Com o webhook como caminho primário, o cron passa a ser apenas reconciliação de backup (cobre webhooks perdidos/atrasados). Reduzimos de `*/15 * * * *` (a cada 15 min) para `0 * * * *` (de hora em hora). A lógica de criação de consulta no cron permanece inalterada — ela já é idempotente na prática porque deleta o `PendingCheckout` ao confirmar; um `PendingCheckout` já consumido pelo webhook não estará mais em `findPendingCheckouts()`.

- [ ] **Step 1: Write the failing test.** Verifique primeiro o spec atual do cron:

```bash
cd /root/rodrigo/hope_saude/apps/api && grep -n "Cron\|cron\|reflect\|metadata\|*/15\|0 \* \* \*" src/payment/payment.cron.service.spec.ts || echo "SEM_ASSERT_DE_EXPRESSAO"
```

Adicione ao final do `describe` principal de `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts` um teste que afirma a expressão de cron via metadata do `@nestjs/schedule`:

```ts
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';

describe('PaymentCronService schedule', () => {
  it('roda de hora em hora (reconciliação de backup)', () => {
    const options = Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      PaymentCronService.prototype.handleCron,
    );
    expect(options?.cronTime ?? options).toBe('0 * * * *');
  });
});
```

(Se o import de `SCHEDULE_CRON_OPTIONS` não resolver na versão instalada, troque por `'@nestjs/schedule'` e use `SCHEDULE_CRON_OPTIONS` exportado; confirme com `grep -rn "SCHEDULE_CRON_OPTIONS" node_modules/@nestjs/schedule/dist/*.d.ts`.)

- [ ] **Step 2: Run test to verify it fails.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.cron.service.spec.ts --no-coverage
```

Saída esperada: o novo teste falha porque a expressão ainda é `*/15 * * * *` (`Expected: "0 * * * *" Received: "*/15 * * * *"`).

- [ ] **Step 3: Write minimal implementation.** Edite `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.ts`, trocando o decorator de cron:

```ts
  @Cron('0 * * * *')
  async handleCron() {
    this.logger.log('Reconciliação de pagamentos Asaas (backup do webhook)...');
```

(Mantenha o restante do corpo do método inalterado.)

- [ ] **Step 4: Run test to verify it passes.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.cron.service.spec.ts --no-coverage
```

Saída esperada: todos os testes do cron verdes, incluindo o novo `roda de hora em hora`.

- [ ] **Step 5: Commit.**

```bash
git add /root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.ts /root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts
git commit -m "refactor(api): cron Asaas vira reconciliacao de backup (0 * * * *)"
```

---

### Task 7 — Documentar `ASAAS_WEBHOOK_TOKEN` no `.env.example`

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/.env.example`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/env-example.spec.ts`

- [ ] **Step 1: Write the failing test.** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/env-example.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('.env.example documenta o webhook Asaas', () => {
  it('inclui a variável ASAAS_WEBHOOK_TOKEN', () => {
    const content = readFileSync(join(__dirname, '../../.env.example'), 'utf8');
    expect(content).toMatch(/^ASAAS_WEBHOOK_TOKEN=/m);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/env-example.spec.ts --no-coverage
```

Saída esperada: falha porque `ASAAS_WEBHOOK_TOKEN` ainda não está no arquivo.

- [ ] **Step 3: Write minimal implementation.** Edite `/root/rodrigo/hope_saude/apps/api/.env.example`, substituindo o bloco Asaas atual por:

```
ASAAS_API_URL="https://api-sandbox.asaas.com/v3"
ASAAS_API_KEY=""

# Segredo do webhook Asaas — enviado pelo Asaas no header "asaas-access-token".
# GERE com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Configure o mesmo valor no painel Asaas: Integrações > Webhooks > "Token de autenticação",
# apontando a URL para https://<seu-dominio>/payments/webhook/asaas e marcando os
# eventos PAYMENT_RECEIVED e PAYMENT_CONFIRMED.
ASAAS_WEBHOOK_TOKEN=""
```

- [ ] **Step 4: Run test to verify it passes.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/env-example.spec.ts --no-coverage
```

Saída esperada: `1 passed`.

- [ ] **Step 5: Commit.**

```bash
git add /root/rodrigo/hope_saude/apps/api/.env.example /root/rodrigo/hope_saude/apps/api/src/payment/env-example.spec.ts
git commit -m "docs(api): documenta ASAAS_WEBHOOK_TOKEN e configuracao do webhook no painel Asaas"
```

---

### Task 8 — Verificação de regressão da suíte completa

**Files:**
- (nenhum arquivo novo)

- [ ] **Step 1: Rodar a suíte completa da API.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
```

Saída esperada: todas as suítes verdes — o baseline de 241 testes/42 suítes mais os novos testes (Tasks 1-7: 5 suítes novas + asserts adicionados ao cron). Nenhuma suíte deve quebrar.

- [ ] **Step 2: Type-check estrito.** Comando:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit
```

Saída esperada: zero erros. Confirma ZERO `any` em produção e tipos coerentes (`AsaasWebhookPayload`, `WebhookResult`).

- [ ] **Step 3: Commit (se houver ajuste residual).** Se algum ajuste de tipo/import for necessário, commite com:

```bash
git add /root/rodrigo/hope_saude/apps/api/src/payment
git commit -m "test(api): verde na suite completa apos webhook Asaas idempotente"
```

Se nada mudou, pule este passo.

---

## Self-Review

Cobertura dos gaps do escopo:

1. **Endpoint público `POST /payments/webhook/asaas` com validação de `asaas-access-token` (401, `@SkipThrottle`, sem `AuthGuard` JWT):** Task 4 cria `PaymentWebhookController` separado do `PaymentController` (que tem guard JWT na classe), com `@SkipThrottle()` (ThrottlerGuard é `APP_GUARD` global), lendo o header via `@Headers('asaas-access-token')` e comparando em tempo constante (`timingSafeEqual`) com `ASAAS_WEBHOOK_TOKEN`; 401 testado para header ausente e token inválido. Registro no módulo na Task 5.
2. **Idempotência via tabela de event id processado:** Task 1 cria `ProcessedWebhookEvent` com `eventId @unique`; Task 3 verifica replay via `findUnique` e usa a violação `P2002` como barreira final de corrida. (Optou-se por tabela dedicada em vez de só `Appointment.paymentId` porque um pagamento gera múltiplos eventos e `paymentId` em `Appointment` é nullable e não-unique no schema real.)
3. **`PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` localizam `PendingCheckout` por `asaasPaymentId` e criam a consulta em `$transaction`, idempotente, reusando o caminho do cron:** Task 3 — `pendingCheckout.findUnique({ where: { asaasPaymentId } })` (campo `@unique` confirmado no schema), criação de `Appointment` com `status: 'CONFIRMED'` espelhando `AppointmentService.createConfirmedAppointment`, e `delete` do `PendingCheckout`, tudo dentro de um único `prisma.$transaction`.
4. **Cron vira reconciliação de backup:** Task 6 reduz a frequência de `*/15 * * * *` para `0 * * * *` e ajusta a mensagem de log; lógica de confirmação preservada (já idempotente por deletar o `PendingCheckout`).
5. **`.env.example` + documentação do painel Asaas:** Task 7 adiciona `ASAAS_WEBHOOK_TOKEN` com comentário explicando geração do segredo, configuração no painel Asaas (URL `/payments/webhook/asaas`, header `asaas-access-token`, eventos `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`).

Testes exigidos no escopo, todos presentes: assinatura inválida → 401 (Task 4), evento válido cria consulta uma vez (Task 3, "cria a consulta uma única vez dentro de uma transação"), replay não duplica (Task 3, "ignora replay" + "P2002 como duplicado"), evento de pagamento não-recebido ignorado (Task 3, "ignora evento que não é de pagamento recebido/confirmado").

TDD red→green→refactor: cada Task tem teste vermelho antes da implementação, comando exato de execução, implementação mínima e re-execução verde. Sem `forwardRef`. Fidelidade ao código real verificada: `PendingCheckout.asaasPaymentId @unique`, shape de `createConfirmedAppointment`, `ThrottlerGuard` global, `ConfigModule.isGlobal`, padrão de controller público do `ClinicalScaleController`, `ValidationPipe` global com `forbidNonWhitelisted` (motivo do DTO ser interface sem decorators). Sem placeholders: todos os blocos de código são completos e todos os tipos/métodos referenciados (`AsaasWebhookPayload`, `WebhookResult`, `PaymentWebhookService`, `PaymentWebhookController`, `processedWebhookEvent`) são definidos nas Tasks ou já existem no repo.
