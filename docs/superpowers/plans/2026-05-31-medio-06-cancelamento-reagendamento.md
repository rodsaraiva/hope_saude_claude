# Cancelamento e Reagendamento de Consulta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao paciente (e ao médico) um fluxo de saída para uma consulta já paga — cancelar com regra de antecedência e reagendar para outro horário disponível — fechando o gap de MVP em que o paciente paga e fica preso sem poder desmarcar.

**Architecture:** Reaproveitamos o estado já existente. `Appointment.status` ganha o valor `CANCELLED` (string, como hoje `CONFIRMED`) e três colunas novas (`cancelledAt`, `cancellationReason`, `cancelledBy`). `AppointmentService.cancel` valida ownership (paciente só a própria consulta; médico só a própria agenda), aplica a regra de antecedência (paciente cancela até 24h antes), é idempotente (recancelar é no-op) e roda a transição em `$transaction` — mesmo padrão atômico de `medical-record.service.ts` e do plano de integridade. Como o slot ocupado é derivado de linhas `Appointment`/`PendingCheckout` (ver `available-slots.service.ts:buildBusyIntervals`), marcar `CANCELLED` já libera o horário, contanto que `findOverlappingForDoctor` (criado no plano de integridade curto-02) e `getAvailableSlots` passem a ignorar canceladas. `reschedule` é cancelar-e-recriar: valida disponibilidade do novo slot com `findOverlappingForDoctor`, cancela a antiga e cria a nova `Appointment` reaproveitando o mesmo `paymentId` (mesma cobrança Asaas, sem novo checkout), tudo numa transação. Reembolso Asaas fica documentado como nota/sub-task: o cancelamento NÃO dispara estorno automático no MVP (decisão de negócio), apenas registra o motivo. Endpoints `POST /appointments/:id/cancel` e `POST /appointments/:id/reschedule` reusam o padrão de RBAC inline (`req.user.role`/`ForbiddenException`) já visto em `prescription.controller.ts`. No Web, `useCancelAppointment`/`useRescheduleAppointment` (TanStack Query mutation) invalidam `queryKeys.appointments.me` e o `UpcomingAppointmentsCard` ganha botão "Cancelar".

**Tech Stack:** NestJS 11 + Prisma 5 (SQLite, `file:./dev.db`) + Jest (ts-jest, isolatedModules) + class-validator + @nestjs/swagger; Next.js 15 App Router + React 19 + TanStack Query + Testing Library.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma` | Adiciona `cancelledAt`, `cancellationReason`, `cancelledBy` em `Appointment` |
| Create | `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<ts>_add_appointment_cancellation/migration.sql` | Migration SQLite das 3 colunas |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts` | `cancel()`, `reschedule()`, filtro de canceladas nas queries de range |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts` | Testes de antecedência, ownership, idempotência, reschedule, filtro de range |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.controller.ts` | Endpoints `POST :id/cancel` e `:id/reschedule` com RBAC inline |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.controller.spec.ts` | Testes dos dois endpoints (paciente, médico, role inválida) |
| Modify | `/root/rodrigo/hope_saude/apps/web/src/lib/doctor-dashboard-api.ts` | `cancelAppointment()`, `rescheduleAppointment()` |
| Create | `/root/rodrigo/hope_saude/apps/web/src/lib/query/use-cancel-appointment.ts` | Hooks `useCancelAppointment`, `useRescheduleAppointment` |
| Create | `/root/rodrigo/hope_saude/apps/web/src/lib/query/__tests__/use-cancel-appointment.test.tsx` | Testes dos hooks (mutação + invalidação) |
| Modify | `/root/rodrigo/hope_saude/apps/web/src/components/profile/UpcomingAppointmentsCard.tsx` | Botão "Cancelar" + callback `onCancel` |
| Create | `/root/rodrigo/hope_saude/apps/web/src/components/profile/__tests__/UpcomingAppointmentsCard.cancel.test.tsx` | Teste do botão Cancelar |

---

## Tasks

### Task 1 — Migration: colunas de cancelamento em `Appointment`

Adiciona o estado mínimo de cancelamento. `status` continua `String` e passa a aceitar `CANCELLED` (sem enum nativo — SQLite). `cancelledBy` guarda `'PATIENT' | 'DOCTOR'` como texto, alinhado a como `role` já é tratado no schema.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Create: `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<timestamp>_add_appointment_cancellation/migration.sql`
- Test: validação via `prisma migrate` + suíte existente do AppointmentService (Task 2)

- [ ] **Step 1: Editar o schema (mudança de modelo, validada pela migration no Step 2)**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, no model `Appointment`, logo após a linha `paymentId String?`, adicionar as três colunas e documentar o novo status:

  ```prisma
  model Appointment {
    id                  Int      @id @default(autoincrement())
    patientId           Int
    patient             User     @relation("PatientAppointments", fields: [patientId], references: [id])
    doctorId            Int
    doctor              User     @relation("DoctorAppointments", fields: [doctorId], references: [id])
    date                DateTime
    status              String   @default("CONFIRMED") // CONFIRMED ao persistir; COMPLETED; CANCELLED ao desmarcar/reagendar
    paymentId           String?
    cancelledAt         DateTime?
    cancellationReason  String?
    cancelledBy         String?  // 'PATIENT' | 'DOCTOR' (texto, igual ao padrão de role no SQLite)
    consultationModelId Int?
    durationMinutes     Int      @default(60)
    price               Float    @default(150.0)
    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt

    medicalRecord MedicalRecord?
    prescriptions Prescription[]

    @@index([doctorId, date])
    @@index([patientId, date])
    @@index([date])
  }
  ```

- [ ] **Step 2: Gerar a migration e ver o SQL produzido (este é o "teste vermelho→verde" do schema)**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add_appointment_cancellation --create-only
  ```

  Saída esperada: cria o diretório `prisma/migrations/<timestamp>_add_appointment_cancellation/` com `migration.sql`. O conteúdo deve ser equivalente a (SQLite `ALTER TABLE ADD COLUMN`, sem recriar a tabela porque todas são nullable):

  ```sql
  -- AlterTable
  ALTER TABLE "Appointment" ADD COLUMN "cancelledAt" DATETIME;
  ALTER TABLE "Appointment" ADD COLUMN "cancellationReason" TEXT;
  ALTER TABLE "Appointment" ADD COLUMN "cancelledBy" TEXT;
  ```

- [ ] **Step 3: Aplicar a migration e regenerar o client**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add_appointment_cancellation && npx prisma generate
  ```

  Saída esperada: `Your database is now in sync with your schema.` e `Generated Prisma Client`.

- [ ] **Step 4: Confirmar que a suíte atual continua verde após o client novo**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Test Suites: 1 passed`, todos os testes existentes passam (o client novo não quebrou nada).

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add prisma/schema.prisma prisma/migrations
  git commit -m "feat(api): colunas de cancelamento em Appointment (cancelledAt/Reason/By)"
  ```

---

### Task 2 — `AppointmentService.cancel`: ownership, antecedência, idempotência

Implementa o cancelamento. Regras: paciente só cancela a própria consulta e até 24h antes (`BadRequestException` se faltar menos); médico cancela qualquer consulta da própria agenda sem janela de antecedência; consulta inexistente → `NotFoundException`; consulta já `CANCELLED` → idempotente (retorna a linha sem novo write). A transição roda em `$transaction` (mesmo padrão atômico do projeto). Marcar `CANCELLED` já libera o slot porque a query de range passa a filtrar canceladas (Step 3).

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`

- [ ] **Step 1: Escrever os testes falhos**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`, ampliar o mock do `PrismaService` para cobrir `appointment.update`, `appointment.findFirst` e `$transaction`, e adicionar o bloco `describe('cancel')`. Substituir o `useValue` do `PrismaService` (linhas 13-24) por:

  ```ts
        {
          provide: PrismaService,
          useValue: {
            appointment: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            pendingCheckout: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn(async (cb: any) => cb({
              appointment: {
                findUnique: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
              },
            })),
          },
        },
  ```

  E, antes do `});` final do `describe('AppointmentService', ...)`, adicionar:

  ```ts
  describe('cancel', () => {
    const future = () => new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h à frente

    function mockTx(appointment: any) {
      const txUpdate = jest.fn().mockResolvedValue({ ...appointment, status: 'CANCELLED' });
      const txFindUnique = jest.fn().mockResolvedValue(appointment);
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
        cb({ appointment: { findUnique: txFindUnique, update: txUpdate, create: jest.fn() } }),
      );
      return { txUpdate, txFindUnique };
    }

    it('lança NotFoundException quando a consulta não existe', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.cancel(999, 1, 'PATIENT', 'desisti')).rejects.toThrow(
        'Consulta não encontrada',
      );
    });

    it('paciente não pode cancelar consulta de outro paciente (ForbiddenException)', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1, patientId: 7, doctorId: 2, date: future(), status: 'CONFIRMED', durationMinutes: 60,
      });
      await expect(service.cancel(1, 1, 'PATIENT', 'x')).rejects.toThrow(
        'Você não pode cancelar esta consulta',
      );
    });

    it('médico não pode cancelar consulta fora da própria agenda (ForbiddenException)', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1, patientId: 7, doctorId: 99, date: future(), status: 'CONFIRMED', durationMinutes: 60,
      });
      await expect(service.cancel(1, 2, 'DOCTOR', 'x')).rejects.toThrow(
        'Você não pode cancelar esta consulta',
      );
    });

    it('paciente é bloqueado quando faltam menos de 24h (BadRequestException)', async () => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h à frente
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1, patientId: 1, doctorId: 2, date: soon, status: 'CONFIRMED', durationMinutes: 60,
      });
      await expect(service.cancel(1, 1, 'PATIENT', 'x')).rejects.toThrow(
        'Cancelamento permitido até 24h antes da consulta',
      );
    });

    it('médico cancela mesmo com menos de 24h (sem janela de antecedência)', async () => {
      const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const appt = { id: 1, patientId: 7, doctorId: 2, date: soon, status: 'CONFIRMED', durationMinutes: 60 };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(appt);
      const { txUpdate } = mockTx(appt);
      const result = await service.cancel(1, 2, 'DOCTOR', 'imprevisto');
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancellationReason: 'imprevisto',
          cancelledBy: 'DOCTOR',
        },
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('paciente cancela com antecedência suficiente e marca CANCELLED em transação', async () => {
      const appt = { id: 1, patientId: 1, doctorId: 2, date: future(), status: 'CONFIRMED', durationMinutes: 60 };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(appt);
      const { txUpdate } = mockTx(appt);
      await service.cancel(1, 1, 'PATIENT', 'desisti');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancellationReason: 'desisti',
          cancelledBy: 'PATIENT',
        },
      });
    });

    it('é idempotente: cancelar consulta já CANCELLED não escreve de novo', async () => {
      const appt = { id: 1, patientId: 1, doctorId: 2, date: future(), status: 'CANCELLED', durationMinutes: 60 };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(appt);
      const result = await service.cancel(1, 1, 'PATIENT', 'de novo');
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: falha com `service.cancel is not a function`.

- [ ] **Step 3: Implementar `cancel` (e a constante de antecedência)**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`, trocar o import do topo (linha 1) para incluir as exceções:

  ```ts
  import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
  } from '@nestjs/common';
  ```

  Adicionar, logo abaixo dos imports, a constante de política:

  ```ts
  /** Antecedência mínima para o PACIENTE cancelar (médico não tem janela). */
  const PATIENT_CANCEL_MIN_LEAD_MS = 24 * 60 * 60 * 1000;
  ```

  E adicionar o método dentro da classe, após `findById` (linha 97):

  ```ts
    /**
     * Cancela a consulta. Paciente só cancela a própria e até 24h antes;
     * médico cancela qualquer uma da própria agenda, sem janela. Idempotente:
     * recancelar uma consulta já CANCELLED é no-op. A transição roda em
     * transação; marcar CANCELLED libera o slot (queries de range filtram canceladas).
     */
    async cancel(
      appointmentId: number,
      userId: number,
      role: 'PATIENT' | 'DOCTOR',
      reason?: string,
    ) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Consulta não encontrada');
      }

      const isOwner =
        role === 'PATIENT'
          ? appointment.patientId === userId
          : appointment.doctorId === userId;
      if (!isOwner) {
        throw new ForbiddenException('Você não pode cancelar esta consulta');
      }

      if (appointment.status === 'CANCELLED') {
        return appointment;
      }

      if (role === 'PATIENT') {
        const leadMs = appointment.date.getTime() - Date.now();
        if (leadMs < PATIENT_CANCEL_MIN_LEAD_MS) {
          throw new BadRequestException(
            'Cancelamento permitido até 24h antes da consulta',
          );
        }
      }

      return this.prisma.$transaction(async (tx) =>
        tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: reason ?? null,
            cancelledBy: role,
          },
        }),
      );
    }
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Test Suites: 1 passed`, todos os testes (antigos + `describe('cancel')`) verdes.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/appointment/appointment.service.ts src/appointment/appointment.service.spec.ts
  git commit -m "feat(api): AppointmentService.cancel com ownership, antecedência e idempotência"
  ```

---

### Task 3 — Filtrar consultas `CANCELLED` nas queries de range (libera o slot)

`getAvailableSlots` deriva os horários ocupados de `findAppointmentsForDoctorInRange`. Para o cancelamento efetivamente liberar o slot — e para `findOverlappingForDoctor` (do plano curto-02 de integridade) não contar uma consulta cancelada como conflito — as queries de range precisam excluir `status: 'CANCELLED'`.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`

- [ ] **Step 1: Escrever o teste falho**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`, substituir o teste `it('should list appointments do médico no intervalo de datas', ...)` (linhas 87-98) por uma versão que exige o filtro de canceladas:

  ```ts
    it('lista appointments do médico no intervalo, excluindo CANCELLED', async () => {
      const from = new Date('2026-04-01T00:00:00.000Z');
      const to = new Date('2026-04-30T23:59:59.999Z');
      await service.findAppointmentsForDoctorInRange(7, from, to);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          doctorId: 7,
          date: { gte: from, lte: to },
          status: { not: 'CANCELLED' },
        },
        orderBy: { date: 'asc' },
      });
    });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage -t "excluindo CANCELLED"
  ```

  Saída esperada: falha — o `where` chamado não inclui `status: { not: 'CANCELLED' }`.

- [ ] **Step 3: Implementar o filtro**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`, no método `findAppointmentsForDoctorInRange` (linhas 99-107), adicionar a cláusula de status:

  ```ts
    async findAppointmentsForDoctorInRange(doctorId: number, from: Date, to: Date) {
      return this.prisma.appointment.findMany({
        where: {
          doctorId,
          date: { gte: from, lte: to },
          status: { not: 'CANCELLED' },
        },
        orderBy: { date: 'asc' },
      });
    }
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Test Suites: 1 passed`, todos verdes.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/appointment/appointment.service.ts src/appointment/appointment.service.spec.ts
  git commit -m "fix(api): findAppointmentsForDoctorInRange ignora consultas CANCELLED (libera slot)"
  ```

---

### Task 4 — `AppointmentService.reschedule`: cancelar-e-recriar validando disponibilidade

Reagendar = cancelar a consulta atual e criar uma nova no novo horário, reaproveitando o mesmo `paymentId` (mesma cobrança Asaas — sem novo checkout no MVP). Antes de qualquer write, valida disponibilidade do novo slot com `findOverlappingForDoctor` (criado no plano curto-02 de integridade; ver `## Open Questions`). A antiga vira `CANCELLED` (`cancelledBy = role`, motivo `'RESCHEDULED'`) e a nova nasce `CONFIRMED` — tudo em `$transaction`.

**Reembolso Asaas (nota, fora do MVP):** o reschedule mantém o mesmo `paymentId`, então não há estorno nem nova cobrança. Um cancelamento puro (Task 2) também NÃO dispara `refund` automático — é decisão de negócio registrar o motivo e tratar estorno manualmente. Quando o estorno automático entrar (médio/longo prazo), o ponto de integração é `AsaasService.getPaymentStatus`/um novo `AsaasService.refundPayment(paymentId)` chamado dentro da transação de `cancel`, condicionado a NODE_ENV e à janela de antecedência.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`

- [ ] **Step 1: Escrever os testes falhos**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.spec.ts`, adicionar, antes do `});` final do `describe('AppointmentService', ...)`, o bloco:

  ```ts
  describe('reschedule', () => {
    const future = () => new Date(Date.now() + 72 * 60 * 60 * 1000);
    const newDate = () => new Date(Date.now() + 96 * 60 * 60 * 1000);

    it('lança NotFoundException quando a consulta não existe', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.reschedule(999, 1, 'PATIENT', newDate()),
      ).rejects.toThrow('Consulta não encontrada');
    });

    it('paciente não reagenda consulta de outro paciente (ForbiddenException)', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1, patientId: 7, doctorId: 2, date: future(), status: 'CONFIRMED',
        durationMinutes: 60, paymentId: 'pay_1', price: 150, consultationModelId: null,
      });
      await expect(
        service.reschedule(1, 1, 'PATIENT', newDate()),
      ).rejects.toThrow('Você não pode reagendar esta consulta');
    });

    it('aborta com ConflictException quando o novo slot já está ocupado', async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: 1, patientId: 1, doctorId: 2, date: future(), status: 'CONFIRMED',
        durationMinutes: 60, paymentId: 'pay_1', price: 150, consultationModelId: null,
      });
      jest.spyOn(service, 'findOverlappingForDoctor').mockResolvedValue(true);
      await expect(
        service.reschedule(1, 1, 'PATIENT', newDate()),
      ).rejects.toThrow('Este horário já está reservado para o médico');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cancela a antiga e cria a nova no mesmo paymentId, em transação', async () => {
      const target = newDate();
      const old = {
        id: 1, patientId: 1, doctorId: 2, date: future(), status: 'CONFIRMED',
        durationMinutes: 60, paymentId: 'pay_1', price: 150, consultationModelId: null,
      };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(old);
      jest.spyOn(service, 'findOverlappingForDoctor').mockResolvedValue(false);

      const txUpdate = jest.fn().mockResolvedValue({ ...old, status: 'CANCELLED' });
      const txCreate = jest.fn().mockResolvedValue({ id: 2, date: target, status: 'CONFIRMED' });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
        cb({ appointment: { update: txUpdate, create: txCreate, findUnique: jest.fn() } }),
      );

      const result = await service.reschedule(1, 1, 'PATIENT', target);

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancellationReason: 'RESCHEDULED',
          cancelledBy: 'PATIENT',
        },
      });
      expect(txCreate).toHaveBeenCalledWith({
        data: {
          patientId: 1,
          doctorId: 2,
          date: target,
          status: 'CONFIRMED',
          paymentId: 'pay_1',
          consultationModelId: null,
          durationMinutes: 60,
          price: 150,
        },
      });
      expect(result.id).toBe(2);
    });
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage -t "reschedule"
  ```

  Saída esperada: falha com `service.reschedule is not a function`.

- [ ] **Step 3: Implementar `reschedule`**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.service.ts`, adicionar `ConflictException` ao import do `@nestjs/common`:

  ```ts
  import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
  } from '@nestjs/common';
  ```

  E adicionar o método dentro da classe, logo após `cancel`:

  ```ts
    /**
     * Reagenda = cancela a consulta atual e cria uma nova no novo horário,
     * reaproveitando o mesmo paymentId (mesma cobrança Asaas, sem novo checkout).
     * Valida ownership e disponibilidade do novo slot ANTES de qualquer write.
     * Reembolso Asaas não é disparado no MVP (ver doc/Notas).
     */
    async reschedule(
      appointmentId: number,
      userId: number,
      role: 'PATIENT' | 'DOCTOR',
      newDate: Date,
    ) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Consulta não encontrada');
      }

      const isOwner =
        role === 'PATIENT'
          ? appointment.patientId === userId
          : appointment.doctorId === userId;
      if (!isOwner) {
        throw new ForbiddenException('Você não pode reagendar esta consulta');
      }

      const overlapping = await this.findOverlappingForDoctor(
        appointment.doctorId,
        newDate,
        appointment.durationMinutes,
      );
      if (overlapping) {
        throw new ConflictException('Este horário já está reservado para o médico');
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'RESCHEDULED',
            cancelledBy: role,
          },
        });
        return tx.appointment.create({
          data: {
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            date: newDate,
            status: 'CONFIRMED',
            paymentId: appointment.paymentId,
            consultationModelId: appointment.consultationModelId,
            durationMinutes: appointment.durationMinutes,
            price: appointment.price,
          },
        });
      });
    }
  ```

  Nota: este método depende de `findOverlappingForDoctor`, criado no plano `2026-05-31-curto-02-integridade-pagamento-agendamento.md` (Task 6). Se ele ainda não existir no repo, execute aquela task antes desta (ver `## Open Questions`).

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Test Suites: 1 passed`, todos verdes (cancel + reschedule + range).

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/appointment/appointment.service.ts src/appointment/appointment.service.spec.ts
  git commit -m "feat(api): AppointmentService.reschedule (cancela+recria validando slot)"
  ```

---

### Task 5 — Endpoints `POST /appointments/:id/cancel` e `:id/reschedule` com RBAC

Expõe os dois métodos. RBAC inline no padrão de `prescription.controller.ts` (sem `RolesGuard`, pois precisamos do `userId` E do `role` juntos): só `PATIENT`/`DOCTOR` podem agir; qualquer outra role → `ForbiddenException`. O `role` vem de `req.user.role`. `reschedule` valida `newDate` presente (`BadRequestException`).

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.controller.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.controller.spec.ts`

- [ ] **Step 1: Escrever os testes falhos**

  Em `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.controller.spec.ts`, ampliar o tipo mockado e o `useValue` para incluir `cancel`/`reschedule`, e adicionar os describes. Substituir o tipo (linhas 7-9) e o `useValue` (linhas 16-21):

  ```ts
    let appointmentService: jest.Mocked<
      Pick<
        AppointmentService,
        'getDoctorAppointments' | 'getPatientAppointments' | 'cancel' | 'reschedule'
      >
    >;
  ```

  ```ts
          useValue: {
            getDoctorAppointments: jest.fn(),
            getPatientAppointments: jest.fn(),
            cancel: jest.fn(),
            reschedule: jest.fn(),
          },
  ```

  E antes do `});` final do describe externo, adicionar:

  ```ts
  describe('cancel', () => {
    it('repassa role + userId + motivo para o service (PATIENT)', async () => {
      appointmentService.cancel.mockResolvedValue({ id: 1, status: 'CANCELLED' } as any);
      const result = await controller.cancel(
        { user: { userId: 20, role: 'PATIENT' } } as any,
        '1',
        { reason: 'desisti' },
      );
      expect(appointmentService.cancel).toHaveBeenCalledWith(1, 20, 'PATIENT', 'desisti');
      expect(result).toEqual({ id: 1, status: 'CANCELLED' });
    });

    it('repassa role DOCTOR', async () => {
      appointmentService.cancel.mockResolvedValue({ id: 1, status: 'CANCELLED' } as any);
      await controller.cancel(
        { user: { userId: 10, role: 'DOCTOR' } } as any,
        '1',
        {},
      );
      expect(appointmentService.cancel).toHaveBeenCalledWith(1, 10, 'DOCTOR', undefined);
    });

    it('rejeita role inválida com ForbiddenException', async () => {
      await expect(
        controller.cancel({ user: { userId: 1, role: 'ADMIN' } } as any, '1', {}),
      ).rejects.toThrow('Apenas pacientes e médicos podem cancelar consultas');
      expect(appointmentService.cancel).not.toHaveBeenCalled();
    });
  });

  describe('reschedule', () => {
    it('exige newDate (BadRequestException quando ausente)', async () => {
      await expect(
        controller.reschedule({ user: { userId: 20, role: 'PATIENT' } } as any, '1', {} as any),
      ).rejects.toThrow('newDate é obrigatório');
      expect(appointmentService.reschedule).not.toHaveBeenCalled();
    });

    it('repassa role + userId + nova data para o service', async () => {
      appointmentService.reschedule.mockResolvedValue({ id: 2, status: 'CONFIRMED' } as any);
      const result = await controller.reschedule(
        { user: { userId: 20, role: 'PATIENT' } } as any,
        '1',
        { newDate: '2026-07-01T10:00:00.000Z' },
      );
      expect(appointmentService.reschedule).toHaveBeenCalledWith(
        1,
        20,
        'PATIENT',
        new Date('2026-07-01T10:00:00.000Z'),
      );
      expect(result).toEqual({ id: 2, status: 'CONFIRMED' });
    });

    it('rejeita role inválida com ForbiddenException', async () => {
      await expect(
        controller.reschedule(
          { user: { userId: 1, role: 'ADMIN' } } as any,
          '1',
          { newDate: '2026-07-01T10:00:00.000Z' },
        ),
      ).rejects.toThrow('Apenas pacientes e médicos podem reagendar consultas');
    });
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.controller.spec.ts --no-coverage
  ```

  Saída esperada: falha com `controller.cancel is not a function`.

- [ ] **Step 3: Implementar os endpoints**

  Substituir o conteúdo de `/root/rodrigo/hope_saude/apps/api/src/appointment/appointment.controller.ts` por:

  ```ts
  import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    Request,
    ForbiddenException,
    BadRequestException,
  } from '@nestjs/common';
  import { AuthGuard } from '@nestjs/passport';
  import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
  import { AppointmentService } from './appointment.service';
  import { AuthenticatedRequest } from '../auth/authenticated-request';

  @ApiTags('appointment')
  @ApiBearerAuth('JWT')
  @Controller('appointments')
  @UseGuards(AuthGuard('jwt'))
  export class AppointmentController {
    constructor(private appointmentService: AppointmentService) {}

    @Get('me')
    async getMyAppointments(@Request() req: AuthenticatedRequest) {
      if (req.user.role === 'DOCTOR') {
        return this.appointmentService.getDoctorAppointments(req.user.userId);
      }
      return this.appointmentService.getPatientAppointments(req.user.userId);
    }

    @Post(':id/cancel')
    async cancel(
      @Request() req: AuthenticatedRequest,
      @Param('id') id: string,
      @Body() body: { reason?: string },
    ) {
      const role = req.user.role;
      if (role !== 'PATIENT' && role !== 'DOCTOR') {
        throw new ForbiddenException('Apenas pacientes e médicos podem cancelar consultas');
      }
      return this.appointmentService.cancel(
        parseInt(id, 10),
        req.user.userId,
        role,
        body?.reason,
      );
    }

    @Post(':id/reschedule')
    async reschedule(
      @Request() req: AuthenticatedRequest,
      @Param('id') id: string,
      @Body() body: { newDate?: string },
    ) {
      const role = req.user.role;
      if (role !== 'PATIENT' && role !== 'DOCTOR') {
        throw new ForbiddenException('Apenas pacientes e médicos podem reagendar consultas');
      }
      if (!body?.newDate) {
        throw new BadRequestException('newDate é obrigatório');
      }
      return this.appointmentService.reschedule(
        parseInt(id, 10),
        req.user.userId,
        role,
        new Date(body.newDate),
      );
    }
  }
  ```

- [ ] **Step 4: Rodar os testes para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/appointment/appointment.controller.spec.ts src/appointment/appointment.service.spec.ts --no-coverage
  ```

  Saída esperada: `Test Suites: 2 passed`, todos verdes.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && git add src/appointment/appointment.controller.ts src/appointment/appointment.controller.spec.ts
  git commit -m "feat(api): endpoints POST /appointments/:id/cancel e /reschedule com RBAC"
  ```

---

### Task 6 — Web: client `cancelAppointment`/`rescheduleAppointment` + hooks

Adiciona as funções no `doctor-dashboard-api.ts` (mesmo `api.post` já usado) e os hooks de mutação no padrão de `use-prescriptions.ts`, invalidando `queryKeys.appointments.me`.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/src/lib/doctor-dashboard-api.ts`
- Create: `/root/rodrigo/hope_saude/apps/web/src/lib/query/use-cancel-appointment.ts`
- Test: `/root/rodrigo/hope_saude/apps/web/src/lib/query/__tests__/use-cancel-appointment.test.tsx`

- [ ] **Step 1: Escrever o teste falho**

  Criar `/root/rodrigo/hope_saude/apps/web/src/lib/query/__tests__/use-cancel-appointment.test.tsx`:

  ```tsx
  import React from 'react';
  import { renderHook, act } from '@testing-library/react';
  import '@testing-library/jest-dom';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { useCancelAppointment, useRescheduleAppointment } from '../use-cancel-appointment';
  import * as api from '@/lib/doctor-dashboard-api';

  jest.mock('@/lib/doctor-dashboard-api');
  const mocked = api as jest.Mocked<typeof api>;

  const makeWrapper = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
  };

  describe('useCancelAppointment', () => {
    beforeEach(() => jest.clearAllMocks());

    it('cancela e invalida a lista de consultas', async () => {
      const { client, wrapper } = makeWrapper();
      const spy = jest.spyOn(client, 'invalidateQueries');
      mocked.cancelAppointment.mockResolvedValue({ id: 1, status: 'CANCELLED' } as any);

      const { result } = renderHook(() => useCancelAppointment(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ id: 1, reason: 'desisti' });
      });

      expect(mocked.cancelAppointment).toHaveBeenCalledWith(1, 'desisti');
      expect(spy).toHaveBeenCalledWith({ queryKey: ['appointments', 'me'] });
    });
  });

  describe('useRescheduleAppointment', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reagenda e invalida a lista de consultas', async () => {
      const { client, wrapper } = makeWrapper();
      const spy = jest.spyOn(client, 'invalidateQueries');
      mocked.rescheduleAppointment.mockResolvedValue({ id: 2, status: 'CONFIRMED' } as any);

      const { result } = renderHook(() => useRescheduleAppointment(), { wrapper });
      await act(async () => {
        await result.current.mutateAsync({ id: 1, newDate: '2026-07-01T10:00:00.000Z' });
      });

      expect(mocked.rescheduleAppointment).toHaveBeenCalledWith(1, '2026-07-01T10:00:00.000Z');
      expect(spy).toHaveBeenCalledWith({ queryKey: ['appointments', 'me'] });
    });
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx jest src/lib/query/__tests__/use-cancel-appointment.test.tsx
  ```

  Saída esperada: falha ao resolver o módulo `../use-cancel-appointment` (não existe).

- [ ] **Step 3: Implementar client + hooks**

  Em `/root/rodrigo/hope_saude/apps/web/src/lib/doctor-dashboard-api.ts`, adicionar (logo após `fetchAppointmentsMe`, que está nas linhas ~16-18):

  ```ts
  export async function cancelAppointment(id: number, reason?: string): Promise<unknown> {
    return api.post(`/appointments/${id}/cancel`, { reason });
  }

  export async function rescheduleAppointment(id: number, newDate: string): Promise<unknown> {
    return api.post(`/appointments/${id}/reschedule`, { newDate });
  }
  ```

  Criar `/root/rodrigo/hope_saude/apps/web/src/lib/query/use-cancel-appointment.ts`:

  ```ts
  import { useMutation, useQueryClient } from '@tanstack/react-query';
  import { cancelAppointment, rescheduleAppointment } from '@/lib/doctor-dashboard-api';
  import { queryKeys } from './query-keys';

  export function useCancelAppointment() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
        cancelAppointment(id, reason),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.appointments.me });
      },
    });
  }

  export function useRescheduleAppointment() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, newDate }: { id: number; newDate: string }) =>
        rescheduleAppointment(id, newDate),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: queryKeys.appointments.me });
      },
    });
  }
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx jest src/lib/query/__tests__/use-cancel-appointment.test.tsx
  ```

  Saída esperada: `Test Suites: 1 passed`, 2 testes verdes.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/web && git add src/lib/doctor-dashboard-api.ts src/lib/query/use-cancel-appointment.ts src/lib/query/__tests__/use-cancel-appointment.test.tsx
  git commit -m "feat(web): hooks useCancelAppointment/useRescheduleAppointment + client"
  ```

---

### Task 7 — Web: botão "Cancelar" no `UpcomingAppointmentsCard`

Adiciona o botão "Cancelar" ao lado de "Entrar na consulta", visível apenas em consultas `CONFIRMED`. O componente recebe um callback `onCancel(id)` (mantém o componente apresentacional, sem acoplar ao hook — o container injeta a mutation). Consultas `CANCELLED` exibem o badge cinza (o `appt.status` já cai no ramo `else` do badge atual).

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/src/components/profile/UpcomingAppointmentsCard.tsx`
- Test: `/root/rodrigo/hope_saude/apps/web/src/components/profile/__tests__/UpcomingAppointmentsCard.cancel.test.tsx`

- [ ] **Step 1: Escrever o teste falho**

  Criar `/root/rodrigo/hope_saude/apps/web/src/components/profile/__tests__/UpcomingAppointmentsCard.cancel.test.tsx`:

  ```tsx
  import React from 'react';
  import { render, screen, fireEvent } from '@testing-library/react';
  import '@testing-library/jest-dom';
  import { UpcomingAppointmentsCard } from '../UpcomingAppointmentsCard';

  const baseAppt = {
    id: 1,
    patientId: 20,
    doctorId: 5,
    date: '2026-07-01T10:00:00.000Z',
    status: 'CONFIRMED',
  };

  describe('UpcomingAppointmentsCard — cancelar', () => {
    it('mostra botão Cancelar em consulta CONFIRMED e chama onCancel com o id', () => {
      const onCancel = jest.fn();
      render(
        <UpcomingAppointmentsCard
          upcoming={[baseAppt]}
          userRole="PATIENT"
          doctorNames={{ 5: 'Ana' }}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
      expect(onCancel).toHaveBeenCalledWith(1);
    });

    it('não mostra botão Cancelar em consulta CANCELLED', () => {
      render(
        <UpcomingAppointmentsCard
          upcoming={[{ ...baseAppt, status: 'CANCELLED' }]}
          userRole="PATIENT"
          doctorNames={{ 5: 'Ana' }}
          onCancel={jest.fn()}
        />,
      );
      expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Rodar o teste para ver falhar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/profile/__tests__/UpcomingAppointmentsCard.cancel.test.tsx
  ```

  Saída esperada: falha — `onCancel` não é prop conhecida / botão "Cancelar" não existe.

- [ ] **Step 3: Implementar a prop e o botão**

  Em `/root/rodrigo/hope_saude/apps/web/src/components/profile/UpcomingAppointmentsCard.tsx`, adicionar `onCancel` à interface `Props` (após `doctorNames`):

  ```tsx
  interface Props {
    upcoming: AppointmentRow[];
    userRole: 'DOCTOR' | 'PATIENT' | string;
    doctorNames: Record<number, string>;
    onCancel?: (id: number) => void;
  }
  ```

  Atualizar a assinatura da função para desestruturar `onCancel`:

  ```tsx
  export function UpcomingAppointmentsCard({ upcoming, userRole, doctorNames, onCancel }: Props) {
  ```

  E, dentro do bloco `appt.status === 'CONFIRMED'` que renderiza o link "Entrar na consulta" (linhas 76-83), adicionar o botão logo após o `<a>...</a>`:

  ```tsx
                {appt.status === 'CONFIRMED' && (
                  <>
                    <a
                      href={`/video/${appt.id}`}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      Entrar na consulta
                    </a>
                    {onCancel && (
                      <button
                        type="button"
                        onClick={() => onCancel(appt.id)}
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </>
                )}
  ```

- [ ] **Step 4: Rodar o teste para ver passar**

  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/profile/__tests__/UpcomingAppointmentsCard.cancel.test.tsx
  ```

  Saída esperada: `Test Suites: 1 passed`, 2 testes verdes.

- [ ] **Step 5: Commit**

  ```bash
  cd /root/rodrigo/hope_saude/apps/web && git add src/components/profile/UpcomingAppointmentsCard.tsx src/components/profile/__tests__/UpcomingAppointmentsCard.cancel.test.tsx
  git commit -m "feat(web): botão Cancelar no UpcomingAppointmentsCard"
  ```

---

### Task 8 — Verificação final das suítes

Garante que nada da API/Web regrediu após todas as mudanças.

**Files:**
- Test: suítes completas de API e Web

- [ ] **Step 1: Rodar a suíte da API completa**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
  ```

  Saída esperada: todas as suítes passam (≥ 241 testes / ≥ 42 suítes, com os novos de cancel/reschedule somados).

- [ ] **Step 2: Rodar a suíte do Web completa**

  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx jest
  ```

  Saída esperada: todas as suítes passam (≥ 183 testes / ≥ 40 suítes, com os novos de hooks e card somados).

- [ ] **Step 3: Commit (se houver ajuste residual; caso contrário, pular)**

  ```bash
  cd /root/rodrigo/hope_saude && git status
  # Se algum arquivo de teste precisou de ajuste para passar:
  # git add <paths> && git commit -m "test: ajustes de suíte após cancelamento/reagendamento"
  ```

---

## Self-Review

**Cobertura dos gaps do escopo (Feature D — cancelamento/reagendamento):**

1. **Migration `Appointment` + `cancelledAt`/`cancellationReason`/`cancelledBy` (PATIENT|DOCTOR) + status CANCELLED** — Task 1 (schema + migration SQLite `ADD COLUMN`; `cancelledBy` como texto seguindo o padrão de `role`; `CANCELLED` documentado no comentário do `status`).
2. **`AppointmentService.cancel(appointmentId, userId, role, reason)`: ownership, antecedência (paciente 24h → BadRequest; médico sem janela), transação, idempotência, liberação de slot** — Task 2 (cancel + testes de NotFound/Forbidden/24h/idempotência/transação) e Task 3 (queries de range filtram `CANCELLED`, que é o que efetivamente libera o slot em `getAvailableSlots`/`findOverlappingForDoctor`).
3. **`AppointmentService.reschedule`: cancela + cria nova validando disponibilidade (reusa checagem de conflito do plano de integridade) + política de reembolso/crédito Asaas documentada** — Task 4 (reschedule reusa `findOverlappingForDoctor` do plano curto-02; mesma `paymentId`; reembolso Asaas documentado como nota fora do MVP, com ponto de integração apontado).
4. **Endpoints `POST /appointments/:id/cancel` e `/reschedule` com RBAC** — Task 5 (RBAC inline `req.user.role` no padrão de `prescription.controller.ts`; testes de PATIENT/DOCTOR/role inválida e de `newDate` obrigatório).
5. **Web: `useCancelAppointment` (mutation + invalidação) + botão em `UpcomingAppointmentsCard`** — Task 6 (hooks `useCancelAppointment`/`useRescheduleAppointment` invalidando `queryKeys.appointments.me`, no padrão de `use-prescriptions.ts`) e Task 7 (botão "Cancelar" com prop `onCancel`, testado).

**Referência ao plano de integridade:** `reschedule` (Task 4) e o filtro de slot (Task 3) dependem de `findOverlappingForDoctor`, criado em `2026-05-31-curto-02-integridade-pagamento-agendamento.md` (Task 6). A assinatura usada (`findOverlappingForDoctor(doctorId, date, durationMinutes): Promise<boolean>`) é a definida lá; o filtro `status: { not: 'CANCELLED' }` em `findAppointmentsForDoctorInRange` é consumido por aquele método sem alteração de assinatura.

**Fidelidade ao código real (verificado por leitura):** imports `@nestjs/common` (`NotFoundException`/`ForbiddenException`/`BadRequestException`/`ConflictException`), `AuthenticatedRequest` (`req.user = { userId, email, role }`), `AuthGuard('jwt')`, RBAC inline igual a `prescription.controller.ts`, `PrismaService.$transaction(cb)` (padrão de `medical-record.service.ts`), `createConfirmedAppointment`/`findById` existentes, `queryKeys.appointments.me = ['appointments','me']`, `api.post` de `api-client.ts`, padrão de hook/teste de `use-prescriptions.ts`, e a interface `Props`/badge do `UpcomingAppointmentsCard.tsx`.

**Sem placeholders:** todos os passos de código trazem blocos completos; nenhum "TODO"/"similar à Task N"/"adicionar validação apropriada". Todos os tipos/métodos referenciados (`cancel`, `reschedule`, `findOverlappingForDoctor`, `cancelAppointment`, `rescheduleAppointment`, `useCancelAppointment`, `onCancel`) são definidos numa Task deste plano ou já existem no repo (último caso explicitado).

**TDD/SOLID/DRY/YAGNI:** cada Task é red→green→commit; `reschedule` reusa `findOverlappingForDoctor` (DRY, sem reimplementar conflito); reembolso Asaas fica documentado e NÃO implementado no MVP (YAGNI); o componente fica apresentacional via `onCancel` (SRP — container injeta a mutation).

## Open Questions

- **Dependência do plano curto-02:** `findOverlappingForDoctor` precisa já existir no repo (criado em `2026-05-31-curto-02-...md`, Task 6). Confirmar que aquele plano foi executado antes deste; caso contrário, executar a Task 6 dele primeiro (ou inserir uma Task 0 portando o método). Validação humana recomendada.
- **Janela de antecedência (24h):** valor escolhido como padrão de MVP. Confirmar se o produto quer 24h fixo, configurável por médico, ou diferente por método de pagamento.
- **Reembolso Asaas:** decisão assumida de NÃO estornar automaticamente no MVP (apenas registrar motivo). Validar com o negócio a política de reembolso/crédito (integral até X horas? crédito para reagendar?) antes de implementar `AsaasService.refundPayment`.
- **Container que injeta `onCancel`:** o teste cobre o componente; a página/perfil que monta `UpcomingAppointmentsCard` precisa passar `onCancel={(id) => cancel.mutate({ id })}`. Identificar o container real (provável `apps/web/src/app/.../profile`) ao integrar — fora do escopo de testes unitários deste plano.
