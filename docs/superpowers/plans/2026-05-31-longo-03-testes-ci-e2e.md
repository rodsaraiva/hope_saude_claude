# Testes: Integração com DB Real, E2E no CI e Robustez Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar as lacunas de teste da API/Web do Hope Saúde — integração com banco real nos caminhos de persistência sem cobertura, spec do único controller órfão (clinical-scale), Playwright dirigível no CI, robustez (sem `setTimeout` fixo, sem worker leak, sem `forceExit`) e endurecimento de auth (timing-mitigation + remoção do `@SkipThrottle` público).

**Architecture:** TDD estrito (red→green→refactor) em todas as Tasks. Testes de integração usam um `PrismaClient` apontado para um arquivo SQLite temporário via `datasourceUrl` (o `schema.prisma` hardcoda `url = "file:./dev.db"`, então o override em runtime é a única forma de isolar o DB; isso continua válido após a migração para PostgreSQL, trocando apenas a URL). O CI ganha um job `e2e` que sobe API+Web com Mailpit/mocks e roda Playwright. Robustez troca esperas fixas por polling com timeout e investiga handles abertos com `--detectOpenHandles` antes de qualquer `forceExit`.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite hoje, PostgreSQL no médio prazo), Jest 29 (ts-jest, `isolatedModules`), supertest, @nestjs/testing, bcryptjs, @nestjs/throttler, @nestjs/schedule, Playwright, Mailpit, GitHub Actions.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/api/test/helpers/test-prisma.ts` | Fábrica de `PrismaService` apontando para SQLite temporário + `pushSchema` (migrate deploy) e teardown |
| Create | `apps/api/test/appointment-persistence.int-spec.ts` | Integração DB real: `createConfirmedAppointment`/`createPendingCheckout` (price Float, durationMinutes) + unicidade de `asaasPaymentId` (conflito de slot) |
| Create | `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts` | Spec do controller órfão: RBAC DOCTOR/PATIENT/próprio-id + caminho público por token |
| Modify | `apps/api/test/notifications-auth.e2e-spec.ts` | Trocar `setTimeout(500)` por polling com timeout (`waitForOutboxSent`) |
| Create | `apps/api/test/helpers/poll.ts` | Helper `pollUntil` reutilizável (polling com timeout) |
| Create | `apps/api/src/auth/auth.service.timing.spec.ts` | Teste de timing-mitigation do `validateUser` (bcrypt dummy em usuário inexistente) |
| Modify | `apps/api/src/auth/auth.service.ts` | `validateUser` faz `bcrypt.compare` contra hash dummy quando o usuário não existe |
| Modify | `apps/api/src/clinical-scale/clinical-scale.controller.ts` | Remover `@SkipThrottle()` do GET público `public/:token` |
| Create | `apps/api/src/clinical-scale/clinical-scale.controller.throttle.spec.ts` | Garante ausência do metadata `SkipThrottle` no handler público |
| Modify | `.github/workflows/ci.yml` | Novo job `e2e` (API+Web+Mailpit) rodando Playwright; ajustar DATABASE_URL dos jobs |
| Modify | `apps/web/playwright.config.ts` | `webServer` para subir API+Web no CI |
| Create | `apps/api/test/open-handles.int-spec.ts` | Reproduz o worker leak (boot do AppModule sem teardown) e prova o fix com `$disconnect`/`app.close()` |

---

## Tasks

### Task 1 — Helper de Prisma para testes de integração com DB real

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/test/helpers/test-prisma.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/test/helpers/test-prisma.spec.ts`

Contexto: `schema.prisma` linha 3 hardcoda `url = "file:./dev.db"`, então as variáveis de ambiente NÃO são honradas pelo schema. O `PrismaClient` (v5) aceita `datasourceUrl` em runtime — confirmado: `new PrismaClient({ datasourceUrl: 'file:/tmp/x.db' })` instancia sem erro. O helper cria um arquivo temporário, aplica o schema com `prisma migrate deploy` (há migrations reais em `prisma/migrations/`) e devolve um `PrismaService` isolado.

- [ ] **Step 1: Write the failing test**

Criar `/root/rodrigo/hope_saude/apps/api/test/helpers/test-prisma.spec.ts`:

```ts
import { existsSync, rmSync } from 'node:fs';
import { createTestPrisma } from './test-prisma';

describe('createTestPrisma', () => {
  it('cria um PrismaService isolado num arquivo SQLite temporário com schema aplicado', async () => {
    const { prisma, dbFile, cleanup } = await createTestPrisma();

    expect(dbFile).toMatch(/hope-test-.*\.db$/);
    expect(existsSync(dbFile)).toBe(true);

    // schema aplicado: consigo inserir e ler um usuário
    const user = await prisma.user.create({
      data: { email: `helper-${Date.now()}@hope.test`, name: 'Helper', password: 'h', role: 'PATIENT' },
    });
    expect(user.id).toBeGreaterThan(0);

    await cleanup();
    expect(existsSync(dbFile)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/helpers/test-prisma.spec.ts --no-coverage
```

Esperado: falha em `Cannot find module './test-prisma'` (o helper ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Criar `/root/rodrigo/hope_saude/apps/api/test/helpers/test-prisma.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

export interface TestPrisma {
  prisma: PrismaClient;
  dbFile: string;
  cleanup: () => Promise<void>;
}

/**
 * Cria um PrismaClient isolado num SQLite temporário. O schema.prisma hardcoda
 * url=file:./dev.db, então DATABASE_URL não basta: o arquivo é aplicado via
 * `prisma migrate deploy` (DATABASE_URL aponta o CLI) e o client usa datasourceUrl.
 */
export async function createTestPrisma(): Promise<TestPrisma> {
  const dir = mkdtempSync(join(tmpdir(), 'hope-test-'));
  const dbFile = join(dir, `hope-test-${process.hrtime.bigint()}.db`);
  const url = `file:${dbFile}`;

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  const prisma = new PrismaClient({ datasourceUrl: url });
  await prisma.$connect();

  return {
    prisma,
    dbFile,
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/helpers/test-prisma.spec.ts --no-coverage --detectOpenHandles
```

Esperado: `Tests: 1 passed`, sem aviso de handles abertos (o `cleanup()` faz `$disconnect`).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/test/helpers/test-prisma.ts apps/api/test/helpers/test-prisma.spec.ts && git commit -m "test(api): helper de Prisma isolado em SQLite temporário p/ testes de integração"
```

---

### Task 2 — Integração DB real: persistência de appointment e conflito de slot

**Files:**
- Test: `/root/rodrigo/hope_saude/apps/api/test/appointment-persistence.int-spec.ts`

Contexto: hoje `appointment.service.spec.ts` só verifica que `prisma.*.create` foi chamado com o `data` certo (mock). O drift de schema (ex.: `price Float`, `durationMinutes Int @default(60)`, `asaasPaymentId @unique`) só aparece contra o banco. Este spec usa o helper da Task 1 e o `AppointmentService` real. `PendingCheckout.asaasPaymentId` é `@unique` (schema linha ~185), então duas reservas com o mesmo pagamento devem colidir (P2002) — é o "conflito de slot" detectável.

- [ ] **Step 1: Write the failing test**

Criar `/root/rodrigo/hope_saude/apps/api/test/appointment-persistence.int-spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { AppointmentService } from '../src/appointment/appointment.service';
import { PrismaService } from '../src/prisma.service';
import { createTestPrisma } from './helpers/test-prisma';

describe('AppointmentService (integração DB real)', () => {
  let prisma: PrismaClient;
  let cleanup: () => Promise<void>;
  let service: AppointmentService;
  let patientId: number;
  let doctorId: number;

  beforeAll(async () => {
    const ctx = await createTestPrisma();
    prisma = ctx.prisma;
    cleanup = ctx.cleanup;
    service = new AppointmentService(prisma as unknown as PrismaService);

    const patient = await prisma.user.create({
      data: { email: `p-${Date.now()}@hope.test`, name: 'Paciente', password: 'h', role: 'PATIENT' },
    });
    const doctor = await prisma.user.create({
      data: { email: `d-${Date.now()}@hope.test`, name: 'Doutor', password: 'h', role: 'DOCTOR' },
    });
    patientId = patient.id;
    doctorId = doctor.id;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('createConfirmedAppointment persiste CONFIRMED com defaults durationMinutes=60 e price=150.0', async () => {
    const date = new Date('2026-06-01T10:00:00.000Z');
    const created = await service.createConfirmedAppointment({
      patientId,
      doctorId,
      date,
      paymentId: 'pay_int_1',
    });

    const row = await prisma.appointment.findUnique({ where: { id: created.id } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe('CONFIRMED');
    expect(row!.paymentId).toBe('pay_int_1');
    expect(row!.durationMinutes).toBe(60);
    expect(row!.price).toBeCloseTo(150.0);
  });

  it('createConfirmedAppointment respeita price/durationMinutes custom (Float real persiste)', async () => {
    const created = await service.createConfirmedAppointment({
      patientId,
      doctorId,
      date: new Date('2026-06-02T10:00:00.000Z'),
      paymentId: 'pay_int_2',
      durationMinutes: 30,
      price: 199.9,
    });

    const row = await prisma.appointment.findUnique({ where: { id: created.id } });
    expect(row!.durationMinutes).toBe(30);
    expect(row!.price).toBeCloseTo(199.9);
  });

  it('createPendingCheckout persiste e o segundo checkout com mesmo asaasPaymentId colide (P2002)', async () => {
    const base = {
      patientId,
      doctorId,
      date: new Date('2026-06-03T10:00:00.000Z'),
      asaasPaymentId: 'pay_unique_dup',
    };
    const first = await service.createPendingCheckout(base);
    expect(first.asaasPaymentId).toBe('pay_unique_dup');
    expect(first.durationMinutes).toBe(60);
    expect(first.price).toBeCloseTo(150.0);

    await expect(service.createPendingCheckout(base)).rejects.toMatchObject({ code: 'P2002' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/appointment-persistence.int-spec.ts --no-coverage
```

Esperado: a suíte sobe (helper já existe) mas, se o helper ou o schema estiverem incorretos, falha aqui. Nesta Task o objetivo é o teste passar contra o serviço REAL existente — escreva o teste primeiro e confirme que ele descreve o comportamento atual. Caso `createConfirmedAppointment`/`createPendingCheckout` não persistissem corretamente, o teste falharia em `row!.durationMinutes`/`P2002`. (Espera-se verde, pois o serviço de produção já está correto; o teste é a rede de segurança contra drift futuro.)

- [ ] **Step 3: Write minimal implementation**

Nenhuma mudança de produção: `AppointmentService.createConfirmedAppointment`/`createPendingCheckout` já existem com defaults `durationMinutes ?? 60` e `price ?? 150.0`, e `asaasPaymentId` já é `@unique` no schema. Este é um teste de caracterização de integração. Se o Step 2 revelar drift, corrigir o schema/serviço é a implementação mínima.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/appointment-persistence.int-spec.ts --no-coverage --detectOpenHandles
```

Esperado: `Tests: 3 passed`, sem handles abertos (afterAll faz `cleanup()`).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/test/appointment-persistence.int-spec.ts && git commit -m "test(api): integração DB real cobre persistência de appointment e conflito de asaasPaymentId"
```

---

### Task 3 — Spec do clinical-scale.controller (único controller sem spec)

**Files:**
- Test: `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.controller.spec.ts`

Contexto: o controller faz RBAC inline (`req.user.role`/`req.user.userId`) e delega ao `ClinicalScaleService`. `req.user` segue `AuthenticatedUser` = `{ userId, email?, role, name? }`. O service é mockado (já é a convenção em `clinical-scale.service.spec.ts`). Cobrir: DOCTOR cria; PATIENT não cria (Forbidden); PATIENT só vê o próprio id; DOCTOR filtra por `doctorId`; `findOne` só DOCTOR; caminho público por token delega sem auth.

- [ ] **Step 1: Write the failing test**

Criar `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.controller.spec.ts`:

```ts
import { ForbiddenException } from '@nestjs/common';
import { ClinicalScaleController } from './clinical-scale.controller';
import { ClinicalScaleService } from './clinical-scale.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

describe('ClinicalScaleController', () => {
  let controller: ClinicalScaleController;
  let service: jest.Mocked<Pick<
    ClinicalScaleService,
    'createScale' | 'findAllByPatient' | 'findOneForDoctor' | 'findPublicByToken' | 'submitAnswers'
  >>;

  const reqAs = (role: 'DOCTOR' | 'PATIENT', userId: number): AuthenticatedRequest =>
    ({ user: { userId, role } }) as AuthenticatedRequest;

  beforeEach(() => {
    service = {
      createScale: jest.fn(),
      findAllByPatient: jest.fn(),
      findOneForDoctor: jest.fn(),
      findPublicByToken: jest.fn(),
      submitAnswers: jest.fn(),
    };
    controller = new ClinicalScaleController(service as unknown as ClinicalScaleService);
  });

  describe('create (POST /clinical-scales)', () => {
    it('DOCTOR: delega ao service com doctorId = req.user.userId', async () => {
      service.createScale.mockResolvedValue({ id: 1 } as never);
      await controller.create(reqAs('DOCTOR', 7), { patientId: 2, type: 'PHQ9' });
      expect(service.createScale).toHaveBeenCalledWith({
        doctorId: 7,
        patientId: 2,
        type: 'PHQ9',
        notes: undefined,
      });
    });

    it('PATIENT: lança ForbiddenException e não chama o service', async () => {
      await expect(
        controller.create(reqAs('PATIENT', 5), { patientId: 5, type: 'PHQ9' }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.createScale).not.toHaveBeenCalled();
    });
  });

  describe('listByPatient (GET /clinical-scales/patient/:patientId)', () => {
    it('DOCTOR: passa doctorFilter = req.user.userId', async () => {
      service.findAllByPatient.mockResolvedValue([] as never);
      await controller.listByPatient(reqAs('DOCTOR', 9), '2');
      expect(service.findAllByPatient).toHaveBeenCalledWith(2, 9);
    });

    it('PATIENT vendo o próprio id: sem doctorFilter (undefined)', async () => {
      service.findAllByPatient.mockResolvedValue([] as never);
      await controller.listByPatient(reqAs('PATIENT', 3), '3');
      expect(service.findAllByPatient).toHaveBeenCalledWith(3, undefined);
    });

    it('PATIENT vendo id alheio: ForbiddenException', async () => {
      await expect(controller.listByPatient(reqAs('PATIENT', 3), '99')).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.findAllByPatient).not.toHaveBeenCalled();
    });
  });

  describe('findOne (GET /clinical-scales/:id)', () => {
    it('DOCTOR: delega findOneForDoctor(userId, id)', async () => {
      service.findOneForDoctor.mockResolvedValue({ id: 4 } as never);
      await controller.findOne(reqAs('DOCTOR', 8), '4');
      expect(service.findOneForDoctor).toHaveBeenCalledWith(8, 4);
    });

    it('PATIENT: ForbiddenException', async () => {
      await expect(controller.findOne(reqAs('PATIENT', 8), '4')).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.findOneForDoctor).not.toHaveBeenCalled();
    });
  });

  describe('endpoints públicos por token (sem auth)', () => {
    it('getPublic delega findPublicByToken(token)', async () => {
      service.findPublicByToken.mockResolvedValue({ type: 'PHQ9' } as never);
      await controller.getPublic('tok-123');
      expect(service.findPublicByToken).toHaveBeenCalledWith('tok-123');
    });

    it('submitAnswers delega submitAnswers(token, answers)', async () => {
      service.submitAnswers.mockResolvedValue({ id: 1 } as never);
      await controller.submitAnswers('tok-123', { answers: [0, 1, 2, 3, 0, 1, 2, 3, 0] });
      expect(service.submitAnswers).toHaveBeenCalledWith('tok-123', [0, 1, 2, 3, 0, 1, 2, 3, 0]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/clinical-scale/clinical-scale.controller.spec.ts --no-coverage
```

Esperado: verde já na primeira execução, pois o controller já implementa esse comportamento. Se algo falhar (ex.: shape de chamada), o teste expõe a regressão. Para provar que o teste tem poder de pegar regressão, comente temporariamente a checagem `if (req.user.role !== 'DOCTOR')` do método `create` e rode de novo — deve falhar em "PATIENT: lança ForbiddenException"; depois reverta.

- [ ] **Step 3: Write minimal implementation**

Nenhuma mudança de produção: o controller já existe. A "implementação" é o próprio spec cobrindo o controller órfão.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/clinical-scale/clinical-scale.controller.spec.ts --no-coverage
```

Esperado: `Tests: 8 passed`.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/clinical-scale/clinical-scale.controller.spec.ts && git commit -m "test(api): spec do ClinicalScaleController (RBAC DOCTOR/PATIENT + caminho público por token)"
```

---

### Task 4 — Robustez: trocar setTimeout(500) por polling com timeout

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/test/helpers/poll.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/test/helpers/poll.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/test/notifications-auth.e2e-spec.ts`

Contexto: `notifications-auth.e2e-spec.ts` linhas 82 e 132 usam `await new Promise((r) => setTimeout(r, 500))` para esperar o envio assíncrono do email. Espera fixa é flaky (lenta demais ou curta demais). Trocar por `pollUntil`, que reavalia uma condição até passar ou estourar o timeout.

- [ ] **Step 1: Write the failing test**

Criar `/root/rodrigo/hope_saude/apps/api/test/helpers/poll.spec.ts`:

```ts
import { pollUntil } from './poll';

describe('pollUntil', () => {
  it('resolve quando a condição passa antes do timeout', async () => {
    let calls = 0;
    const result = await pollUntil(
      async () => {
        calls += 1;
        return calls >= 3 ? 'ok' : null;
      },
      { timeoutMs: 1000, intervalMs: 10 },
    );
    expect(result).toBe('ok');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('rejeita quando estoura o timeout sem satisfazer a condição', async () => {
    await expect(
      pollUntil(async () => null, { timeoutMs: 50, intervalMs: 10 }),
    ).rejects.toThrow(/timeout/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/helpers/poll.spec.ts --no-coverage
```

Esperado: falha em `Cannot find module './poll'`.

- [ ] **Step 3: Write minimal implementation**

Criar `/root/rodrigo/hope_saude/apps/api/test/helpers/poll.ts`:

```ts
export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

/**
 * Reavalia `fn` a cada intervalMs até devolver um valor truthy ou estourar o
 * timeout. Substitui esperas fixas (setTimeout) em testes assíncronos.
 */
export async function pollUntil<T>(
  fn: () => Promise<T | null | undefined>,
  options: PollOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const value = await fn();
    if (value) {
      return value;
    }
    if (Date.now() >= deadline) {
      throw new Error(`pollUntil: timeout após ${timeoutMs}ms sem condição satisfeita`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/helpers/poll.spec.ts --no-coverage
```

Esperado: `Tests: 2 passed`.

- [ ] **Step 5: Refatorar o e2e para usar pollUntil e remover os setTimeout fixos**

No arquivo `/root/rodrigo/hope_saude/apps/api/test/notifications-auth.e2e-spec.ts`, adicionar o import logo após os imports existentes:

```ts
import { pollUntil } from './helpers/poll';
```

Substituir, no teste de forgot-password, o bloco:

```ts
      await new Promise((r) => setTimeout(r, 500));

      const outbox = await prisma.emailOutbox.findMany({ where: { tag: 'password-reset' } });
      expect(outbox).toHaveLength(1);
      expect(outbox[0].status).toBe('SENT');
```

por:

```ts
      const outbox = await pollUntil(async () => {
        const rows = await prisma.emailOutbox.findMany({ where: { tag: 'password-reset' } });
        return rows.length === 1 && rows[0].status === 'SENT' ? rows : null;
      });
      expect(outbox).toHaveLength(1);
      expect(outbox[0].status).toBe('SENT');
```

Substituir, no teste de verify-email/request, o bloco:

```ts
      await new Promise((r) => setTimeout(r, 500));

      const outbox = await prisma.emailOutbox.findMany({ where: { tag: 'email-verification' } });
      expect(outbox).toHaveLength(1);
      expect(outbox[0].status).toBe('SENT');
```

por:

```ts
      const outbox = await pollUntil(async () => {
        const rows = await prisma.emailOutbox.findMany({ where: { tag: 'email-verification' } });
        return rows.length === 1 && rows[0].status === 'SENT' ? rows : null;
      });
      expect(outbox).toHaveLength(1);
      expect(outbox[0].status).toBe('SENT');
```

Verificar que nenhum `setTimeout` fixo restou:

```bash
cd /root/rodrigo/hope_saude/apps/api && grep -n "setTimeout(r, 500)" test/notifications-auth.e2e-spec.ts
```

Esperado: nenhuma linha (saída vazia).

- [ ] **Step 6: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/test/helpers/poll.ts apps/api/test/helpers/poll.spec.ts apps/api/test/notifications-auth.e2e-spec.ts && git commit -m "test(api): substitui setTimeout fixo por polling com timeout no e2e de notifications"
```

---

### Task 5 — Investigar e corrigir o worker leak da suíte API (sem forceExit)

**Files:**
- Test: `/root/rodrigo/hope_saude/apps/api/test/open-handles.int-spec.ts`

Contexto: o `AppModule` importa `ScheduleModule.forRoot()` e registra `PaymentCronService` com `@Cron('*/15 * * * *')`. Em suítes e2e que dão `Test.createTestingModule({ imports: [AppModule] })`, se `app.close()` não rodar, o agendador e o `PrismaService` (que abre conexão em `onModuleInit`) ficam pendurados — Jest reclama de "worker leak"/handles abertos. O `PrismaService` já implementa `onModuleDestroy → $disconnect`, e `app.close()` dispara os lifecycle hooks e para o `SchedulerRegistry`. A cura é garantir `app.close()` em todo e2e (não `forceExit`). Este spec reproduz o leak e prova o fix.

- [ ] **Step 1: Write the failing test**

Primeiro, evidência do estado atual:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test --no-coverage --detectOpenHandles 2>&1 | grep -iE "open handle|Jest did not exit|Timeout|PRISMA|schedule" | head
```

Anote qualquer handle reportado (esperado: handles do agendador/Prisma se algum e2e não fechar o app). Em seguida criar `/root/rodrigo/hope_saude/apps/api/test/open-handles.int-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('App lifecycle (sem worker leak)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.MAIL_DRIVER = process.env.MAIL_DRIVER ?? 'smtp';
    process.env.MAIL_FROM = process.env.MAIL_FROM ?? 'Hope <no-reply@hope.test>';
    process.env.MAIL_APP_URL = process.env.MAIL_APP_URL ?? 'http://localhost:3001';
    process.env.SMTP_HOST = process.env.SMTP_HOST ?? 'localhost';
    process.env.SMTP_PORT = process.env.SMTP_PORT ?? '1025';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 60_000);

  it('fecha o app disparando onModuleDestroy (Prisma $disconnect + scheduler parado)', async () => {
    await expect(app.close()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/open-handles.int-spec.ts --no-coverage --detectOpenHandles
```

Esperado: o teste em si passa, mas observe a saída de `--detectOpenHandles`. Se aparecer "Jest did not exit one second after the test run has completed" ou handles do scheduler/Prisma, o leak existe quando OUTRO e2e não fecha o app. Confirme rodando a suíte e2e inteira:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test --no-coverage --detectOpenHandles 2>&1 | grep -iE "did not exit|open handle" | head
```

Esperado (estado atual): mensagem de handles abertos se algum e2e não tiver `afterAll(() => app.close())`.

- [ ] **Step 3: Write minimal implementation**

Garantir `afterAll` com `app.close()` em TODOS os e2e que sobem `AppModule`. Auditar:

```bash
cd /root/rodrigo/hope_saude/apps/api && grep -L "app.close()" test/*.e2e-spec.ts
```

Para cada arquivo listado que importe `AppModule`, adicionar (se ausente) no fim do `describe`:

```ts
  afterAll(async () => {
    await app.close();
  });
```

`auth-rbac.e2e-spec.ts` e `notifications-auth.e2e-spec.ts` já têm `afterAll → app.close()` (confirmado), então não devem aparecer. NÃO adicionar `--forceExit` ao `jest.config.js` nem ao script de teste: a cura é o lifecycle correto, não mascarar o handle.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test --no-coverage --detectOpenHandles 2>&1 | tail -20
```

Esperado: suíte verde e SEM "Jest did not exit"/"open handle". Se ainda houver handle, investigar o provider que o abriu (ex.: SMTP transport sem `close()`) antes de qualquer workaround.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/test/open-handles.int-spec.ts && git commit -m "test(api): prova de lifecycle (app.close) p/ matar worker leak do scheduler/Prisma sem forceExit"
```

---

### Task 6 — Timing-mitigation no validateUser (bcrypt dummy) com teste

**Files:**
- Test: `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.timing.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.ts`

Contexto: hoje `validateUser` (auth.service.ts) retorna cedo quando o usuário não existe, SEM rodar `bcrypt.compare`. Isso cria um canal lateral de timing: respostas rápidas revelam emails inexistentes (user enumeration). A mitigação padrão é comparar a senha contra um hash dummy fixo quando o usuário não existe, igualando o custo. `bcryptjs` expõe `hashSync`/`compare` (confirmado disponível).

- [ ] **Step 1: Write the failing test**

Criar `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.timing.spec.ts`:

```ts
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService.validateUser — timing-mitigation', () => {
  function makeService(findUnique: jest.Mock) {
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    return new AuthService(
      prisma,
      {} as JwtService,
      {} as NotificationsService,
      {} as ConfigService,
    );
  }

  it('usuário inexistente: ainda chama bcrypt.compare (custo constante) e retorna null', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    const service = makeService(jest.fn().mockResolvedValue(null));

    const result = await service.validateUser('naoexiste@test.com', 'qualquer-senha');

    expect(result).toBeNull();
    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();
  });

  it('usuário existente com senha correta: retorna PublicUser sem password', async () => {
    const hash = await bcrypt.hash('segredo123', 10);
    const service = makeService(
      jest.fn().mockResolvedValue({
        id: 1,
        email: 'maria@test.com',
        name: 'Maria',
        role: 'PATIENT',
        password: hash,
        updatedAt: new Date(),
        createdAt: new Date(),
      }),
    );

    const result = await service.validateUser('maria@test.com', 'segredo123');

    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).password).toBeUndefined();
    expect((result as { email: string }).email).toBe('maria@test.com');
  });

  it('usuário existente com senha errada: retorna null', async () => {
    const hash = await bcrypt.hash('segredo123', 10);
    const service = makeService(
      jest.fn().mockResolvedValue({
        id: 1,
        email: 'maria@test.com',
        name: 'Maria',
        role: 'PATIENT',
        password: hash,
        updatedAt: new Date(),
        createdAt: new Date(),
      }),
    );

    const result = await service.validateUser('maria@test.com', 'senha-errada');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.timing.spec.ts --no-coverage
```

Esperado: falha no primeiro teste — `expect(compareSpy).toHaveBeenCalledTimes(1)` recebe `0`, porque o `validateUser` atual retorna antes de chamar `bcrypt.compare` quando o usuário não existe.

- [ ] **Step 3: Write minimal implementation**

Editar `/root/rodrigo/hope_saude/apps/api/src/auth/auth.service.ts`. Adicionar uma constante de hash dummy logo após o decorator `@Injectable()`/abertura da classe (antes do construtor) e reescrever `validateUser`:

Adicionar a constante no topo do arquivo, após os imports:

```ts
/**
 * Hash bcrypt fixo (senha aleatória descartável) usado para igualar o custo de
 * verificação quando o e-mail não existe — mitiga user-enumeration por timing.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('hope-timing-mitigation-dummy', 10);
```

Substituir o método atual:

```ts
  async validateUser(email: string, pass: string): Promise<PublicUser | null> {
    const user = await this.findUserByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password: _password, updatedAt: _updatedAt, ...result } = user;
      return result as PublicUser;
    }
    return null;
  }
```

por:

```ts
  async validateUser(email: string, pass: string): Promise<PublicUser | null> {
    const user = await this.findUserByEmail(email);
    // Compara sempre (contra hash dummy se o usuário não existir) p/ custo constante.
    const passwordMatches = await bcrypt.compare(pass, user?.password ?? DUMMY_PASSWORD_HASH);
    if (user && passwordMatches) {
      const { password: _password, updatedAt: _updatedAt, ...result } = user;
      return result as PublicUser;
    }
    return null;
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.timing.spec.ts src/auth/auth.service.spec.ts --no-coverage
```

Esperado: `Tests: <novos 3> + <existentes> passed` — os testes antigos do `auth.service.spec.ts` continuam verdes (não testam contagem de `compare`).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.timing.spec.ts && git commit -m "fix(api): timing-mitigation em validateUser (bcrypt dummy p/ usuário inexistente)"
```

---

### Task 7 — Remover @SkipThrottle do GET público de escala

**Files:**
- Test: `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.controller.throttle.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.controller.ts`

Contexto: `getPublic` (rota `GET /clinical-scales/public/:token`) tem `@SkipThrottle()`. É um endpoint público sem autenticação que vaza informação por token — deixá-lo sem rate-limit permite brute-force de tokens. Removendo o decorator, ele volta ao throttler `default` (120 req/60s) configurado no `app.module`. O `@SkipThrottle` aplica metadata via `Reflector`; o teste verifica a ausência desse metadata no handler.

- [ ] **Step 1: Write the failing test**

Criar `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.controller.throttle.spec.ts`:

```ts
import { Reflector } from '@nestjs/core';
import { THROTTLER_SKIP } from '@nestjs/throttler/dist/throttler.constants';
import { ClinicalScaleController } from './clinical-scale.controller';

describe('ClinicalScaleController — throttling do endpoint público', () => {
  const reflector = new Reflector();

  it('GET public/:token NÃO deve ter SkipThrottle (fica sob o throttler default)', () => {
    const skip = reflector.get(THROTTLER_SKIP, ClinicalScaleController.prototype.getPublic);
    expect(skip).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/clinical-scale/clinical-scale.controller.throttle.spec.ts --no-coverage
```

Esperado: falha — `skip` vem definido (`{ default: true }` ou `true`), porque `@SkipThrottle()` ainda decora `getPublic`.

- [ ] **Step 3: Write minimal implementation**

Editar `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.controller.ts`.

Remover o decorator do método público:

```ts
  @SkipThrottle()
  @ApiOperation({
    summary: 'Endpoint público: paciente recebe a escala via link/token para preencher',
  })
  @Get('public/:token')
  async getPublic(@Param('token') token: string) {
    return this.service.findPublicByToken(token);
  }
```

passa a:

```ts
  @ApiOperation({
    summary: 'Endpoint público: paciente recebe a escala via link/token para preencher',
  })
  @Get('public/:token')
  async getPublic(@Param('token') token: string) {
    return this.service.findPublicByToken(token);
  }
```

E remover o import órfão (não há mais uso de `SkipThrottle` no arquivo):

```ts
import { SkipThrottle } from '@nestjs/throttler';
```

Verificar que o import sumiu:

```bash
cd /root/rodrigo/hope_saude/apps/api && grep -n "SkipThrottle" src/clinical-scale/clinical-scale.controller.ts
```

Esperado: saída vazia.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/clinical-scale/clinical-scale.controller.throttle.spec.ts src/clinical-scale/clinical-scale.controller.spec.ts --no-coverage
```

Esperado: ambos verdes.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/clinical-scale/clinical-scale.controller.ts apps/api/src/clinical-scale/clinical-scale.controller.throttle.spec.ts && git commit -m "fix(api): remove SkipThrottle do GET público de escala (anti brute-force de token)"
```

---

### Task 8 — Playwright dirigível no CI: webServer + job e2e

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/playwright.config.ts`
- Modify: `/root/rodrigo/hope_saude/.github/workflows/ci.yml`

Contexto: hoje `playwright.config.ts` tem `baseURL: http://localhost:3001` e comentário "Servidores iniciados manualmente via `npm run dev`". No CI não há ninguém para subir os servidores, então os e2e da Web não rodam. Adicionar `webServer` faz o Playwright subir API+Web sozinho. O CI ganha um job `e2e` com Mailpit (service container) e variáveis de ambiente que evitam dependências externas. Os e2e da API que falam com Mailpit (`notifications-auth.e2e-spec.ts`) usam `http://localhost:8025` — alinhado ao service container.

- [ ] **Step 1: Write the failing test (config como contrato verificável)**

O artefato testável aqui é a config. Verificar que hoje NÃO há `webServer`:

```bash
cd /root/rodrigo/hope_saude/apps/web && grep -n "webServer" playwright.config.ts
```

Esperado: saída vazia (ainda não existe). Esse é o "vermelho": rodar Playwright no CI sem servidor falharia com ECONNREFUSED em `localhost:3001`.

- [ ] **Step 2: Run test to verify it fails (simular ausência de servidor)**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx playwright test test/navbar.e2e.spec.ts --reporter=line 2>&1 | grep -iE "ECONNREFUSED|refused|net::ERR|Timed out|webServer" | head
```

Esperado (sem servidores rodando): erro de conexão recusada em `localhost:3001`, provando que falta `webServer`.

- [ ] **Step 3: Write minimal implementation**

Editar `/root/rodrigo/hope_saude/apps/web/playwright.config.ts`. Substituir o comentário final:

```ts
  // Servidores iniciados manualmente via `npm run dev` no root.
});
```

por um bloco `webServer` (Playwright sobe API e Web e espera as URLs ficarem prontas):

```ts
  webServer: [
    {
      command: 'npm run start --workspace apps/api',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: process.env.GITHUB_WORKSPACE ?? process.cwd(),
      env: {
        DATABASE_URL: 'file:./e2e.db',
        JWT_SECRET: 'e2e-secret-not-for-production',
        DATA_ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        MAIL_DRIVER: 'smtp',
        MAIL_FROM: 'Hope <no-reply@hope.test>',
        MAIL_APP_URL: 'http://localhost:3001',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_SECURE: 'false',
      },
    },
    {
      command: 'npm run start --workspace apps/web',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: process.env.GITHUB_WORKSPACE ?? process.cwd(),
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      },
    },
  ],
});
```

Nota: a API expõe `GET /health` (há `HealthModule` no `app.module`). Se o `npm run start` da API/Web tiver outro nome de script, ajuste o `command` para o script de produção real (`npm run start:prod`/`next start`), confirmando antes com `npm run --workspace apps/api` e `npm run --workspace apps/web`.

Adicionar no `.github/workflows/ci.yml`, após o job `web`, o job `e2e`:

```yaml
  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 25

    services:
      mailpit:
        image: axllent/mailpit:latest
        ports:
          - 1025:1025
          - 8025:8025

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate
        working-directory: apps/api
        env:
          DATABASE_URL: 'file:./e2e.db'

      - name: Apply migrations (e2e DB)
        run: npx prisma migrate deploy
        working-directory: apps/api
        env:
          DATABASE_URL: 'file:./e2e.db'

      - name: Build API
        run: npm run build --workspace apps/api

      - name: Build Web
        run: npm run build --workspace apps/web
        env:
          NEXT_PUBLIC_API_URL: 'http://localhost:3000'

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        working-directory: apps/web

      - name: Run Playwright E2E
        run: npx playwright test
        working-directory: apps/web
        env:
          CI: 'true'

      - name: Upload Playwright report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/web/playwright-report
          retention-days: 7
```

- [ ] **Step 4: Run test to verify it passes**

Localmente (com Mailpit rodando em `localhost:1025`/`8025`, ou pulando os e2e que dependem de email):

```bash
cd /root/rodrigo/hope_saude/apps/web && grep -n "webServer" playwright.config.ts && npx playwright test test/navbar.e2e.spec.ts --reporter=line 2>&1 | tail -15
```

Esperado: `webServer` presente; o Playwright sobe API+Web automaticamente e o teste roda sem ECONNREFUSED. No CI, o job `e2e` aparece verde no GitHub Actions.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/playwright.config.ts .github/workflows/ci.yml && git commit -m "ci: job e2e com Playwright webServer (API+Web+Mailpit) dirigível no CI"
```

---

## Self-Review

**Cobertura dos gaps do escopo (1 a 6):**

1. **Integração DB real (createConfirmedAppointment/createPendingCheckout + conflito de slot):** Task 1 (helper `test-prisma` com `datasourceUrl` — necessário porque `schema.prisma` hardcoda `file:./dev.db`) + Task 2 (spec de integração validando `price` Float, `durationMinutes` default, e a colisão `P2002` de `asaasPaymentId @unique`). Pega drift de schema. Continua válido pós-PostgreSQL trocando só a URL.
2. **Spec do clinical-scale.controller (único órfão):** Task 3 cobre RBAC DOCTOR cria / PATIENT Forbidden / PATIENT só vê próprio id / DOCTOR filtra por `doctorId` / `findOne` só DOCTOR / caminho público por token. `req.user` fiel ao `AuthenticatedUser` (`{ userId, role }`).
3. **Playwright no CI:** Task 8 adiciona `webServer` (sobe API via `GET /health` e Web) + job `e2e` com service container Mailpit, migrate deploy do DB e build de API/Web. Pré-requisito de scripts `npm run start` documentado para ajuste.
4. **Robustez — setTimeout fixo e snapshots:** Task 4 troca os dois `setTimeout(r, 500)` (linhas 82 e 132 do `notifications-auth.e2e`) por `pollUntil`. Sobre snapshots de templates reset/verify: **já existem** (`password-reset.spec.tsx`/`email-verification.spec.tsx` com `toMatchSnapshot()` + arquivos `.snap` em `__snapshots__/`) — confirmado, então não há gap a criar; o ganho de robustez foca no polling.
5. **Worker leak (cron @nestjs/schedule / Prisma sem $disconnect):** Task 5 reproduz com `--detectOpenHandles`, garante `app.close()` em todos os e2e (dispara `onModuleDestroy → $disconnect` e para o `SchedulerRegistry` do `ScheduleModule.forRoot()` usado por `PaymentCronService @Cron`). Explicitamente **proíbe** `forceExit` como cura.
6. **timing-mitigation + SkipThrottle:** Task 6 faz `validateUser` comparar contra `DUMMY_PASSWORD_HASH` quando o usuário não existe (anti user-enumeration), com teste contando `bcrypt.compare`. Task 7 remove `@SkipThrottle()` do `getPublic` (anti brute-force de token), verificando via `Reflector`/`THROTTLER_SKIP`.

**Ordenação:** helper (1) → integração que o usa (2); specs sem mudança de produção (3) cedo; robustez de teste (4,5); correções de produção com TDD vermelho real (6 timing, 7 throttle); CI por último (8), pois depende dos artefatos estabilizados.

**Ausência de placeholders:** todos os passos de código trazem blocos completos (specs, helper, edits literais de `validateUser`/`getPublic`, YAML do job e `webServer`). Tipos/métodos referenciados existem no repo (`AppointmentService`, `ClinicalScaleService`, `AuthenticatedRequest`, `PrismaService`, `bcryptjs.hashSync/compare`, `THROTTLER_SKIP`) ou são definidos nas Tasks (`createTestPrisma`, `pollUntil`). Nenhum "TODO"/"similar à Task N"/"validação apropriada".

**Pontos que exigem confirmação humana (assunções):** (a) nomes reais dos scripts `npm run start`/`start:prod` por workspace para o `webServer`; (b) existência de `apps/web` ter Next.js servível em `:3001` e a API em `:3000` no CI; (c) caminho exato de `THROTTLER_SKIP` no build do `@nestjs/throttler` instalado (subpath `dist/throttler.constants`) — se mudar, importar de `@nestjs/throttler` diretamente.
