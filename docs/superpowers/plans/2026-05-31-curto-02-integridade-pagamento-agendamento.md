# Integridade Transacional de Pagamento & Anti Double-Booking (Curto Prazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar consultas duplicadas e double-booking garantindo que confirmação de pagamento crie a consulta e remova o checkout pendente de forma atômica, com unicidade de `paymentId` e de slot por médico no banco, e validação fail-fast de dados de checkout (modelo de consulta inexistente, data no passado, conflito de horário) antes de cobrar o paciente.

**Architecture:** No curto prazo o SQLite recebe dois `@unique`/`@@unique` em `Appointment` (`paymentId` e `[doctorId, date]`) que viram a garantia de última instância contra duplicidade; `createConfirmedAppointment` + `deletePendingCheckout` passam a rodar dentro de `$transaction` (mesmo padrão de `medical-record.service.ts:162`), tratando `P2002` como no-op idempotente para que cron e `confirmPayment` concorrentes não criem duplicatas nem quebrem o lote. A checagem de colisão de slot (Appointment + PendingCheckout sobrepondo `[date, date+duration)`) entra ANTES da cobrança no `processCheckout`, abortando com `ConflictException`. `CheckoutDto` ganha validador custom de data futura e o modelo de consulta inexistente vira `BadRequestException` em vez de cair em default silencioso 60min/R$150.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite, `provider = "sqlite"`, `url = "file:./dev.db"`), Jest (ts-jest, isolatedModules), class-validator, `@nestjs/schedule`, `PrismaExceptionFilter` (P2025→404, P2002→409, P2003→400).

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma` | Adiciona `@unique` em `Appointment.paymentId` e `@@unique([doctorId, date])` |
| Create | `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<ts>_add_appointment_paymentid_unique/migration.sql` | Migration gerada por `prisma migrate dev` (paymentId unique) |
| Create | `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<ts>_add_appointment_doctor_date_unique/migration.sql` | Migration gerada por `prisma migrate dev` (doctorId+date unique) |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts` | `confirmAndConsumeCheckout` atômico ($transaction + P2002 no-op); `findOverlappingForDoctor` para anti double-booking |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts` | Testes unitários dos novos métodos |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.ts` | Conflito de slot + modelo inexistente → exceção; usa `confirmAndConsumeCheckout` |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.spec.ts` | Testes de colisão, modelo inexistente e confirmação atômica |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.ts` | Usa `confirmAndConsumeCheckout`; guarda de reentrância `isRunning`; Asaas indisponível não derruba o lote |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts` | Testes de reentrância, Asaas falho e confirmação atômica |
| Create | `/root/rodrigo/hope_saude/apps/api/src/payment/dto/is-future-date.validator.ts` | Validador class-validator custom `@IsFutureDate()` |
| Create | `/root/rodrigo/hope_saude/apps/api/src/payment/dto/is-future-date.validator.spec.ts` | Testes unitários do validador |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/payment/dto/checkout.dto.ts` | Aplica `@IsFutureDate()` em `date` |

---

## Tasks

### Task 1 — `@unique` em `Appointment.paymentId` (migration)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Create: `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<ts>_add_appointment_paymentid_unique/migration.sql`

Contexto: `paymentId` é `String?` (nullable). No SQLite, índice UNIQUE trata cada `NULL` como distinto, então múltiplas linhas com `paymentId = NULL` continuam permitidas — exatamente o que queremos (consultas legadas/manuais sem pagamento). O `@unique` só barra dois Appointments com o MESMO `paymentId` não-nulo, que é o cenário de duplicata do cron+confirmPayment.

- [ ] **Step 1: Escrever a migration falha primeiro (verificar que o schema ainda NÃO tem o unique)**

  Antes de editar, confirme o estado atual (deve mostrar `paymentId String?` SEM `@unique`):

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && grep -n "paymentId" prisma/schema.prisma
  ```

  Saída esperada (linha do model Appointment, sem `@unique`):

  ```
  76:  paymentId           String?
  ```

- [ ] **Step 2: Editar o schema adicionando `@unique` em `paymentId`**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, no model `Appointment`, trocar:

  ```prisma
  paymentId           String?
  ```

  por:

  ```prisma
  paymentId           String?  @unique
  ```

- [ ] **Step 3: Gerar a migration**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add-appointment-paymentid-unique
  ```

  Saída esperada: cria `prisma/migrations/<ts>_add_appointment_paymentid_unique/migration.sql` contendo
  `CREATE UNIQUE INDEX "Appointment_paymentId_key" ON "Appointment"("paymentId");`
  e imprime `Your database is now in sync with your schema.` / `Generated Prisma Client`.

- [ ] **Step 4: Verificar a migration aplicada e o índice criado**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && cat prisma/migrations/*add-appointment-paymentid-unique*/migration.sql 2>/dev/null || cat prisma/migrations/*add_appointment_paymentid_unique*/migration.sql
  ```

  Saída esperada: contém a linha `CREATE UNIQUE INDEX "Appointment_paymentId_key" ON "Appointment"("paymentId");`.

  Rodar a suíte existente do appointment para garantir que nada quebrou:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Tests: ... passed`, `Test Suites: 1 passed`.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add prisma/schema.prisma "prisma/migrations" && git commit -m "feat(api): @unique em Appointment.paymentId para barrar consulta duplicada por pagamento"
  ```

---

### Task 2 — Confirmação atômica (`$transaction`) com P2002 no-op idempotente

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`

Contexto: hoje `createConfirmedAppointment` + `deletePendingCheckout` são duas chamadas separadas (cron e `confirmPayment`). Se o processo morre entre as duas, o checkout fica órfão e o próximo tick recria a consulta — agora barrado pelo `@unique` da Task 1, mas estourando `P2002` não tratado. Vamos encapsular as duas operações numa transação e tratar `P2002` (paymentId já existe) como sucesso idempotente: a consulta já foi criada num tick anterior, então só removemos o checkout.

- [ ] **Step 1: Escrever o teste falho**

  Adicionar ao `describe('AppointmentService', ...)` em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`. Primeiro, ampliar o mock do `PrismaService` no `beforeEach` para incluir `$transaction` e `appointment.create`/`pendingCheckout.delete` acessíveis pelo `tx`. Trocar o bloco `useValue` do `PrismaService` por:

  ```ts
        {
          provide: PrismaService,
          useValue: {
            appointment: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
            pendingCheckout: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
  ```

  Depois adicionar os testes (antes do fechamento do `describe`):

  ```ts
  it('confirma e consome checkout dentro de uma transação (cria consulta + apaga pendência)', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    const tx = {
      appointment: { create: jest.fn().mockResolvedValue({ id: 99 }) },
      pendingCheckout: { delete: jest.fn().mockResolvedValue({ id: 5 }) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );

    await service.confirmAndConsumeCheckout({
      pendingCheckoutId: 5,
      patientId: 10,
      doctorId: 20,
      date,
      paymentId: 'pay_111',
      consultationModelId: 7,
      durationMinutes: 45,
      price: 200,
    });

    expect(tx.appointment.create).toHaveBeenCalledWith({
      data: {
        patientId: 10,
        doctorId: 20,
        date,
        status: 'CONFIRMED',
        paymentId: 'pay_111',
        consultationModelId: 7,
        durationMinutes: 45,
        price: 200,
      },
    });
    expect(tx.pendingCheckout.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });

  it('trata P2002 (paymentId duplicado) como no-op idempotente removendo só a pendência', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['paymentId'] },
    });
    const tx = {
      appointment: { create: jest.fn().mockRejectedValue(p2002) },
      pendingCheckout: { delete: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
    );
    (prisma.pendingCheckout.delete as jest.Mock).mockResolvedValue({ id: 6 });

    await expect(
      service.confirmAndConsumeCheckout({
        pendingCheckoutId: 6,
        patientId: 10,
        doctorId: 20,
        date,
        paymentId: 'pay_dup',
      }),
    ).resolves.toEqual({ alreadyConfirmed: true });

    expect(prisma.pendingCheckout.delete).toHaveBeenCalledWith({ where: { id: 6 } });
  });
  ```

  E garantir o import do `Prisma` no topo do arquivo de teste (logo após os imports existentes):

  ```ts
  import { Prisma } from '@prisma/client';
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: falha de compilação/execução do tipo `service.confirmAndConsumeCheckout is not a function` (método ainda não existe).

- [ ] **Step 3: Implementar o método mínimo**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`, adicionar o import do `Prisma` e o método. Trocar o import existente:

  ```ts
  import { Injectable } from '@nestjs/common';
  import { PrismaService } from '../prisma.service';
  ```

  por:

  ```ts
  import { Injectable } from '@nestjs/common';
  import { Prisma } from '@prisma/client';
  import { PrismaService } from '../prisma.service';
  ```

  E adicionar o método dentro da classe (após `createConfirmedAppointment`):

  ```ts
  /**
   * Cria a consulta CONFIRMED e remove a pendência numa única transação.
   * O @unique de paymentId garante que ticks concorrentes não dupliquem:
   * se P2002 ocorrer, a consulta já existe (tick anterior) — apenas limpamos
   * a pendência órfã e tratamos como sucesso idempotente.
   */
  async confirmAndConsumeCheckout(data: {
    pendingCheckoutId: number;
    patientId: number;
    doctorId: number;
    date: Date;
    paymentId: string;
    consultationModelId?: number;
    durationMinutes?: number;
    price?: number;
  }): Promise<{ alreadyConfirmed: boolean }> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.appointment.create({
          data: {
            patientId: data.patientId,
            doctorId: data.doctorId,
            date: data.date,
            status: 'CONFIRMED',
            paymentId: data.paymentId,
            consultationModelId: data.consultationModelId,
            durationMinutes: data.durationMinutes ?? 60,
            price: data.price ?? 150.0,
          },
        });
        await tx.pendingCheckout.delete({ where: { id: data.pendingCheckoutId } });
      });
      return { alreadyConfirmed: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await this.prisma.pendingCheckout.delete({ where: { id: data.pendingCheckoutId } });
        return { alreadyConfirmed: true };
      }
      throw err;
    }
  }
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Tests: ... passed`, `Test Suites: 1 passed` (inclui os 2 novos casos).

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/appointment/appointment.service.ts src/appointment/appointment.service.spec.ts && git commit -m "feat(api): confirmAndConsumeCheckout atômico com P2002 idempotente"
  ```

---

### Task 3 — Cron usa confirmação atômica, guarda de reentrância e tolera Asaas indisponível

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts`

Contexto: o cron roda a cada 15min (`@Cron('*/15 * * * *')`). Sem guarda, um tick lento que ainda processa quando o próximo dispara causa double-processing. Trocamos as duas chamadas separadas pelo `confirmAndConsumeCheckout` atômico e adicionamos a flag `isRunning`. O `try/catch` por linha já existe — preservamos para que um Asaas fora do ar num pagamento não derrube o lote inteiro.

- [ ] **Step 1: Escrever o teste falho**

  Em `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.spec.ts`, no `beforeEach`, trocar o mock do `AppointmentService` para expor o novo método:

  ```ts
        {
          provide: AppointmentService,
          useValue: {
            findPendingCheckouts: jest.fn(),
            confirmAndConsumeCheckout: jest.fn(),
          },
        },
  ```

  Substituir o teste `'should create confirmed appointment and remove pending checkout when payment received'` por uma versão que casa com a nova assinatura e adicionar os casos de reentrância e Asaas falho:

  ```ts
  it('confirma via confirmAndConsumeCheckout quando pagamento RECEIVED e ignora PENDING', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    (appointmentService.findPendingCheckouts as jest.Mock).mockResolvedValue([
      { id: 1, patientId: 10, doctorId: 20, date, asaasPaymentId: 'pay_111', durationMinutes: 60, price: 150 },
      { id: 2, patientId: 11, doctorId: 21, date, asaasPaymentId: 'pay_222', durationMinutes: 60, price: 150 },
    ]);
    (asaasService.getPaymentStatus as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'pay_111') return { status: 'RECEIVED' };
      return { status: 'PENDING' };
    });
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: false,
    });

    await service.handleCron();

    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledTimes(1);
    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith({
      pendingCheckoutId: 1,
      patientId: 10,
      doctorId: 20,
      date,
      paymentId: 'pay_111',
      consultationModelId: undefined,
      durationMinutes: 60,
      price: 150,
    });
  });

  it('não reprocessa o lote se já houver um tick em execução (guarda de reentrância)', async () => {
    let release!: () => void;
    (appointmentService.findPendingCheckouts as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = service.handleCron();
    const second = service.handleCron();
    await second; // retorna de imediato sem chamar findPendingCheckouts de novo
    release();
    await first;

    expect(appointmentService.findPendingCheckouts).toHaveBeenCalledTimes(1);
  });

  it('Asaas indisponível num pagamento não derruba o restante do lote', async () => {
    const date = new Date('2026-07-01T10:00:00Z');
    (appointmentService.findPendingCheckouts as jest.Mock).mockResolvedValue([
      { id: 1, patientId: 10, doctorId: 20, date, asaasPaymentId: 'pay_down', durationMinutes: 60, price: 150 },
      { id: 2, patientId: 11, doctorId: 21, date, asaasPaymentId: 'pay_ok', durationMinutes: 60, price: 150 },
    ]);
    (asaasService.getPaymentStatus as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'pay_down') throw new Error('Asaas timeout');
      return { status: 'RECEIVED' };
    });
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: false,
    });

    await expect(service.handleCron()).resolves.toBeUndefined();

    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledTimes(1);
    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay_ok' }),
    );
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.cron.service.spec.ts --no-coverage
  ```

  Saída esperada: falhas do tipo `expect(...).toHaveBeenCalledWith(...)` em `confirmAndConsumeCheckout` (ainda não chamado) e `findPendingCheckouts` chamado 2x na guarda de reentrância.

- [ ] **Step 3: Implementar o cron**

  Substituir o conteúdo de `/root/rodrigo/hope_saude/apps/api/src/payment/payment.cron.service.ts` por:

  ```ts
  import { Injectable, Logger } from '@nestjs/common';
  import { Cron } from '@nestjs/schedule';
  import { AsaasService } from './asaas.service';
  import { AppointmentService } from '../appointment/appointment.service';

  @Injectable()
  export class PaymentCronService {
    private readonly logger = new Logger(PaymentCronService.name);
    private isRunning = false;

    constructor(
      private asaasService: AsaasService,
      private appointmentService: AppointmentService,
    ) {}

    @Cron('*/15 * * * *')
    async handleCron() {
      if (this.isRunning) {
        this.logger.warn('Tick anterior ainda em execução — pulando este ciclo.');
        return;
      }
      this.isRunning = true;
      try {
        this.logger.log('Verificando pagamentos Asaas pendentes (checkout sem consulta ainda)...');

        const pending = await this.appointmentService.findPendingCheckouts();

        if (!pending || pending.length === 0) {
          this.logger.log('Nenhum checkout pendente.');
          return;
        }

        for (const row of pending) {
          try {
            const paymentStatus = await this.asaasService.getPaymentStatus(row.asaasPaymentId);

            if (paymentStatus.status === 'RECEIVED' || paymentStatus.status === 'CONFIRMED') {
              await this.appointmentService.confirmAndConsumeCheckout({
                pendingCheckoutId: row.id,
                patientId: row.patientId,
                doctorId: row.doctorId,
                date: row.date,
                paymentId: row.asaasPaymentId,
                consultationModelId: row.consultationModelId || undefined,
                durationMinutes: row.durationMinutes,
                price: row.price,
              });
              this.logger.log(`Consulta criada e confirmada após pagamento (checkout ${row.id})`);
            }
          } catch (error) {
            this.logger.error(`Erro ao checar pagamento ${row.asaasPaymentId}`, error);
          }
        }
        this.logger.log('Verificação de pagamentos concluída.');
      } finally {
        this.isRunning = false;
      }
    }
  }
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.cron.service.spec.ts --no-coverage
  ```

  Saída esperada: `Tests: ... passed`, `Test Suites: 1 passed`.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/payment/payment.cron.service.ts src/payment/payment.cron.service.spec.ts && git commit -m "feat(api): cron usa confirmação atômica, guarda de reentrância e tolera Asaas indisponível"
  ```

---

### Task 4 — `confirmPayment` usa confirmação atômica

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.spec.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.spec.ts`

Contexto: `confirmPayment` hoje chama `createConfirmedAppointment` + `deletePendingCheckout` separados (mesmo risco do cron). Migramos para `confirmAndConsumeCheckout` para igualar a garantia atômica/idempotente.

- [ ] **Step 1: Escrever o teste falho**

  Em `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.spec.ts`, no `beforeEach`, ampliar o mock do `AppointmentService` adicionando `confirmAndConsumeCheckout`:

  ```ts
        {
          provide: AppointmentService,
          useValue: {
            createPendingCheckout: jest.fn(),
            findPendingCheckoutByPatientAndPayment: jest.fn(),
            createConfirmedAppointment: jest.fn(),
            deletePendingCheckout: jest.fn(),
            confirmAndConsumeCheckout: jest.fn(),
          },
        },
  ```

  Substituir o teste `'should confirm payment manual, creating appointment and deleting pending'` por:

  ```ts
  it('should confirm payment manual via confirmAndConsumeCheckout (atômico)', async () => {
    const pending = {
      id: 55,
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-04-03T10:00:00Z'),
      asaasPaymentId: 'pay_manual_123',
      price: 200,
      durationMinutes: 45,
      consultationModelId: 10,
    };
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(
      pending,
    );
    (asaasService.receiveInSandbox as jest.Mock).mockResolvedValue({ id: 'pay_manual_123' });
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: false,
    });

    const result = await service.confirmPayment(1, 'pay_manual_123');

    expect(asaasService.receiveInSandbox).toHaveBeenCalledWith('pay_manual_123');
    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith({
      pendingCheckoutId: 55,
      patientId: 1,
      doctorId: 2,
      date: pending.date,
      paymentId: 'pay_manual_123',
      consultationModelId: 10,
      durationMinutes: 45,
      price: 200,
    });
    expect(result).toEqual({ success: true });
  });
  ```

  E substituir o teste `'should confirm payment manual even if Asaas Sandbox fails (maybe already received)'` por:

  ```ts
  it('confirma mesmo se Asaas Sandbox falhar (talvez já recebido), via método atômico', async () => {
    const pending = {
      id: 56,
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-04-03T10:00:00Z'),
      asaasPaymentId: 'pay_manual_fail',
      price: 200,
      durationMinutes: 45,
      consultationModelId: null,
    };
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(
      pending,
    );
    (asaasService.receiveInSandbox as jest.Mock).mockRejectedValue(new Error('Already received'));
    (appointmentService.confirmAndConsumeCheckout as jest.Mock).mockResolvedValue({
      alreadyConfirmed: true,
    });

    const result = await service.confirmPayment(1, 'pay_manual_fail');

    expect(appointmentService.confirmAndConsumeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ pendingCheckoutId: 56, paymentId: 'pay_manual_fail' }),
    );
    expect(result).toEqual({ success: true });
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.service.spec.ts --no-coverage
  ```

  Saída esperada: falha em `confirmAndConsumeCheckout` não chamado (`confirmPayment` ainda usa os métodos antigos).

- [ ] **Step 3: Implementar**

  Em `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.ts`, no método `confirmPayment`, substituir o bloco:

  ```ts
      // Cria consulta e remove pendência (mesma lógica do cron)
      await this.appointmentService.createConfirmedAppointment({
        patientId: pending.patientId,
        doctorId: pending.doctorId,
        date: pending.date,
        paymentId: pending.asaasPaymentId,
        consultationModelId: pending.consultationModelId || undefined,
        durationMinutes: pending.durationMinutes,
        price: pending.price,
      });
      await this.appointmentService.deletePendingCheckout(pending.id);

      return { success: true };
  ```

  por:

  ```ts
      // Cria consulta e remove pendência atomicamente (mesma lógica do cron)
      await this.appointmentService.confirmAndConsumeCheckout({
        pendingCheckoutId: pending.id,
        patientId: pending.patientId,
        doctorId: pending.doctorId,
        date: pending.date,
        paymentId: pending.asaasPaymentId,
        consultationModelId: pending.consultationModelId || undefined,
        durationMinutes: pending.durationMinutes,
        price: pending.price,
      });

      return { success: true };
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Tests: ... passed`, `Test Suites: 1 passed`.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/payment/payment.service.ts src/payment/payment.service.spec.ts && git commit -m "feat(api): confirmPayment usa confirmação atômica de checkout"
  ```

---

### Task 5 — `@@unique([doctorId, date])` em Appointment (migration) + P2003/P2002 já mapeados → 409

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Create: `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<ts>_add_appointment_doctor_date_unique/migration.sql`

Contexto: garantia de última instância contra dois Appointments do MESMO médico no MESMO instante de início. **Limitação conhecida e documentada:** `@@unique([doctorId, date])` só barra colisão de início EXATO; sobreposição parcial (ex.: 10:00–11:00 vs 10:30–11:30) NÃO é coberta pelo índice — essa é a razão da checagem de intervalo `[date, date+duration)` na Task 6, que roda no app antes de cobrar. O índice é a rede de segurança contra corrida concorrente no mesmo horário; a checagem de intervalo é a defesa funcional. O `PrismaExceptionFilter` já mapeia `P2002 → 409 Conflict`, então a violação do índice retorna 409 automaticamente no fluxo HTTP.

- [ ] **Step 1: Confirmar estado atual (sem `@@unique`)**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && grep -n "@@index\|@@unique" prisma/schema.prisma | grep -i appointment
  ```

  Saída esperada (apenas índices, nenhum `@@unique` em Appointment):

  ```
  86:  @@index([doctorId, date])
  87:  @@index([patientId, date])
  88:  @@index([date])
  ```

- [ ] **Step 2: Editar o schema adicionando `@@unique([doctorId, date])`**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, no model `Appointment`, logo após `@@index([doctorId, date])`, adicionar a linha `@@unique([doctorId, date])`. O bloco final do model deve ficar:

  ```prisma
    @@unique([doctorId, date])
    @@index([doctorId, date])
    @@index([patientId, date])
    @@index([date])
  ```

- [ ] **Step 3: Gerar a migration**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add-appointment-doctor-date-unique
  ```

  Saída esperada: cria `prisma/migrations/<ts>_add_appointment_doctor_date_unique/migration.sql` com
  `CREATE UNIQUE INDEX "Appointment_doctorId_date_key" ON "Appointment"("doctorId", "date");`
  e imprime `Your database is now in sync with your schema.`.

- [ ] **Step 4: Verificar índice e suíte**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && cat prisma/migrations/*add_appointment_doctor_date_unique*/migration.sql && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: o SQL contém `CREATE UNIQUE INDEX "Appointment_doctorId_date_key"`; testes `passed`.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add prisma/schema.prisma "prisma/migrations" && git commit -m "feat(api): @@unique([doctorId,date]) como rede de segurança anti double-booking"
  ```

---

### Task 6 — Checagem de conflito de slot ANTES de cobrar + modelo de consulta inexistente → BadRequest

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.spec.ts`

Contexto: hoje `processCheckout` cobra no Asaas e cria o `PendingCheckout` SEM checar se o slot já está ocupado — dois pacientes podem pagar o mesmo horário. Adicionamos `findOverlappingForDoctor` no `AppointmentService` (reaproveitando `findAppointmentsForDoctorInRange` + `findPendingCheckoutsForDoctorInRange` e o `intervalsOverlap` de `weekly-availability.ts`) e chamamos ANTES de cobrar, abortando com `ConflictException` (409). No mesmo passo, corrigimos o default silencioso: hoje `processCheckout` (linhas 60-71) ignora um `consultationModelId` inexistente e cai em 60min/R$150 — vamos lançar `BadRequestException`.

- [ ] **Step 1: Escrever o teste falho do AppointmentService**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`, no `beforeEach`, garantir que o mock do `PrismaService` tenha `appointment.findMany` e `pendingCheckout.findMany` (já têm). Adicionar o teste:

  ```ts
  it('detecta sobreposição de slot somando Appointments e PendingCheckouts do médico', async () => {
    const start = new Date('2026-07-01T10:00:00Z'); // novo slot 10:00–11:00
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
      { date: new Date('2026-07-01T10:30:00Z'), durationMinutes: 60 }, // colide 10:30–11:30
    ]);
    (prisma.pendingCheckout.findMany as jest.Mock).mockResolvedValue([]);

    const overlap = await service.findOverlappingForDoctor(20, start, 60);

    expect(overlap).toBe(true);
  });

  it('retorna false quando não há sobreposição (slots adjacentes)', async () => {
    const start = new Date('2026-07-01T11:00:00Z'); // 11:00–12:00
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
      { date: new Date('2026-07-01T10:00:00Z'), durationMinutes: 60 }, // 10:00–11:00, fim exclusivo
    ]);
    (prisma.pendingCheckout.findMany as jest.Mock).mockResolvedValue([]);

    const overlap = await service.findOverlappingForDoctor(20, start, 60);

    expect(overlap).toBe(false);
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `service.findOverlappingForDoctor is not a function`.

- [ ] **Step 3: Implementar `findOverlappingForDoctor`**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`, adicionar o import do helper e o método. Trocar os imports para incluir `intervalsOverlap`:

  ```ts
  import { Injectable } from '@nestjs/common';
  import { Prisma } from '@prisma/client';
  import { PrismaService } from '../prisma.service';
  import { intervalsOverlap } from '../availability/weekly-availability';
  ```

  Adicionar o método (após `findPendingCheckoutsForDoctorInRange`):

  ```ts
  /**
   * Verifica se o intervalo [date, date+durationMinutes) colide com qualquer
   * Appointment ou PendingCheckout existente do médico. Janela de busca alargada
   * (±1 dia) cobre durações longas sem varrer a tabela inteira. Fim exclusivo,
   * igual ao subtractBusyFromCandidates da disponibilidade.
   */
  async findOverlappingForDoctor(
    doctorId: number,
    date: Date,
    durationMinutes: number,
  ): Promise<boolean> {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const from = new Date(date.getTime() - oneDayMs);
    const to = new Date(date.getTime() + oneDayMs);

    const [appointments, pendingCheckouts] = await Promise.all([
      this.findAppointmentsForDoctorInRange(doctorId, from, to),
      this.findPendingCheckoutsForDoctorInRange(doctorId, from, to),
    ]);

    const candidate = {
      startMs: date.getTime(),
      endMs: date.getTime() + durationMinutes * 60 * 1000,
    };

    const rows = [...appointments, ...pendingCheckouts];
    return rows.some((r) =>
      intervalsOverlap(candidate, {
        startMs: r.date.getTime(),
        endMs: r.date.getTime() + (r.durationMinutes || 60) * 60 * 1000,
      }),
    );
  }
  ```

- [ ] **Step 4: Rodar o teste do AppointmentService para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Tests: ... passed`, `Test Suites: 1 passed`.

- [ ] **Step 5: Escrever o teste falho do PaymentService (conflito + modelo inexistente)**

  Em `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.spec.ts`, no `beforeEach`, adicionar `findOverlappingForDoctor` ao mock do `AppointmentService` (junto dos métodos já presentes):

  ```ts
            findOverlappingForDoctor: jest.fn(),
  ```

  Como `processCheckout` passará a chamar `findOverlappingForDoctor`, os testes existentes de PIX/cartão precisam que ele resolva `false`. No topo dos testes de checkout bem-sucedidos (`'should fetch patient CPF...'` e `'should process credit card checkout without PIX'`), adicionar logo após o `mockResolvedValue` do `patientRepo.findByUserId`:

  ```ts
    (appointmentService.findOverlappingForDoctor as jest.Mock).mockResolvedValue(false);
  ```

  Adicionar import do `ConflictException`:

  ```ts
  import { BadRequestException, ConflictException } from '@nestjs/common';
  ```

  Adicionar os dois novos testes ao `describe`:

  ```ts
  it('aborta com ConflictException quando o slot do médico já está ocupado, sem cobrar', async () => {
    (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (appointmentService.findOverlappingForDoctor as jest.Mock).mockResolvedValue(true);

    const user = { userId: 7, name: 'João', email: 'joao@test.com', role: 'PATIENT' as const };

    await expect(
      service.processCheckout(user, { doctorId: 42, date: '2026-06-15T14:00:00.000Z' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(asaasService.createPayment).not.toHaveBeenCalled();
    expect(appointmentService.createPendingCheckout).not.toHaveBeenCalled();
  });

  it('rejeita consultationModelId inexistente com BadRequest em vez de default silencioso', async () => {
    (patientRepo.findByUserId as jest.Mock).mockResolvedValue({
      id: 1,
      userId: 7,
      cpf: '12345678909',
      phone: '11999999999',
      asaasCustomerId: 'cus_123',
    });
    (appointmentService.findOverlappingForDoctor as jest.Mock).mockResolvedValue(false);
    (doctorRepo.findByUserIdWithConsultationModels as jest.Mock).mockResolvedValue({
      consultationModels: [{ id: 1, price: 250, durationMinutes: 50 }],
    });

    const user = { userId: 7, name: 'João', email: 'joao@test.com', role: 'PATIENT' as const };

    await expect(
      service.processCheckout(user, {
        doctorId: 42,
        date: '2026-06-15T14:00:00.000Z',
        consultationModelId: 999,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(asaasService.createPayment).not.toHaveBeenCalled();
  });
  ```

- [ ] **Step 6: Rodar o teste do PaymentService para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.service.spec.ts --no-coverage
  ```

  Saída esperada: o teste de conflito falha (`createPayment` foi chamado) e o de modelo inexistente falha (não lança `BadRequestException`, cai no default).

- [ ] **Step 7: Implementar no PaymentService**

  Em `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.ts`, adicionar `ConflictException` ao import do `@nestjs/common`:

  ```ts
  import {
    Injectable,
    BadRequestException,
    ConflictException,
    NotFoundException,
    Logger,
  } from '@nestjs/common';
  ```

  Substituir o bloco de resolução de `value`/`durationMinutes` (linhas atuais 57-71) por uma versão que falha em modelo inexistente:

  ```ts
      let value = 150;
      let durationMinutes = 60;

      if (body.consultationModelId) {
        const doctorProfile = await this.doctorProfileRepo.findByUserIdWithConsultationModels(
          body.doctorId,
        );
        const model = doctorProfile?.consultationModels?.find(
          (m) => m.id === body.consultationModelId,
        );
        if (!model) {
          throw new BadRequestException('Modelo de consulta inválido para este médico');
        }
        value = model.price;
        durationMinutes = model.durationMinutes;
      }
  ```

  E, logo após resolver `durationMinutes` e ANTES de qualquer interação com o Asaas (antes de `const patientName = ...`), inserir a checagem de conflito:

  ```ts
      const overlapping = await this.appointmentService.findOverlappingForDoctor(
        Number(body.doctorId),
        new Date(body.date),
        durationMinutes,
      );
      if (overlapping) {
        throw new ConflictException('Este horário já está reservado para o médico');
      }
  ```

- [ ] **Step 8: Rodar ambas as suítes para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.service.spec.ts src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Test Suites: 2 passed`, todos os testes `passed`.

- [ ] **Step 9: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/appointment/appointment.service.ts src/appointment/appointment.service.spec.ts src/payment/payment.service.ts src/payment/payment.service.spec.ts && git commit -m "feat(api): anti double-booking no checkout e rejeição de modelo de consulta inexistente"
  ```

---

### Task 7 — Rejeitar data no passado no `CheckoutDto` (validador custom `@IsFutureDate`)

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/payment/dto/is-future-date.validator.ts`
- Create: `/root/rodrigo/hope_saude/apps/api/src/payment/dto/is-future-date.validator.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/dto/checkout.dto.ts`

Contexto: `CheckoutDto.date` só valida formato (`@IsDateString`). Um paciente pode tentar agendar uma consulta no passado. Criamos um validador class-validator custom `@IsFutureDate()` (não há nenhum no repo hoje, então criamos do zero) e aplicamos ao campo `date`.

- [ ] **Step 1: Escrever o teste falho do validador**

  Criar `/root/rodrigo/hope_saude/apps/api/src/payment/dto/is-future-date.validator.spec.ts`:

  ```ts
  import { validate } from 'class-validator';
  import { IsFutureDate } from './is-future-date.validator';

  class Sample {
    @IsFutureDate()
    date!: string;
  }

  describe('IsFutureDate', () => {
    it('aceita data ISO no futuro', async () => {
      const s = new Sample();
      s.date = new Date(Date.now() + 60_000).toISOString();
      const errors = await validate(s);
      expect(errors).toHaveLength(0);
    });

    it('rejeita data no passado', async () => {
      const s = new Sample();
      s.date = new Date(Date.now() - 60_000).toISOString();
      const errors = await validate(s);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isFutureDate).toBeDefined();
    });

    it('rejeita valor não-data', async () => {
      const s = new Sample();
      s.date = 'não é data';
      const errors = await validate(s);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isFutureDate).toBeDefined();
    });
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/dto/is-future-date.validator.spec.ts --no-coverage
  ```

  Saída esperada: erro de módulo não encontrado `Cannot find module './is-future-date.validator'`.

- [ ] **Step 3: Implementar o validador**

  Criar `/root/rodrigo/hope_saude/apps/api/src/payment/dto/is-future-date.validator.ts`:

  ```ts
  import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
  } from 'class-validator';

  @ValidatorConstraint({ name: 'isFutureDate', async: false })
  export class IsFutureDateConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
      if (typeof value !== 'string') {
        return false;
      }
      const ms = Date.parse(value);
      if (Number.isNaN(ms)) {
        return false;
      }
      return ms > Date.now();
    }

    defaultMessage(): string {
      return 'A data da consulta deve estar no futuro';
    }
  }

  export function IsFutureDate(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
      registerDecorator({
        name: 'isFutureDate',
        target: object.constructor,
        propertyName,
        options: validationOptions,
        validator: IsFutureDateConstraint,
      });
    };
  }
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/dto/is-future-date.validator.spec.ts --no-coverage
  ```

  Saída esperada: `Tests: 3 passed`, `Test Suites: 1 passed`.

- [ ] **Step 5: Aplicar `@IsFutureDate()` ao CheckoutDto e commit**

  Em `/root/rodrigo/hope_saude/apps/api/src/payment/dto/checkout.dto.ts`, adicionar o import:

  ```ts
  import { IsFutureDate } from './is-future-date.validator';
  ```

  E aplicar o decorator ao campo `date` (mantendo `@IsDateString`):

  ```ts
    @IsDateString()
    @IsFutureDate()
    date!: string;
  ```

  Rodar a suíte do DTO/checkout para garantir que o validador não quebra o checkout válido (os testes de PIX/cartão usam datas futuras `2026-06-15`):

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/dto/is-future-date.validator.spec.ts src/payment/payment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Test Suites: 2 passed`.

  Commit:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/payment/dto/is-future-date.validator.ts src/payment/dto/is-future-date.validator.spec.ts src/payment/dto/checkout.dto.ts && git commit -m "feat(api): rejeita data de consulta no passado no CheckoutDto"
  ```

---

### Task 8 — Verificação final da suíte

**Files:** nenhum (verificação).

- [ ] **Step 1: Rodar a suíte completa da API**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
  ```

  Saída esperada: todas as suítes verdes (≥ 241 testes / ≥ 42 suítes, agora com os novos casos somados). Nenhum `failed`.

- [ ] **Step 2: Type-check estrito (zero any de produção)**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit
  ```

  Saída esperada: sem erros (saída vazia, exit 0).

- [ ] **Step 3: Commit final (se houver ajuste de lint/format pendente)**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git status
  ```

  Se limpo, nada a fazer. Caso contrário, revisar `git diff` e commitar com mensagem explicando o ajuste.

---

## Self-Review

**Cobertura dos gaps do escopo:**

1. **Migration `@unique` em `Appointment.paymentId` (null múltiplo OK)** — Task 1. Documentado que SQLite trata cada `NULL` como distinto, então consultas sem pagamento não colidem; comando exato `npx prisma migrate dev --name add-appointment-paymentid-unique`.
2. **`$transaction` em createConfirmedAppointment+deletePendingCheckout (padrão `medical-record.service.ts:162`); cron e confirmPayment usam; P2002 no-op idempotente** — Task 2 (método `confirmAndConsumeCheckout` com `$transaction` e `Prisma.PrismaClientKnownRequestError`+`code==='P2002'`), consumido pelo cron na Task 3 e por `confirmPayment` na Task 4.
3. **Conflito de slot ANTES de cobrar no processCheckout; query Appointment+PendingCheckout sobrepondo `[date, date+duration)`; ConflictException 409; teste de colisão; limitação do `@@unique` documentada** — Task 6 (`findOverlappingForDoctor` reusa `findAppointmentsForDoctorInRange`/`findPendingCheckoutsForDoctorInRange` + `intervalsOverlap`), checagem antes de `createPayment`. Limitação de sobreposição parcial do índice documentada na Task 5.
4. **Migration `@@unique([doctorId,date])` + P2002→409 (filtro já mapeia)** — Task 5; `PrismaExceptionFilter` já traduz P2002→409, não precisa alteração no filtro.
5. **Validar consultationModelId inexistente → BadRequest (payment.service.ts:57-71) em vez de default silencioso** — Task 6, Step 7 (`if (!model) throw new BadRequestException(...)`).
6. **Rejeitar data no passado: CheckoutDto.date com validação custom de futuro** — Task 7 (`@IsFutureDate()`), com teste vermelho antes.
7. **Guarda de reentrância no cron (flag isRunning) + teste** — Task 3 (flag `isRunning` no `try/finally`, teste de dois ticks concorrentes).
8. **Testes de erro: Asaas indisponível em getPaymentStatus não derruba o lote; createConfirmedAppointment falhando** — Task 3 (teste "Asaas indisponível num pagamento não derruba o restante do lote", preservando o `try/catch` por linha). Falha de criação tratada via P2002 no-op (Task 2) e, para erros não-P2002, o `catch` por linha do cron loga e segue.

**Ausência de placeholders:** todos os passos de código contêm blocos reais e completos. Tipos/métodos referenciados (`confirmAndConsumeCheckout`, `findOverlappingForDoctor`, `IsFutureDate`/`IsFutureDateConstraint`) são definidos dentro deste plano; `intervalsOverlap`, `findAppointmentsForDoctorInRange`, `findPendingCheckoutsForDoctorInRange`, `Prisma.PrismaClientKnownRequestError`, `PrismaService.$transaction` e `PrismaExceptionFilter` já existem no repo (verificados na fase de Research). Comandos de teste seguem o padrão do projeto (`cd /root/rodrigo/hope_saude/apps/api && npx jest <arquivo> --no-coverage`). Ordem por dependência: migrations e método atômico primeiro (Tasks 1-2), consumidores depois (3-4), anti double-booking e validações (5-7), verificação final (8).
