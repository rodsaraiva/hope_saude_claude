# Correções de Segurança Críticas (Curto Prazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os gaps de segurança críticos/altos de aplicação imediata (IDOR de vídeo, gate de confirmação de pagamento, fail-fast de credenciais Asaas, vazamento de PII em log, fallback de segredo HMAC, CORS fail-closed, XSS de prontuário e PHI no localStorage) usando TDD estrito (red→green→refactor).

**Architecture:** As correções são pontuais e cirúrgicas sobre o código existente do `apps/api` (NestJS 11 + Prisma 5) e `apps/web` (Next.js 15). Cada Task escreve primeiro um teste vermelho que prova a vulnerabilidade/regressão, depois aplica a implementação mínima que torna o teste verde, e por fim commita. Nenhuma mudança de arquitetura: reaproveitamos `AuthenticatedRequest`, `ForbiddenException`, `AsaasService.getPaymentStatus`, o padrão de fail-fast já existente no `LacunaProvider`, e a sanitização passa a usar `sanitize-html` no backend (ponto único de persistência em `MedicalRecordService`).

**Tech Stack:** NestJS 11, Prisma 5 (SQLite), Jest (ts-jest, isolatedModules), class-validator, `@nestjs/config` (ConfigModule global + validationSchema via Joi), `sanitize-html`; front em Next.js 15 + React 19 + jest-environment-jsdom + Testing Library.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `apps/api/src/video/video.controller.ts` | Exigir que `req.user.userId` seja paciente OU médico da consulta antes de emitir token; não vazar `patientName` a não-participante. |
| Modify | `apps/api/src/video/video.controller.spec.ts` | Corrigir teste que validava o comportamento vulnerável; adicionar caso de 403 para terceiro. |
| Modify | `apps/api/src/payment/payment.controller.ts` | Bloquear `POST :paymentId/confirm` quando `NODE_ENV==='production'`. |
| Modify | `apps/api/src/payment/payment.service.ts` | Exigir `getPaymentStatus` RECEIVED/CONFIRMED antes de criar consulta; remover try/catch otimista do `receiveInSandbox`. |
| Modify | `apps/api/src/payment/payment.service.spec.ts` | Ajustar testes de `confirmPayment` ao novo contrato. |
| Modify | `apps/api/src/payment/asaas.service.ts` | Fail-fast no boot quando `ASAAS_API_KEY` ausente em produção; `isMock()` só em dev/test explícito. |
| Create | `apps/api/src/payment/asaas.service.spec.ts` | Cobrir fail-fast e regras de `isMock()`. |
| Modify | `apps/api/src/auth/roles.guard.ts` | Remover `console.log` que serializa `user` (PII em log). |
| Create | `apps/api/src/auth/roles.guard.spec.ts` | Garantir ausência do vazamento e a lógica de autorização. |
| Modify | `apps/api/src/common/cryptography.service.ts` | Remover fallback `'dev-secret-key'`; fail-fast quando `JWT_SECRET` ausente. |
| Modify | `apps/api/src/common/cryptography.service.spec.ts` | Adicionar teste de fail-fast sem `JWT_SECRET`. |
| Modify | `apps/api/src/common/cors.util.ts` | Fail-closed: não liberar tudo em produção sem `CORS_ORIGINS`. |
| Modify | `apps/api/src/common/cors.util.spec.ts` | Ajustar/garantir o comportamento por ambiente. |
| Create | `apps/api/src/common/html-sanitizer.ts` | Função pura `sanitizeMedicalHtml` (whitelist Tiptap). |
| Create | `apps/api/src/common/html-sanitizer.spec.ts` | Testar remoção de `<script>`/handlers e preservação de tags clínicas. |
| Modify | `apps/api/src/medical-record/medical-record.service.ts` | Sanitizar `content` antes de encriptar em `create()`/`update()`. |
| Modify | `apps/api/src/medical-record/medical-record.service.spec.ts` | Provar que o HTML persistido foi sanitizado. |
| Modify | `apps/web/src/components/profile/MedicalRecordsList.tsx` | Corrigir o comentário falso (linha 17-19) sobre origem da sanitização. |
| Modify | `apps/web/src/components/MedicalRecordModal.tsx` | Remover `localStorage.setItem('pending_signature_content', ...)` (dead-write de PHI). |
| Create | `apps/web/src/components/__tests__/MedicalRecordModal.signature.test.tsx` | Provar que `handleSign` não grava PHI no localStorage. |

---

## Tasks

### Task 1 — IDOR no token de vídeo (CRÍTICO)

Hoje `VideoController.getToken` só checa `status === 'CONFIRMED'`; qualquer usuário autenticado obtém token LiveKit de qualquer consulta e ainda recebe `patientName`. Vamos exigir que o solicitante seja o paciente ou o médico da consulta e parar de vazar `patientName` para terceiros (na prática, só participantes chegam ao retorno).

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/video/video.controller.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/video/video.controller.spec.ts`

**Steps:**

- [ ] **Step 1: Reescrever o spec inteiro com o contrato seguro (teste vermelho).** O teste atual nas linhas 36-66 valida o comportamento vulnerável (não passa `userId`). Substitua o arquivo inteiro por:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { AppointmentService } from '../appointment/appointment.service';

describe('VideoController', () => {
  let controller: VideoController;
  let videoService: jest.Mocked<Pick<VideoService, 'generateToken'>>;
  let appointmentService: jest.Mocked<Pick<AppointmentService, 'findById'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideoController],
      providers: [
        { provide: VideoService, useValue: { generateToken: jest.fn() } },
        { provide: AppointmentService, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    controller = module.get<VideoController>(VideoController);
    videoService = module.get(VideoService);
    appointmentService = module.get(AppointmentService);
  });

  it('returns token payload to the PATIENT of the appointment', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'CONFIRMED',
      patientId: 10,
      doctorId: 20,
      patient: { name: 'Maria Silva' },
    } as any);
    videoService.generateToken.mockResolvedValue({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
    });

    const req = { user: { userId: 10, email: 'patient@test.com', role: 'PATIENT' } };
    const result = await controller.getToken('1', req as any);

    expect(appointmentService.findById).toHaveBeenCalledWith(1);
    expect(videoService.generateToken).toHaveBeenCalledWith('room-1', 'patient@test.com');
    expect(result).toEqual({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
      appointment: {
        id: 1,
        patientId: 10,
        doctorId: 20,
        patientName: 'Maria Silva',
      },
    });
  });

  it('returns token payload to the DOCTOR of the appointment', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'CONFIRMED',
      patientId: 10,
      doctorId: 20,
      patient: { name: 'Maria Silva' },
    } as any);
    videoService.generateToken.mockResolvedValue({
      token: 'jwt',
      roomName: 'room-1',
      livekitUrl: 'ws://localhost:7880',
    });

    const req = { user: { userId: 20, email: 'doctor@test.com', role: 'DOCTOR' } };
    const result = await controller.getToken('1', req as any);

    expect(videoService.generateToken).toHaveBeenCalledWith('room-1', 'doctor@test.com');
    expect(result.appointment.patientName).toBe('Maria Silva');
  });

  it('throws Forbidden when requester is neither patient nor doctor (IDOR)', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'CONFIRMED',
      patientId: 10,
      doctorId: 20,
      patient: { name: 'Maria Silva' },
    } as any);

    const req = { user: { userId: 99, email: 'intruder@test.com', role: 'PATIENT' } };

    await expect(controller.getToken('1', req as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(videoService.generateToken).not.toHaveBeenCalled();
  });

  it('throws Forbidden when appointment is not CONFIRMED', async () => {
    appointmentService.findById.mockResolvedValue({
      id: 1,
      status: 'PENDING',
      patientId: 10,
      doctorId: 20,
    } as any);

    await expect(
      controller.getToken('1', { user: { userId: 10, role: 'PATIENT' } } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(videoService.generateToken).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/video/video.controller.spec.ts --no-coverage
```

Saída esperada: o caso "throws Forbidden when requester is neither patient nor doctor (IDOR)" falha porque o controller atual emite o token para o intruso (não lança). FAIL com `Received promise resolved instead of rejected`.

- [ ] **Step 3: Implementar a checagem de participante no controller.** Substitua o corpo de `getToken` em `video.controller.ts` (linhas 23-43) por:

```ts
    const appt = await this.appointmentService.findById(Number(appointmentId));

    if (!appt || appt.status !== 'CONFIRMED') {
      throw new ForbiddenException('Consulta não confirmada ou inexistente');
    }

    const isParticipant =
      req.user.userId === appt.patientId || req.user.userId === appt.doctorId;
    if (!isParticipant) {
      throw new ForbiddenException('Você não participa desta consulta');
    }

    const payload = await this.videoService.generateToken(
      `room-${appointmentId}`,
      req.user.email ?? `user-${req.user.userId}`,
    );

    return {
      ...payload,
      appointment: {
        id: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        patientName: (appt as any).patient?.name,
      },
    };
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/video/video.controller.spec.ts --no-coverage
```

Saída esperada: `Tests: 4 passed`.

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/video/video.controller.ts apps/api/src/video/video.controller.spec.ts && git commit -m "fix(api): corrige IDOR no token de vídeo exigindo que o solicitante seja participante da consulta"
```

---

### Task 2 — Gate de `POST /payments/:id/confirm` em produção (CRÍTICO)

O endpoint força a confirmação manual de pagamento (cria consulta sem dinheiro real entrar). Em produção isso é fraude trivial. Bloqueamos por `NODE_ENV` no controller.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.controller.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.controller.spec.ts` (criar se não existir)

**Steps:**

- [ ] **Step 1: Criar/abrir o spec do controller com o teste de gate (vermelho).** Escreva `/root/rodrigo/hope_saude/apps/api/src/payment/payment.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: jest.Mocked<Pick<PaymentService, 'confirmPayment'>>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            confirmPayment: jest.fn().mockResolvedValue({ success: true }),
            processCheckout: jest.fn(),
            getPixQrData: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get(PaymentService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('bloqueia confirmação manual em produção (anti-fraude)', async () => {
    process.env.NODE_ENV = 'production';
    const req = { user: { userId: 7, role: 'PATIENT' } } as any;

    await expect(controller.confirmPayment(req, 'pay_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(paymentService.confirmPayment).not.toHaveBeenCalled();
  });

  it('permite confirmação manual fora de produção', async () => {
    process.env.NODE_ENV = 'development';
    const req = { user: { userId: 7, role: 'PATIENT' } } as any;

    const result = await controller.confirmPayment(req, 'pay_1');

    expect(paymentService.confirmPayment).toHaveBeenCalledWith(7, 'pay_1');
    expect(result).toEqual({ success: true });
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.controller.spec.ts --no-coverage
```

Saída esperada: "bloqueia confirmação manual em produção" falha (`Received promise resolved instead of rejected`), pois o controller atual não checa `NODE_ENV`.

- [ ] **Step 3: Implementar o gate no controller.** Em `payment.controller.ts`, importe `ForbiddenException` e ajuste `confirmPayment` (linhas 27-34):

  - Troque a linha 1 de import para incluir `ForbiddenException`:

```ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  Request,
  ForbiddenException,
} from '@nestjs/common';
```

  - Substitua o método `confirmPayment` (incluindo o JSDoc da linha 27) por:

```ts
  /** Força recebimento de pagamento em sandbox (apenas para testes/agilidade; bloqueado em produção). */
  @Post(':paymentId/confirm')
  async confirmPayment(
    @Request() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Confirmação manual de pagamento indisponível em produção');
    }
    return this.paymentService.confirmPayment(req.user.userId, paymentId);
  }
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.controller.spec.ts --no-coverage
```

Saída esperada: `Tests: 2 passed`.

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/payment/payment.controller.ts apps/api/src/payment/payment.controller.spec.ts && git commit -m "fix(api): bloqueia confirmação manual de pagamento em produção"
```

---

### Task 3 — `confirmPayment` exige status real RECEIVED/CONFIRMED (CRÍTICO)

Mesmo fora de produção, `confirmPayment` cria a consulta com `try/catch` otimista: se `receiveInSandbox` falhar, segue criando assim mesmo. Vamos exigir que `getPaymentStatus` retorne `RECEIVED`/`CONFIRMED` antes de criar a consulta e remover o `try/catch`.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/payment.service.spec.ts`

**Steps:**

- [ ] **Step 1: Ajustar o spec (vermelho).** Em `payment.service.spec.ts`:

  - Adicione `getPaymentStatus: jest.fn()` ao mock do `AsaasService` (bloco das linhas 21-29), ficando:

```ts
        {
          provide: AsaasService,
          useValue: {
            createPayment: jest.fn(),
            getPixQrCode: jest.fn(),
            findCustomerIdByCpf: jest.fn(),
            createCustomer: jest.fn(),
            receiveInSandbox: jest.fn(),
            getPaymentStatus: jest.fn(),
          },
        },
```

  - Substitua o teste "should confirm payment manual, creating appointment and deleting pending" (linhas 125-155) por uma versão que mocka o status confirmado:

```ts
  it('should confirm payment when Asaas status is RECEIVED, creating appointment and deleting pending', async () => {
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
    (asaasService.getPaymentStatus as jest.Mock).mockResolvedValue({
      id: 'pay_manual_123',
      status: 'RECEIVED',
    });

    const result = await service.confirmPayment(1, 'pay_manual_123');

    expect(asaasService.receiveInSandbox).toHaveBeenCalledWith('pay_manual_123');
    expect(asaasService.getPaymentStatus).toHaveBeenCalledWith('pay_manual_123');
    expect(appointmentService.createConfirmedAppointment).toHaveBeenCalledWith({
      patientId: 1,
      doctorId: 2,
      date: pending.date,
      paymentId: 'pay_manual_123',
      consultationModelId: 10,
      price: 200,
      durationMinutes: 45,
    });
    expect(appointmentService.deletePendingCheckout).toHaveBeenCalledWith(55);
    expect(result).toEqual({ success: true });
  });
```

  - Substitua o teste "should confirm payment manual even if Asaas Sandbox fails..." (linhas 157-177) por um que prova que NÃO se cria consulta quando o status não confirma:

```ts
  it('should NOT create appointment when Asaas status is not RECEIVED/CONFIRMED', async () => {
    const pending = {
      id: 56,
      patientId: 1,
      doctorId: 2,
      date: new Date('2026-04-03T10:00:00Z'),
      asaasPaymentId: 'pay_pending',
      price: 200,
      durationMinutes: 45,
    };
    (appointmentService.findPendingCheckoutByPatientAndPayment as jest.Mock).mockResolvedValue(
      pending,
    );
    (asaasService.receiveInSandbox as jest.Mock).mockResolvedValue({ id: 'pay_pending' });
    (asaasService.getPaymentStatus as jest.Mock).mockResolvedValue({
      id: 'pay_pending',
      status: 'PENDING',
    });

    await expect(service.confirmPayment(1, 'pay_pending')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(appointmentService.createConfirmedAppointment).not.toHaveBeenCalled();
    expect(appointmentService.deletePendingCheckout).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.service.spec.ts --no-coverage
```

Saída esperada: o novo caso "should NOT create appointment when Asaas status is not RECEIVED/CONFIRMED" falha (a implementação atual cria a consulta de qualquer forma), e "should confirm payment when Asaas status is RECEIVED..." falha porque `getPaymentStatus` nunca é chamado.

- [ ] **Step 3: Implementar a verificação de status no service.** Em `payment.service.ts`, substitua o método `confirmPayment` (linhas 210-242) por:

```ts
  /** Confirma o pagamento somente após o Asaas reportar RECEIVED/CONFIRMED, então cria a consulta. */
  async confirmPayment(userId: number, paymentId: string) {
    const pending = await this.appointmentService.findPendingCheckoutByPatientAndPayment(
      userId,
      paymentId,
    );
    if (!pending) {
      throw new NotFoundException('Cobrança não encontrada ou sem permissão');
    }

    // Em sandbox, simula o recebimento; em mock isso é no-op.
    await this.asaasService.receiveInSandbox(paymentId);

    const { status } = (await this.asaasService.getPaymentStatus(paymentId)) as {
      status?: string;
    };
    if (status !== 'RECEIVED' && status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Pagamento ainda não confirmado pelo Asaas (status: ${status ?? 'desconhecido'})`,
      );
    }

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
  }
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.service.spec.ts --no-coverage
```

Saída esperada: todos os testes da suíte passam (incluindo os dois reescritos).

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/payment/payment.service.ts apps/api/src/payment/payment.service.spec.ts && git commit -m "fix(api): exige status RECEIVED/CONFIRMED do Asaas antes de criar consulta na confirmação"
```

---

### Task 4 — Asaas fail-fast no boot + `isMock()` restrito (ALTO)

`AsaasService` cai silenciosamente em `MOCK_API_KEY` quando `ASAAS_API_KEY` falta — risco de "pagamento mockado" em produção. Vamos lançar no construtor se faltar a chave em produção (espelhando o `LacunaProvider`) e restringir `isMock()` a dev/test.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/payment/asaas.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/payment/asaas.service.spec.ts`

**Steps:**

- [ ] **Step 1: Escrever o spec (vermelho).** Crie `/root/rodrigo/hope_saude/apps/api/src/payment/asaas.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { AsaasService } from './asaas.service';

function buildConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AsaasService', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('lança no construtor quando ASAAS_API_KEY falta em produção', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new AsaasService(buildConfig({}))).toThrow(/ASAAS_API_KEY/);
  });

  it('constrói normalmente em produção quando ASAAS_API_KEY está presente', () => {
    process.env.NODE_ENV = 'production';
    expect(
      () => new AsaasService(buildConfig({ ASAAS_API_KEY: 'real_key' })),
    ).not.toThrow();
  });

  it('em test sem chave usa MOCK e getPaymentStatus retorna RECEIVED', async () => {
    process.env.NODE_ENV = 'test';
    const svc = new AsaasService(buildConfig({}));
    await expect(svc.getPaymentStatus('pay_x')).resolves.toEqual({
      id: 'pay_x',
      status: 'RECEIVED',
    });
  });

  it('em development com chave real NÃO usa MOCK (createCustomer não retorna mock id)', async () => {
    process.env.NODE_ENV = 'development';
    const svc = new AsaasService(buildConfig({ ASAAS_API_KEY: 'real_key' }));
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: 'cus_real' }), { status: 200 }));

    const result = await svc.createCustomer('Nome', 'a@b.com', '12345678909');

    expect(fetchSpy).toHaveBeenCalled();
    expect(result).toEqual({ id: 'cus_real' });
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/asaas.service.spec.ts --no-coverage
```

Saída esperada: "lança no construtor quando ASAAS_API_KEY falta em produção" falha (o construtor atual não lança, cai em `MOCK_API_KEY`). Os demais podem passar/falhar conforme `isMock()`.

- [ ] **Step 3: Implementar fail-fast e `isMock()` restrito.** Em `asaas.service.ts`, substitua o construtor (linhas 10-14) e o método `isMock` (linhas 16-18) por:

```ts
  constructor(private configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('ASAAS_API_URL') || 'https://sandbox.asaas.com/api/v3';
    const key = this.configService.get<string>('ASAAS_API_KEY');
    if (!key || key.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'ASAAS_API_KEY não está configurada. Pagamentos indisponíveis em produção.',
        );
      }
      this.apiKey = 'MOCK_API_KEY';
    } else {
      this.apiKey = key;
    }
  }

  private isMock(): boolean {
    return (
      this.apiKey === 'MOCK_API_KEY' &&
      process.env.NODE_ENV !== 'production'
    );
  }
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/asaas.service.spec.ts --no-coverage
```

Saída esperada: `Tests: 4 passed`.

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/payment/asaas.service.ts apps/api/src/payment/asaas.service.spec.ts && git commit -m "fix(api): Asaas fail-fast no boot em produção e isMock restrito a dev/test"
```

---

### Task 5 — `validationSchema` do ConfigModule garante segredos no boot (ALTO)

Reforça a Task 4/5 centralizando: o `ConfigModule` valida no boot, em produção, que `ASAAS_API_KEY`, `JWT_SECRET` e `DATA_ENCRYPTION_KEY` existem. Usa `joi` (dependência transitiva de `@nestjs/config`, mas declaramos explicitamente).

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/app.module.ts`
- Create: `/root/rodrigo/hope_saude/apps/api/src/config/env.validation.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/config/env.validation.spec.ts`

**Steps:**

- [ ] **Step 1: Instalar `joi` no apps/api.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npm install joi
```

- [ ] **Step 2: Escrever o spec (vermelho).** Crie `/root/rodrigo/hope_saude/apps/api/src/config/env.validation.spec.ts`:

```ts
import { buildEnvValidationSchema } from './env.validation';

describe('env validation schema', () => {
  it('exige ASAAS_API_KEY, JWT_SECRET e DATA_ENCRYPTION_KEY quando NODE_ENV=production', () => {
    const schema = buildEnvValidationSchema();
    const { error } = schema.validate(
      { NODE_ENV: 'production' },
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeDefined();
    const message = error!.message;
    expect(message).toContain('ASAAS_API_KEY');
    expect(message).toContain('JWT_SECRET');
    expect(message).toContain('DATA_ENCRYPTION_KEY');
  });

  it('aceita ambiente de desenvolvimento sem os segredos', () => {
    const schema = buildEnvValidationSchema();
    const { error } = schema.validate(
      { NODE_ENV: 'development' },
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeUndefined();
  });

  it('aceita produção quando os três segredos estão presentes', () => {
    const schema = buildEnvValidationSchema();
    const { error } = schema.validate(
      {
        NODE_ENV: 'production',
        ASAAS_API_KEY: 'k',
        JWT_SECRET: 's',
        DATA_ENCRYPTION_KEY: 'd',
      },
      { abortEarly: false, allowUnknown: true },
    );
    expect(error).toBeUndefined();
  });
});
```

- [ ] **Step 3: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/config/env.validation.spec.ts --no-coverage
```

Saída esperada: `Cannot find module './env.validation'` (módulo ainda não existe).

- [ ] **Step 4: Implementar o schema.** Crie `/root/rodrigo/hope_saude/apps/api/src/config/env.validation.ts`:

```ts
import * as Joi from 'joi';

/**
 * Schema de validação das variáveis de ambiente.
 * Em produção, segredos sensíveis são obrigatórios — fail-fast no boot.
 */
export function buildEnvValidationSchema(): Joi.ObjectSchema {
  const requiredInProd = (base: Joi.StringSchema) =>
    Joi.alternatives().conditional('NODE_ENV', {
      is: 'production',
      then: base.required(),
      otherwise: base.optional(),
    });

  return Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .default('development'),
    ASAAS_API_KEY: requiredInProd(Joi.string()),
    JWT_SECRET: requiredInProd(Joi.string()),
    DATA_ENCRYPTION_KEY: requiredInProd(Joi.string()),
  });
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/config/env.validation.spec.ts --no-coverage
```

Saída esperada: `Tests: 3 passed`.

- [ ] **Step 6: Ligar o schema no ConfigModule.** Em `app.module.ts`, importe e use o schema. Troque a linha de import do ConfigModule (linha 3) e a linha 21:

  - Após a linha 3, adicione:

```ts
import { buildEnvValidationSchema } from './config/env.validation';
```

  - Substitua a linha 21 (`ConfigModule.forRoot({ isGlobal: true }),`) por:

```ts
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: buildEnvValidationSchema(),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
```

- [ ] **Step 7: Rodar a suíte de boot do app para garantir que nada quebrou em test.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/app.controller.spec.ts --no-coverage
```

Saída esperada: suíte passa (NODE_ENV=test não exige segredos).

- [ ] **Step 8: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/config/env.validation.ts apps/api/src/config/env.validation.spec.ts apps/api/src/app.module.ts apps/api/package.json apps/api/package-lock.json && git commit -m "feat(api): valida segredos obrigatórios em produção no boot via ConfigModule validationSchema"
```

---

### Task 6 — Remover `console.log` de PII em `RolesGuard` (ALTO)

`roles.guard.ts:17` serializa o objeto `user` inteiro num `console.log`, vazando PII (email, role, ids) em todo request que passe por rota com `@Roles`. Remover.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/auth/roles.guard.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/auth/roles.guard.spec.ts`

**Steps:**

- [ ] **Step 1: Escrever o spec (vermelho).** Crie `/root/rodrigo/hope_saude/apps/api/src/auth/roles.guard.spec.ts`:

```ts
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('libera quando não há roles requeridas', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined as any);
    expect(guard.canActivate(buildContext({ role: 'PATIENT' }))).toBe(true);
  });

  it('autoriza quando o role do usuário está na lista', () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    expect(guard.canActivate(buildContext({ role: 'DOCTOR' }))).toBe(true);
  });

  it('nega quando o role do usuário não está na lista', () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    expect(guard.canActivate(buildContext({ role: 'PATIENT' }))).toBe(false);
  });

  it('não vaza o objeto user em console.log (PII)', () => {
    reflector.getAllAndOverride.mockReturnValue(['DOCTOR']);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    guard.canActivate(buildContext({ role: 'DOCTOR', email: 'leak@test.com' }));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/roles.guard.spec.ts --no-coverage
```

Saída esperada: "não vaza o objeto user em console.log (PII)" falha porque o guard ainda chama `console.log`.

- [ ] **Step 3: Remover o `console.log`.** Em `roles.guard.ts`, apague a linha 17 inteira (`console.log(\`[ROLES] Required: ...\`);`), mantendo o restante do método:

```ts
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user?.role === role);
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/roles.guard.spec.ts --no-coverage
```

Saída esperada: `Tests: 4 passed`.

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/auth/roles.guard.ts apps/api/src/auth/roles.guard.spec.ts && git commit -m "fix(api): remove console.log que vazava PII do usuário no RolesGuard"
```

---

### Task 7 — Remover fallback `'dev-secret-key'` do HMAC (ALTO)

`cryptography.service.ts:18` cai em `'dev-secret-key'` quando `JWT_SECRET` falta, tornando o HMAC de assinatura forjável. Fail-fast no construtor.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/common/cryptography.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/common/cryptography.service.spec.ts`

**Steps:**

- [ ] **Step 1: Adicionar o teste de fail-fast (vermelho).** Em `cryptography.service.spec.ts`, adicione (dentro do `describe('CryptographyService', ...)`, após o último `it`/`describe`, antes do `});` final) este bloco:

```ts
  it('lança quando JWT_SECRET está ausente (sem fallback inseguro)', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          CryptographyService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string) =>
                key === 'DATA_ENCRYPTION_KEY' ? TEST_ENCRYPTION_KEY : undefined,
              ),
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow(/JWT_SECRET/);
  });
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/cryptography.service.spec.ts --no-coverage
```

Saída esperada: o novo caso falha — o construtor atual aceita a ausência usando `'dev-secret-key'` (não lança).

- [ ] **Step 3: Remover o fallback.** Em `cryptography.service.ts`, substitua o construtor (linhas 17-19) por:

```ts
  constructor(private configService: ConfigService) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret || secret.trim() === '') {
      throw new Error('JWT_SECRET não está configurada. Assinatura HMAC indisponível.');
    }
    this.secret = secret;
  }
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/cryptography.service.spec.ts --no-coverage
```

Saída esperada: toda a suíte passa (o `beforeEach` existente já injeta `JWT_SECRET='test-secret'`).

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/common/cryptography.service.ts apps/api/src/common/cryptography.service.spec.ts && git commit -m "fix(api): remove fallback dev-secret-key do HMAC com fail-fast quando JWT_SECRET falta"
```

---

### Task 8 — CORS fail-closed em produção (ALTO)

`parseCorsOrigins(undefined)` retorna `true` (libera qualquer origin) — perigoso em produção. Vamos aceitar `nodeEnv` e, em produção sem `CORS_ORIGINS`, retornar lista vazia (fail-closed) em vez de `true`.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/common/cors.util.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/common/cors.util.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/main.ts`

**Steps:**

- [ ] **Step 1: Ajustar o spec (vermelho).** Substitua o conteúdo de `cors.util.spec.ts` por:

```ts
import { parseCorsOrigins } from './cors.util';

describe('parseCorsOrigins', () => {
  it('retorna lista quando há uma origin', () => {
    expect(parseCorsOrigins('http://localhost:3001', 'development')).toEqual([
      'http://localhost:3001',
    ]);
  });

  it('retorna lista quando há múltiplas origins separadas por vírgula', () => {
    expect(parseCorsOrigins('http://localhost:3001, https://hope.app', 'production')).toEqual([
      'http://localhost:3001',
      'https://hope.app',
    ]);
  });

  it('ignora espaços e entradas vazias', () => {
    expect(parseCorsOrigins('  http://a.com , , http://b.com ', 'development')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('libera tudo (true) só fora de produção quando env não está definido', () => {
    expect(parseCorsOrigins(undefined, 'development')).toBe(true);
    expect(parseCorsOrigins('', 'development')).toBe(true);
    expect(parseCorsOrigins('   ', 'test')).toBe(true);
  });

  it('fail-closed em produção sem CORS_ORIGINS (lista vazia, não true)', () => {
    expect(parseCorsOrigins(undefined, 'production')).toEqual([]);
    expect(parseCorsOrigins('', 'production')).toEqual([]);
    expect(parseCorsOrigins('   ', 'production')).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/cors.util.spec.ts --no-coverage
```

Saída esperada: "fail-closed em produção sem CORS_ORIGINS" falha (a função atual ignora o ambiente e retorna `true`), e os demais falham por aridade do segundo argumento ainda não existir.

- [ ] **Step 3: Implementar o parâmetro de ambiente.** Substitua o conteúdo de `cors.util.ts` por:

```ts
/**
 * Converte a variável CORS_ORIGINS (string separada por vírgula) em lista de origins.
 * Em produção sem config, retorna [] (fail-closed). Fora de produção sem config,
 * retorna `true` (libera tudo) só para conveniência de dev.
 */
export function parseCorsOrigins(
  raw: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] | boolean {
  const list = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (list.length === 0) {
    return nodeEnv === 'production' ? [] : true;
  }
  return list;
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/cors.util.spec.ts --no-coverage
```

Saída esperada: `Tests: 5 passed`.

- [ ] **Step 5: Atualizar o caller em `main.ts`.** Em `main.ts`, troque a linha 21 (`origin: parseCorsOrigins(process.env.CORS_ORIGINS),`) por:

```ts
    origin: parseCorsOrigins(process.env.CORS_ORIGINS, process.env.NODE_ENV),
```

- [ ] **Step 6: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/common/cors.util.ts apps/api/src/common/cors.util.spec.ts apps/api/src/main.ts && git commit -m "fix(api): CORS fail-closed em produção quando CORS_ORIGINS não está definido"
```

---

### Task 9 — Sanitização de HTML do prontuário no backend (ALTO)

`content` é HTML do Tiptap persistido sem sanitização e renderizado com `dangerouslySetInnerHTML` no front (XSS armazenado). Sanitizamos no único ponto de persistência (`MedicalRecordService.create`/`update`) com `sanitize-html`, mantendo a whitelist de tags do editor.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/common/html-sanitizer.ts`
- Create: `/root/rodrigo/hope_saude/apps/api/src/common/html-sanitizer.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/medical-record/medical-record.service.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/medical-record/medical-record.service.spec.ts`

**Steps:**

- [ ] **Step 1: Instalar `sanitize-html` e os tipos no apps/api.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npm install sanitize-html && npm install -D @types/sanitize-html
```

- [ ] **Step 2: Escrever o spec do sanitizer (vermelho).** Crie `/root/rodrigo/hope_saude/apps/api/src/common/html-sanitizer.spec.ts`:

```ts
import { sanitizeMedicalHtml } from './html-sanitizer';

describe('sanitizeMedicalHtml', () => {
  it('remove tags <script>', () => {
    const dirty = '<p>ok</p><script>alert(1)</script>';
    expect(sanitizeMedicalHtml(dirty)).toBe('<p>ok</p>');
  });

  it('remove handlers inline (onerror/onclick)', () => {
    const dirty = '<img src=x onerror="alert(1)"><p onclick="x()">t</p>';
    const clean = sanitizeMedicalHtml(dirty);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
  });

  it('remove javascript: em href de link', () => {
    const dirty = '<a href="javascript:alert(1)">x</a>';
    expect(sanitizeMedicalHtml(dirty)).not.toContain('javascript:');
  });

  it('preserva formatação clínica do Tiptap (strong, p, ul, li)', () => {
    const dirty =
      '<p><strong>S (Subjetivo):</strong></p><ul><li>queixa</li></ul>';
    expect(sanitizeMedicalHtml(dirty)).toBe(dirty);
  });

  it('preserva null/undefined', () => {
    expect(sanitizeMedicalHtml(null)).toBeNull();
    expect(sanitizeMedicalHtml(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/html-sanitizer.spec.ts --no-coverage
```

Saída esperada: `Cannot find module './html-sanitizer'`.

- [ ] **Step 4: Implementar o sanitizer.** Crie `/root/rodrigo/hope_saude/apps/api/src/common/html-sanitizer.ts`:

```ts
import sanitizeHtml from 'sanitize-html';

/**
 * Sanitiza HTML de prontuário (gerado pelo Tiptap) antes de persistir.
 * Whitelist mínima das tags/atributos que o editor produz; remove
 * <script>, handlers inline e protocolos perigosos (XSS armazenado).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'blockquote',
    'a',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function sanitizeMedicalHtml<T extends string | null | undefined>(html: T): T {
  if (html === null || html === undefined) return html;
  return sanitizeHtml(html, OPTIONS) as T;
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/html-sanitizer.spec.ts --no-coverage
```

Saída esperada: `Tests: 5 passed`.

- [ ] **Step 6: Adicionar teste de integração no service (vermelho).** Em `medical-record.service.spec.ts`, adicione um teste que prove a sanitização na criação. Use o mesmo padrão de mocks já existente na suíte (PrismaService + CryptographyService + SignatureProvider). Adicione dentro do `describe` principal:

```ts
  it('sanitiza o content (remove <script>) antes de encriptar no create', async () => {
    (prisma.appointment.findFirst as jest.Mock).mockResolvedValue({ id: 1 });
    (cryptoService.encryptNullable as jest.Mock).mockImplementation((v: string) => `enc:${v}`);
    (cryptoService.decryptNullable as jest.Mock).mockImplementation((v: string) => v);
    (prisma.medicalRecord.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data }),
    );

    await service.create({
      doctorId: 5,
      patientId: 10,
      content: '<p>ok</p><script>alert(1)</script>',
    });

    expect(cryptoService.encryptNullable).toHaveBeenCalledWith('<p>ok</p>');
  });
```

> Nota: se os nomes das variáveis de mock (`prisma`, `cryptoService`) diferirem na suíte existente, ajuste para os nomes já declarados no `beforeEach` do arquivo (ler o topo do spec antes de adicionar).

- [ ] **Step 7: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/medical-record/medical-record.service.spec.ts --no-coverage
```

Saída esperada: o novo caso falha — hoje `encryptNullable` recebe o HTML com `<script>` intacto.

- [ ] **Step 8: Sanitizar no service.** Em `medical-record.service.ts`:

  - Após a linha 10 (`import { SignatureProvider } ...`), adicione:

```ts
import { sanitizeMedicalHtml } from '../common/html-sanitizer';
```

  - Em `create()`, substitua a linha 75 (`const encryptedContent = this.cryptoService.encryptNullable(data.content);`) por:

```ts
    const sanitized = sanitizeMedicalHtml(data.content);
    const encryptedContent = this.cryptoService.encryptNullable(sanitized);
```

  - Em `update()`, substitua a linha 159 (`const newEncryptedContent = this.cryptoService.encryptNullable(content) as string;`) por:

```ts
    const newEncryptedContent = this.cryptoService.encryptNullable(
      sanitizeMedicalHtml(content),
    ) as string;
```

- [ ] **Step 9: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest src/medical-record/medical-record.service.spec.ts --no-coverage
```

Saída esperada: toda a suíte do service passa.

- [ ] **Step 10: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/common/html-sanitizer.ts apps/api/src/common/html-sanitizer.spec.ts apps/api/src/medical-record/medical-record.service.ts apps/api/src/medical-record/medical-record.service.spec.ts apps/api/package.json apps/api/package-lock.json && git commit -m "fix(api): sanitiza HTML do prontuário no backend antes de persistir (XSS armazenado)"
```

---

### Task 10 — Corrigir comentário falso de sanitização no front (BAIXO/DOC)

O comentário em `MedicalRecordsList.tsx:17-19` afirma que o conteúdo "vem do backend já sanitizado via ValidationPipe" — falso (o `ValidationPipe` não sanitiza HTML; quem sanitiza agora é o `MedicalRecordService` da Task 9). Corrigir a documentação para refletir a fonte real da sanitização.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/src/components/profile/MedicalRecordsList.tsx`

**Steps:**

- [ ] **Step 1: Garantir que a suíte existente continua verde (baseline).**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/profile/__tests__/MedicalRecordsList.test.tsx
```

Saída esperada: suíte verde (mudança é só comentário, não há novo teste a escrever — ajuste de doc).

- [ ] **Step 2: Corrigir o comentário.** Em `MedicalRecordsList.tsx`, substitua o bloco de comentário das linhas 16-20 (de `* OBS:` até `* decriptado (LGPD).`) por:

```tsx
 * OBS: `content` é HTML do Tiptap — usamos dangerouslySetInnerHTML.
 * A sanitização do HTML é feita no backend (MedicalRecordService.create/update
 * via sanitize-html) antes de persistir; aqui o conteúdo já chega seguro e
 * decriptado (LGPD). NÃO confiar no ValidationPipe para sanitização de HTML.
```

- [ ] **Step 3: Rodar a suíte novamente para confirmar que segue verde.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/profile/__tests__/MedicalRecordsList.test.tsx
```

Saída esperada: suíte verde.

- [ ] **Step 4: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/components/profile/MedicalRecordsList.tsx && git commit -m "docs(web): corrige comentário sobre origem da sanitização de HTML do prontuário"
```

---

### Task 11 — Parar de gravar PHI no localStorage (ALTO)

`MedicalRecordModal.tsx:122-123` grava o conteúdo clínico (`pending_signature_content`) no localStorage. O callback em `signature/callback/page.tsx` só lê `pending_signature_record_id` (linha 60) e apenas remove `pending_signature_content` (linha 84) — nunca o lê. É um dead-write de PHI. Remover.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/web/src/components/MedicalRecordModal.tsx`
- Test: `/root/rodrigo/hope_saude/apps/web/src/components/__tests__/MedicalRecordModal.signature.test.tsx`

**Steps:**

- [ ] **Step 1: Escrever o teste (vermelho).** Crie `/root/rodrigo/hope_saude/apps/web/src/components/__tests__/MedicalRecordModal.signature.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MedicalRecordModal } from '../MedicalRecordModal';

jest.mock('@/lib/doctor-dashboard-api', () => ({
  fetchMedicalRecords: jest.fn().mockResolvedValue([
    {
      id: 42,
      patientId: 10,
      doctorId: 5,
      appointmentId: 7,
      content: '<p>PHI sensível do paciente</p>',
      status: 'DRAFT',
      type: 'EVOLUTION',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  ]),
  createMedicalRecord: jest.fn(),
  updateMedicalRecord: jest.fn(),
  signMedicalRecord: jest.fn(),
  getLacunaAuthorizeUrl: jest.fn().mockReturnValue('https://pki.rest/authorize'),
}));

jest.mock('../RichTextEditor', () => ({
  RichTextEditor: ({ content }: { content: string }) => <div data-testid="editor">{content}</div>,
}));

describe('MedicalRecordModal — assinatura não grava PHI no localStorage', () => {
  const originalConfirm = window.confirm;
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    window.confirm = jest.fn().mockReturnValue(true);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('grava só o record_id e NÃO o conteúdo clínico ao assinar', async () => {
    render(
      <MedicalRecordModal
        isOpen
        onClose={() => {}}
        patientId={10}
        patientName="Maria"
        appointmentId={7}
      />,
    );

    const signBtn = await screen.findByText(/Assinar Digitalmente/i);
    fireEvent.click(signBtn);

    expect(localStorage.getItem('pending_signature_record_id')).toBe('42');
    expect(localStorage.getItem('pending_signature_content')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/__tests__/MedicalRecordModal.signature.test.tsx
```

Saída esperada: a asserção `expect(localStorage.getItem('pending_signature_content')).toBeNull()` falha — o componente atual ainda grava o conteúdo.

- [ ] **Step 3: Remover o dead-write de PHI.** Em `MedicalRecordModal.tsx`, apague a linha 123 inteira (`localStorage.setItem('pending_signature_content', content);`), mantendo a linha 122 que grava o `record_id`.

- [ ] **Step 4: Rodar o teste para confirmar que passa.**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest src/components/__tests__/MedicalRecordModal.signature.test.tsx
```

Saída esperada: `Tests: 1 passed`.

- [ ] **Step 5: Commit.**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/components/MedicalRecordModal.tsx apps/web/src/components/__tests__/MedicalRecordModal.signature.test.tsx && git commit -m "fix(web): para de gravar conteúdo clínico (PHI) no localStorage na assinatura"
```

---

## Self-Review

Cobertura dos gaps do escopo:

1. **IDOR vídeo** — Task 1: checagem `userId === patientId || === doctorId` com `ForbiddenException`; spec reescrito (corrige o caso vulnerável das linhas 36-66 e adiciona o 403 de terceiro, mais o caso DOCTOR). ✔
2. **Gate `/payments/:id/confirm` em produção** — Task 2: `NODE_ENV==='production'` → `ForbiddenException` no controller, com teste. ✔
3. **Exigir status real antes de criar consulta + remover try/catch otimista** — Task 3: `getPaymentStatus` deve ser RECEIVED/CONFIRMED; `receiveInSandbox` sem try/catch; `payment.service.spec.ts` linhas 125-177 substituídas. ✔
4. **Asaas fail-fast** — Task 4: construtor lança em produção sem `ASAAS_API_KEY` (espelha LacunaProvider); `isMock()` exclui produção; spec novo. ✔ + Task 5: `validationSchema` no ConfigModule (`app.module.ts:21`) garantindo `ASAAS_API_KEY`/`JWT_SECRET`/`DATA_ENCRYPTION_KEY` em produção. ✔
5. **`console.log` do RolesGuard (linha 17)** — Task 6: removido; teste garante ausência do vazamento. ✔
6. **Fallback `'dev-secret-key'` (linhas 17-19)** — Task 7: fail-fast no construtor; teste de ausência de `JWT_SECRET`. ✔
7. **CORS fail-closed** — Task 8: `parseCorsOrigins` recebe `nodeEnv` e retorna `[]` em produção sem `CORS_ORIGINS`; spec atualizado; caller em `main.ts` ajustado. ✔
8. **XSS prontuário** — Task 9: `sanitize-html` instalado no `apps/api`, sanitizador puro + integração em `create()`/`update()`; teste de remoção de `<script>`/handlers. ✔ + Task 10: comentário falso de `MedicalRecordsList.tsx:17-19` corrigido. ✔
9. **PHI no localStorage** — Task 11: remoção do `localStorage.setItem('pending_signature_content', ...)` (dead-write confirmado: callback em `page.tsx:60-84` só lê `record_id` e remove `content`, nunca o lê); teste em jsdom. ✔

Ordenação: criticais primeiro (IDOR, gate de pagamento, status real), depois altos (fail-fast Asaas/segredos, PII em log, HMAC, CORS, XSS, PHI), doc por último (Task 10).

Ausência de placeholders: todos os passos de código têm bloco real e completo; comandos `npx jest <arquivo> --no-coverage` (API) e `npx jest <arquivo>` (web) são exatos; tipos/métodos referenciados (`getPaymentStatus`, `ForbiddenException`, `AuthenticatedRequest`, `sanitizeMedicalHtml`, `buildEnvValidationSchema`) são definidos numa Task ou já existem no repo. Sem "TODO"/"implementar depois"/"similar à Task N". DRY (sanitizador único, schema único), YAGNI (sem refresh token/cookie aqui — isso é médio prazo), TDD red→green em cada Task, commits pequenos por contexto.

Pontos de atenção para o executor (validar antes de commitar):
- Task 9 Step 6: confirmar os nomes reais das variáveis de mock no `beforeEach` de `medical-record.service.spec.ts` (o bloco assume `prisma`/`cryptoService`); ajustar se diferirem.
- Task 11: o mock de `RichTextEditor` evita dependência de `@tiptap` no jsdom; confirmar o caminho do import (`'./RichTextEditor'`) bate com o usado no componente.
