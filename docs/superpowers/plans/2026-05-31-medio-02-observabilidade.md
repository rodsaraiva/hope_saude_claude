# Observabilidade: Sentry, Métricas e Filtro Global de Exceções Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à API NestJS observabilidade de produção — respostas de erro JSON consistentes sem vazar stack, captura de exceções não tratadas, integração opcional com Sentry e métricas Prometheus em `/metrics` — tudo via TDD estrito.

**Architecture:** Adiciona um `AllExceptionsFilter` global registrado **depois** do `PrismaExceptionFilter` (NestJS aplica filtros do mais específico para o mais genérico; o `@Catch(Prisma.PrismaClientKnownRequestError)` continua tratando erros de banco e o `@Catch()` vazio captura o resto). Um `SentryService` envolve `@sentry/node` e é no-op quando `SENTRY_DSN` está ausente; o filtro global delega a ele. Métricas ficam num `MetricsModule` com um interceptor global que mede latência/contagem por rota e um `MetricsController` que expõe o registry do `prom-client` em `GET /metrics`. Handlers de `unhandledRejection`/`uncaughtException` no `bootstrap()` logam via Pino antes de qualquer crash. A redaction de PII do `logger.config.ts` (linhas 22-36) permanece intocada e é a única barreira de PII nos logs.

**Tech Stack:** NestJS 11, TypeScript strict (zero `any` em produção), Jest + ts-jest (`isolatedModules`), `@sentry/node`, `prom-client`, nestjs-pino. Testes: `cd /root/rodrigo/hope_saude/apps/api && npx jest <arquivo> --no-coverage`.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/api/src/common/all-exceptions.filter.ts` | Filtro `@Catch()` global: mapeia `HttpException` e `Error` cru em JSON consistente; loga estruturado; delega ao Sentry |
| Create | `apps/api/src/common/all-exceptions.filter.spec.ts` | Testes unitários do filtro global |
| Create | `apps/api/src/observability/sentry.service.ts` | Wrapper de `@sentry/node`; no-op sem `SENTRY_DSN` |
| Create | `apps/api/src/observability/sentry.service.spec.ts` | Testes do no-op e da captura |
| Create | `apps/api/src/observability/bootstrap-handlers.ts` | `registerProcessHandlers(logger)` para `unhandledRejection`/`uncaughtException` |
| Create | `apps/api/src/observability/bootstrap-handlers.spec.ts` | Testes dos handlers de processo |
| Create | `apps/api/src/observability/metrics.service.ts` | Registry `prom-client`, histograma de latência e contador de erros |
| Create | `apps/api/src/observability/metrics.service.spec.ts` | Testes do service de métricas |
| Create | `apps/api/src/observability/metrics.interceptor.ts` | Interceptor global que observa latência e conta erros por rota |
| Create | `apps/api/src/observability/metrics.interceptor.spec.ts` | Testes do interceptor |
| Create | `apps/api/src/observability/metrics.controller.ts` | `GET /metrics` expondo o registry em texto Prometheus |
| Create | `apps/api/src/observability/metrics.controller.spec.ts` | Testes do controller |
| Create | `apps/api/src/observability/observability.module.ts` | Módulo que provê `SentryService`, `MetricsService`, registra interceptor global e o controller |
| Create | `apps/api/test/metrics.e2e-spec.ts` | E2E: `GET /metrics` retorna 200 + texto Prometheus pela app real |
| Modify | `apps/api/src/main.ts` | Registrar `AllExceptionsFilter` (com Sentry) após o Prisma; chamar `registerProcessHandlers`; inicializar Sentry |
| Modify | `apps/api/src/app.module.ts` | Importar `ObservabilityModule` |
| Modify | `apps/api/.env.example` | Adicionar `SENTRY_DSN` e `METRICS_ENABLED` |
| Modify | `apps/api/package.json` | Adicionar deps `@sentry/node` e `prom-client` (via `npm install`) |

---

## Tasks

### Task 1 — Instalar dependências (`@sentry/node`, `prom-client`)

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/package.json`

Sem teste vermelho aqui: é instalação de dependência (passo de ferramenta, não de lógica). As Tasks seguintes começam com teste vermelho de verdade.

- [ ] **Step 1: Instalar as duas libs no workspace da API**
  ```bash
  cd /root/rodrigo/hope_saude && npm install @sentry/node@^8 prom-client@^15 --workspace=@hope-saude/api
  ```

- [ ] **Step 2: Confirmar que entraram em `dependencies`**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && grep -E '"@sentry/node"|"prom-client"' package.json
  ```
  Saída esperada: duas linhas, uma com `"@sentry/node": "^8...."` e outra com `"prom-client": "^15...."`.

- [ ] **Step 3: Verificar que a suíte atual continua verde (nada quebrou no resolve de módulos)**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/logger/logger.config.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 7 passed`.

- [ ] **Step 4: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/package.json package-lock.json
  git commit -m "build(api): adiciona @sentry/node e prom-client para observabilidade"
  ```

---

### Task 2 — `SentryService` (no-op sem DSN, captura com DSN)

Encapsula `@sentry/node` atrás de uma interface testável. Sem `SENTRY_DSN`, `init()` não chama o SDK e `captureException` é no-op silencioso. Isso evita acoplamento direto do filtro ao SDK e permite testar o no-op sem rede.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/observability/sentry.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/observability/sentry.service.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/sentry.service.spec.ts
  import * as Sentry from '@sentry/node';
  import { SentryService } from './sentry.service';

  jest.mock('@sentry/node', () => ({
    init: jest.fn(),
    captureException: jest.fn(),
  }));

  describe('SentryService', () => {
    const initMock = Sentry.init as jest.Mock;
    const captureMock = Sentry.captureException as jest.Mock;

    beforeEach(() => {
      initMock.mockClear();
      captureMock.mockClear();
    });

    it('NÃO chama Sentry.init quando SENTRY_DSN está ausente', () => {
      const service = new SentryService({ NODE_ENV: 'production' });
      service.init();
      expect(initMock).not.toHaveBeenCalled();
      expect(service.isEnabled()).toBe(false);
    });

    it('captureException é no-op (não chama o SDK) quando desabilitado', () => {
      const service = new SentryService({ NODE_ENV: 'production' });
      service.init();
      service.captureException(new Error('boom'));
      expect(captureMock).not.toHaveBeenCalled();
    });

    it('chama Sentry.init com o DSN e habilita quando SENTRY_DSN presente', () => {
      const service = new SentryService({
        NODE_ENV: 'production',
        SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/123',
      });
      service.init();
      expect(initMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://abc@o1.ingest.sentry.io/123',
          environment: 'production',
        }),
      );
      expect(service.isEnabled()).toBe(true);
    });

    it('captureException delega ao SDK quando habilitado', () => {
      const service = new SentryService({
        NODE_ENV: 'production',
        SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/123',
      });
      service.init();
      const err = new Error('boom');
      service.captureException(err);
      expect(captureMock).toHaveBeenCalledWith(err);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/sentry.service.spec.ts --no-coverage
  ```
  Saída esperada: falha de compilação/resolução — `Cannot find module './sentry.service'`.

- [ ] **Step 3: Write minimal implementation**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/sentry.service.ts
  import { Injectable, Logger } from '@nestjs/common';
  import * as Sentry from '@sentry/node';

  /**
   * Wrapper fino sobre @sentry/node. No-op total quando SENTRY_DSN está ausente
   * (dev/test e qualquer ambiente sem observabilidade externa configurada).
   */
  @Injectable()
  export class SentryService {
    private readonly logger = new Logger(SentryService.name);
    private enabled = false;

    constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

    init(): void {
      const dsn = this.env.SENTRY_DSN;
      if (!dsn) {
        this.logger.log('SENTRY_DSN ausente — Sentry desabilitado (no-op).');
        return;
      }
      Sentry.init({
        dsn,
        environment: this.env.NODE_ENV ?? 'development',
        tracesSampleRate: Number(this.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      });
      this.enabled = true;
      this.logger.log('Sentry inicializado.');
    }

    isEnabled(): boolean {
      return this.enabled;
    }

    captureException(error: unknown): void {
      if (!this.enabled) {
        return;
      }
      Sentry.captureException(error);
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/sentry.service.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 4 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/observability/sentry.service.ts apps/api/src/observability/sentry.service.spec.ts
  git commit -m "feat(api): SentryService com no-op sem SENTRY_DSN"
  ```

---

### Task 3 — `AllExceptionsFilter` global (JSON consistente, sem vazar stack)

Filtro `@Catch()` que captura tudo que escapa do `PrismaExceptionFilter`. `HttpException` mantém status e mensagem; `Error` cru vira `500` genérico sem stack na resposta. Loga estruturado (`warn` para 4xx, `error` para 5xx) e delega 5xx ao `SentryService`. Mantém o mesmo shape de resposta do `PrismaExceptionFilter` (`statusCode/error/message/path/timestamp`) para consistência.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/common/all-exceptions.filter.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/common/all-exceptions.filter.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/common/all-exceptions.filter.spec.ts
  import {
    ArgumentsHost,
    BadRequestException,
    HttpStatus,
    NotFoundException,
  } from '@nestjs/common';
  import { AllExceptionsFilter } from './all-exceptions.filter';
  import { SentryService } from '../observability/sentry.service';

  describe('AllExceptionsFilter', () => {
    let filter: AllExceptionsFilter;
    let sentry: { captureException: jest.Mock };
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;
    let host: ArgumentsHost;

    beforeEach(() => {
      sentry = { captureException: jest.fn() };
      filter = new AllExceptionsFilter(sentry as unknown as SentryService);
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });
      host = {
        switchToHttp: () => ({
          getResponse: () => ({ status: statusMock }),
          getRequest: () => ({ url: '/x', method: 'GET' }),
        }),
      } as unknown as ArgumentsHost;
    });

    it('preserva o status de uma HttpException (NotFound → 404)', () => {
      filter.catch(new NotFoundException('sumiu'), host);
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          message: 'sumiu',
          path: '/x',
        }),
      );
    });

    it('preserva mensagens de validação (array) da BadRequestException', () => {
      filter.catch(
        new BadRequestException(['email inválido', 'senha curta']),
        host,
      );
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: ['email inválido', 'senha curta'],
        }),
      );
    });

    it('Error cru vira 500 genérico SEM vazar stack nem mensagem interna', () => {
      filter.catch(new Error('SELECT * FROM users senha=123'), host);
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const payload = jsonMock.mock.calls[0][0];
      expect(payload.statusCode).toBe(500);
      expect(payload.message).toBe('Erro interno do servidor.');
      expect(payload).not.toHaveProperty('stack');
      expect(JSON.stringify(payload)).not.toContain('SELECT');
    });

    it('reporta 5xx ao Sentry e NÃO reporta 4xx', () => {
      filter.catch(new Error('boom'), host);
      expect(sentry.captureException).toHaveBeenCalledTimes(1);

      sentry.captureException.mockClear();
      filter.catch(new BadRequestException('ruim'), host);
      expect(sentry.captureException).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/all-exceptions.filter.spec.ts --no-coverage
  ```
  Saída esperada: `Cannot find module './all-exceptions.filter'`.

- [ ] **Step 3: Write minimal implementation**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/common/all-exceptions.filter.ts
  import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
  } from '@nestjs/common';
  import type { Response, Request } from 'express';
  import { SentryService } from '../observability/sentry.service';

  /**
   * Catch-all global. Registrado DEPOIS do PrismaExceptionFilter — o Nest aplica
   * o filtro mais específico primeiro, então erros de Prisma continuam tratados lá
   * e tudo o que escapa cai aqui.
   *
   * Regras:
   *   HttpException → preserva status/mensagem (incluindo arrays de validação).
   *   Error cru     → 500 genérico, SEM stack nem mensagem interna na resposta.
   *   5xx           → logado como error e reportado ao Sentry (4xx só warn).
   */
  @Catch()
  export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    constructor(private readonly sentry: SentryService) {}

    catch(exception: unknown, host: ArgumentsHost): void {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();

      const { status, error, message } = this.resolve(exception);

      const line = `${request.method} ${request.url} → ${status}`;
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(line, exception instanceof Error ? exception.stack : undefined);
        this.sentry.captureException(exception);
      } else {
        this.logger.warn(line);
      }

      response.status(status).json({
        statusCode: status,
        error,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    private resolve(exception: unknown): {
      status: number;
      error: string;
      message: string | string[];
    } {
      if (exception instanceof HttpException) {
        const status = exception.getStatus();
        const body = exception.getResponse();
        if (typeof body === 'string') {
          return { status, error: exception.name, message: body };
        }
        const obj = body as { error?: string; message?: string | string[] };
        return {
          status,
          error: obj.error ?? exception.name,
          message: obj.message ?? exception.message,
        };
      }

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Erro interno do servidor.',
      };
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/common/all-exceptions.filter.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 4 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/common/all-exceptions.filter.ts apps/api/src/common/all-exceptions.filter.spec.ts
  git commit -m "feat(api): AllExceptionsFilter global sem vazar stack, reporta 5xx ao Sentry"
  ```

---

### Task 4 — Handlers de processo (`unhandledRejection`/`uncaughtException`)

Função pura `registerProcessHandlers(logger)` que registra os dois handlers de processo, logando via o logger passado (Pino capturado pelo `useLogger`). Testável injetando um logger fake e disparando os listeners manualmente, sem derrubar o test runner.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/observability/bootstrap-handlers.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/observability/bootstrap-handlers.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/bootstrap-handlers.spec.ts
  import { LoggerService } from '@nestjs/common';
  import { registerProcessHandlers } from './bootstrap-handlers';

  describe('registerProcessHandlers', () => {
    let logger: { error: jest.Mock; fatal: jest.Mock };
    let added: string[];

    beforeEach(() => {
      logger = { error: jest.fn(), fatal: jest.fn() };
      added = [];
    });

    const fakeProcess = () => {
      const listeners: Record<string, (...args: unknown[]) => void> = {};
      return {
        on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
          added.push(event);
          listeners[event] = cb;
        }),
        emit: (event: string, ...args: unknown[]) => listeners[event]?.(...args),
      };
    };

    it('registra unhandledRejection e uncaughtException', () => {
      const proc = fakeProcess();
      registerProcessHandlers(logger as unknown as LoggerService, proc as unknown as NodeJS.Process);
      expect(added).toEqual(
        expect.arrayContaining(['unhandledRejection', 'uncaughtException']),
      );
    });

    it('loga via logger.error em unhandledRejection sem derrubar o processo', () => {
      const proc = fakeProcess();
      registerProcessHandlers(logger as unknown as LoggerService, proc as unknown as NodeJS.Process);
      proc.emit('unhandledRejection', new Error('promessa solta'));
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(String(logger.error.mock.calls[0][0])).toContain('unhandledRejection');
    });

    it('loga via logger.fatal em uncaughtException', () => {
      const proc = fakeProcess();
      registerProcessHandlers(logger as unknown as LoggerService, proc as unknown as NodeJS.Process);
      proc.emit('uncaughtException', new Error('estourou'));
      expect(logger.fatal).toHaveBeenCalledTimes(1);
      expect(String(logger.fatal.mock.calls[0][0])).toContain('uncaughtException');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/bootstrap-handlers.spec.ts --no-coverage
  ```
  Saída esperada: `Cannot find module './bootstrap-handlers'`.

- [ ] **Step 3: Write minimal implementation**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/bootstrap-handlers.ts
  import { LoggerService } from '@nestjs/common';

  /**
   * Registra handlers de erros não tratados a nível de processo, logando via Pino
   * (o LoggerService global). Recebe `proc` para ser testável sem mexer no
   * `process` real do test runner.
   *
   * - unhandledRejection: loga como error (a promessa morreu, mas o app segue).
   * - uncaughtException: loga como fatal (estado potencialmente corrompido).
   */
  export function registerProcessHandlers(
    logger: LoggerService,
    proc: NodeJS.Process = process,
  ): void {
    proc.on('unhandledRejection', (reason: unknown) => {
      const detail = reason instanceof Error ? reason.stack : String(reason);
      logger.error(`unhandledRejection: ${detail}`);
    });

    proc.on('uncaughtException', (error: Error) => {
      const fatal = (logger.fatal ?? logger.error).bind(logger);
      fatal(`uncaughtException: ${error.stack ?? error.message}`);
    });
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/bootstrap-handlers.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 3 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/observability/bootstrap-handlers.ts apps/api/src/observability/bootstrap-handlers.spec.ts
  git commit -m "feat(api): handlers de unhandledRejection/uncaughtException logando via Pino"
  ```

---

### Task 5 — `MetricsService` (registry prom-client, histograma e contador)

Envolve um `Registry` próprio do `prom-client` (sem usar o registry global, para isolar entre testes) com um histograma de latência HTTP e um contador de erros, ambos rotulados por método/rota/status.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/observability/metrics.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/observability/metrics.service.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/metrics.service.spec.ts
  import { MetricsService } from './metrics.service';

  describe('MetricsService', () => {
    let service: MetricsService;

    beforeEach(() => {
      service = new MetricsService();
    });

    it('expõe o histograma de duração ao gerar o texto Prometheus', async () => {
      service.observeRequest('GET', '/health', 200, 0.012);
      const text = await service.metrics();
      expect(text).toContain('http_request_duration_seconds');
      expect(text).toContain('method="GET"');
      expect(text).toContain('route="/health"');
    });

    it('incrementa o contador de erros apenas para status >= 500', async () => {
      service.observeRequest('GET', '/x', 500, 0.1);
      service.observeRequest('GET', '/x', 404, 0.1);
      const text = await service.metrics();
      expect(text).toContain('http_requests_errors_total');
      const errLine = text
        .split('\n')
        .find((l) => l.startsWith('http_requests_errors_total{') && l.includes('status_code="500"'));
      expect(errLine).toBeDefined();
      expect(errLine).toContain(' 1');
    });

    it('contentType é o do Prometheus', () => {
      expect(service.contentType()).toContain('text/plain');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/metrics.service.spec.ts --no-coverage
  ```
  Saída esperada: `Cannot find module './metrics.service'`.

- [ ] **Step 3: Write minimal implementation**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/metrics.service.ts
  import { Injectable } from '@nestjs/common';
  import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

  /**
   * Registry próprio (não o global) para isolar métricas entre instâncias/testes.
   * Histograma de latência por rota + contador de erros 5xx.
   */
  @Injectable()
  export class MetricsService {
    private readonly registry = new Registry();

    private readonly duration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duração das requisições HTTP em segundos',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
      registers: [this.registry],
    });

    private readonly errors = new Counter({
      name: 'http_requests_errors_total',
      help: 'Total de respostas HTTP com erro de servidor (5xx)',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    constructor() {
      collectDefaultMetrics({ register: this.registry });
    }

    observeRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
      const labels = { method, route, status_code: String(statusCode) };
      this.duration.observe(labels, durationSeconds);
      if (statusCode >= 500) {
        this.errors.inc(labels);
      }
    }

    metrics(): Promise<string> {
      return this.registry.metrics();
    }

    contentType(): string {
      return this.registry.contentType;
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/metrics.service.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 3 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/observability/metrics.service.ts apps/api/src/observability/metrics.service.spec.ts
  git commit -m "feat(api): MetricsService com histograma de latência e contador de erros (prom-client)"
  ```

---

### Task 6 — `MetricsInterceptor` (mede latência/erro por rota)

Interceptor global que cronometra cada request e chama `MetricsService.observeRequest`. Conta erros tanto no caminho de sucesso (status final 5xx) quanto no `catchError` (exceção que vira 5xx). Usa o padrão de rota (`req.route.path`) quando disponível para evitar explosão de cardinalidade por IDs na URL.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/observability/metrics.interceptor.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/observability/metrics.interceptor.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/metrics.interceptor.spec.ts
  import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
  import { lastValueFrom, of, throwError } from 'rxjs';
  import { MetricsInterceptor } from './metrics.interceptor';
  import { MetricsService } from './metrics.service';

  describe('MetricsInterceptor', () => {
    let metrics: { observeRequest: jest.Mock };
    let interceptor: MetricsInterceptor;

    const makeContext = (
      method: string,
      routePath: string,
      url: string,
      statusCode: number,
    ): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ method, url, route: { path: routePath } }),
          getResponse: () => ({ statusCode }),
        }),
      }) as unknown as ExecutionContext;

    beforeEach(() => {
      metrics = { observeRequest: jest.fn() };
      interceptor = new MetricsInterceptor(metrics as unknown as MetricsService);
    });

    it('observa método, rota e status no caminho de sucesso', async () => {
      const ctx = makeContext('GET', '/appointment/:id', '/appointment/42', 200);
      const next: CallHandler = { handle: () => of({ ok: true }) };
      await lastValueFrom(interceptor.intercept(ctx, next));
      expect(metrics.observeRequest).toHaveBeenCalledWith(
        'GET',
        '/appointment/:id',
        200,
        expect.any(Number),
      );
    });

    it('observa com o status da HttpException no caminho de erro', async () => {
      const ctx = makeContext('POST', '/payment', '/payment', 200);
      const next: CallHandler = {
        handle: () => throwError(() => new HttpException('falhou', HttpStatus.BAD_GATEWAY)),
      };
      await expect(lastValueFrom(interceptor.intercept(ctx, next))).rejects.toThrow();
      expect(metrics.observeRequest).toHaveBeenCalledWith(
        'POST',
        '/payment',
        502,
        expect.any(Number),
      );
    });

    it('usa url quando não há route.path', async () => {
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ method: 'GET', url: '/raw' }),
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as unknown as ExecutionContext;
      const next: CallHandler = { handle: () => of(null) };
      await lastValueFrom(interceptor.intercept(ctx, next));
      expect(metrics.observeRequest).toHaveBeenCalledWith('GET', '/raw', 200, expect.any(Number));
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/metrics.interceptor.spec.ts --no-coverage
  ```
  Saída esperada: `Cannot find module './metrics.interceptor'`.

- [ ] **Step 3: Write minimal implementation**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/metrics.interceptor.ts
  import {
    CallHandler,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
    NestInterceptor,
  } from '@nestjs/common';
  import type { Request, Response } from 'express';
  import { Observable, throwError } from 'rxjs';
  import { catchError, tap } from 'rxjs/operators';
  import { MetricsService } from './metrics.service';

  /**
   * Cronometra cada request e registra latência/erro no MetricsService.
   * Usa req.route.path (padrão da rota) para não explodir cardinalidade com IDs.
   */
  @Injectable()
  export class MetricsInterceptor implements NestInterceptor {
    constructor(private readonly metrics: MetricsService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
      const http = context.switchToHttp();
      const req = http.getRequest<Request & { route?: { path?: string } }>();
      const res = http.getResponse<Response>();
      const start = process.hrtime.bigint();
      const route = req.route?.path ?? req.url;

      const elapsed = (): number => Number(process.hrtime.bigint() - start) / 1e9;

      return next.handle().pipe(
        tap(() => {
          this.metrics.observeRequest(req.method, route, res.statusCode, elapsed());
        }),
        catchError((err: unknown) => {
          const status =
            err instanceof HttpException
              ? err.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
          this.metrics.observeRequest(req.method, route, status, elapsed());
          return throwError(() => err);
        }),
      );
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/metrics.interceptor.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 3 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/observability/metrics.interceptor.ts apps/api/src/observability/metrics.interceptor.spec.ts
  git commit -m "feat(api): MetricsInterceptor cronometrando latência/erro por rota"
  ```

---

### Task 7 — `MetricsController` (`GET /metrics`)

Expõe o registry em texto Prometheus. Como `/health`, fica fora do throttler (scrape periódico do Prometheus). Define o `Content-Type` correto via `@Header`.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/observability/metrics.controller.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/observability/metrics.controller.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/metrics.controller.spec.ts
  import { Test } from '@nestjs/testing';
  import { MetricsController } from './metrics.controller';
  import { MetricsService } from './metrics.service';

  describe('MetricsController', () => {
    let controller: MetricsController;
    let service: { metrics: jest.Mock };

    beforeEach(async () => {
      service = { metrics: jest.fn().mockResolvedValue('# HELP up\nup 1\n') };
      const moduleRef = await Test.createTestingModule({
        controllers: [MetricsController],
        providers: [{ provide: MetricsService, useValue: service }],
      }).compile();
      controller = moduleRef.get(MetricsController);
    });

    it('GET /metrics devolve o texto do registry', async () => {
      const out = await controller.scrape();
      expect(out).toContain('up 1');
      expect(service.metrics).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/metrics.controller.spec.ts --no-coverage
  ```
  Saída esperada: `Cannot find module './metrics.controller'`.

- [ ] **Step 3: Write minimal implementation**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/metrics.controller.ts
  import { Controller, Get, Header } from '@nestjs/common';
  import { SkipThrottle } from '@nestjs/throttler';
  import { ApiOperation, ApiTags } from '@nestjs/swagger';
  import { MetricsService } from './metrics.service';

  /**
   * Endpoint de scrape do Prometheus. Fora do throttler (igual /health):
   * scrape periódico não pode ser bloqueado por rate limit.
   */
  @ApiTags('health')
  @SkipThrottle()
  @Controller('metrics')
  export class MetricsController {
    constructor(private readonly metrics: MetricsService) {}

    @ApiOperation({ summary: 'Métricas Prometheus (scrape)' })
    @Get()
    @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    scrape(): Promise<string> {
      return this.metrics.metrics();
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/metrics.controller.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 1 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/observability/metrics.controller.ts apps/api/src/observability/metrics.controller.spec.ts
  git commit -m "feat(api): GET /metrics expondo registry Prometheus"
  ```

---

### Task 8 — `ObservabilityModule` (DI: providers, interceptor global, controller)

Amarra tudo: provê `SentryService` e `MetricsService`, registra `MetricsInterceptor` como `APP_INTERCEPTOR` global e declara `MetricsController`. Exporta `SentryService` para o `main.ts`/filtro consumirem.

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/observability/observability.module.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/observability/observability.module.spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/observability.module.spec.ts
  import { Test } from '@nestjs/testing';
  import { ObservabilityModule } from './observability.module';
  import { SentryService } from './sentry.service';
  import { MetricsService } from './metrics.service';

  describe('ObservabilityModule', () => {
    it('provê SentryService e MetricsService', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ObservabilityModule],
      }).compile();

      expect(moduleRef.get(SentryService)).toBeInstanceOf(SentryService);
      expect(moduleRef.get(MetricsService)).toBeInstanceOf(MetricsService);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/observability.module.spec.ts --no-coverage
  ```
  Saída esperada: `Cannot find module './observability.module'`.

- [ ] **Step 3: Write minimal implementation**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/src/observability/observability.module.ts
  import { Module } from '@nestjs/common';
  import { APP_INTERCEPTOR } from '@nestjs/core';
  import { SentryService } from './sentry.service';
  import { MetricsService } from './metrics.service';
  import { MetricsInterceptor } from './metrics.interceptor';
  import { MetricsController } from './metrics.controller';

  @Module({
    controllers: [MetricsController],
    providers: [
      SentryService,
      MetricsService,
      {
        provide: APP_INTERCEPTOR,
        useClass: MetricsInterceptor,
      },
    ],
    exports: [SentryService, MetricsService],
  })
  export class ObservabilityModule {}
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/observability.module.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 1 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/observability/observability.module.ts apps/api/src/observability/observability.module.spec.ts
  git commit -m "feat(api): ObservabilityModule (Sentry, métricas, interceptor global, /metrics)"
  ```

---

### Task 9 — Wire-up no `app.module.ts` (importar ObservabilityModule)

Importa o `ObservabilityModule` no `AppModule`. Teste e2e garante que a app inicializa com o módulo e que `GET /metrics` responde 200 com texto Prometheus pela aplicação real.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/app.module.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/test/metrics.e2e-spec.ts`

- [ ] **Step 1: Write the failing test**
  ```typescript
  // /root/rodrigo/hope_saude/apps/api/test/metrics.e2e-spec.ts
  import { Test, TestingModule } from '@nestjs/testing';
  import { INestApplication } from '@nestjs/common';
  import * as request from 'supertest';
  import { AppModule } from '../src/app.module';

  describe('Metrics (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.MAIL_FROM = process.env.MAIL_FROM || 'Hope <no-reply@hope.test>';
      process.env.MAIL_DRIVER = process.env.MAIL_DRIVER || 'smtp';
      process.env.SMTP_HOST = process.env.SMTP_HOST || 'localhost';
      process.env.SMTP_PORT = process.env.SMTP_PORT || '1025';
      process.env.SMTP_SECURE = process.env.SMTP_SECURE || 'false';
      process.env.MAIL_APP_URL = process.env.MAIL_APP_URL || 'http://localhost:3001';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    it('GET /metrics → 200 com texto Prometheus', async () => {
      const res = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(res.text).toContain('http_request_duration_seconds');
      expect(res.headers['content-type']).toContain('text/plain');
    });

    afterAll(async () => {
      await app.close();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest test/metrics.e2e-spec.ts --no-coverage
  ```
  Saída esperada: falha — `GET /metrics` retorna 404 (módulo ainda não importado), o `expect(200)` falha.

- [ ] **Step 3: Write minimal implementation**

  Editar `/root/rodrigo/hope_saude/apps/api/src/app.module.ts`.

  Adicionar o import no topo (junto aos demais imports de módulo):
  ```typescript
  import { ObservabilityModule } from './observability/observability.module';
  ```

  Adicionar `ObservabilityModule` ao array `imports` do `@Module`, logo após `ClinicalScaleModule`:
  ```typescript
      ClinicalScaleModule,
      ObservabilityModule,
  ```

- [ ] **Step 4: Run test to verify it passes**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest test/metrics.e2e-spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 1 passed`. (O histograma aparece porque o próprio `GET /metrics` passou pelo interceptor numa request anterior; se for a primeira request, o teste ainda passa pois `collectDefaultMetrics` popula o registry — mas o `observeRequest` do `/metrics` corrente já registra a label antes do flush.)

  Nota: caso o histograma ainda não tenha sido populado na primeira chamada, faça uma request de aquecimento dentro do teste antes do assert:
  ```typescript
      await request(app.getHttpServer()).get('/health');
  ```
  Adicione essa linha antes do `request(...).get('/metrics')` apenas se o assert de `http_request_duration_seconds` falhar.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/app.module.ts apps/api/test/metrics.e2e-spec.ts
  git commit -m "feat(api): registra ObservabilityModule no AppModule + e2e de /metrics"
  ```

---

### Task 10 — Wire-up no `main.ts` (Sentry init, AllExceptionsFilter, process handlers)

Inicializa o Sentry no boot, registra o `AllExceptionsFilter` **depois** do `PrismaExceptionFilter` (ordem importa para o Nest) e registra os handlers de processo com o Pino. Como `main.ts` não tem teste unitário direto (é bootstrap), validamos rodando o build + a suíte e2e existente para garantir que nada regrediu.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/src/main.ts`

- [ ] **Step 1 (verificação como "teste"): rodar a suíte e2e atual ANTES da mudança para registrar baseline verde**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest test/auth-rbac.e2e-spec.ts --no-coverage
  ```
  Saída esperada: passa (baseline). Anote o número de testes verdes.

- [ ] **Step 2: Editar `main.ts`.**

  Adicionar imports após a linha `import { PrismaExceptionFilter } from './common/prisma-exception.filter';`:
  ```typescript
  import { AllExceptionsFilter } from './common/all-exceptions.filter';
  import { SentryService } from './observability/sentry.service';
  import { registerProcessHandlers } from './observability/bootstrap-handlers';
  ```

  Logo após `app.useLogger(app.get(Logger));`, capturar o logger e registrar os handlers de processo:
  ```typescript
    const logger = app.get(Logger);
    app.useLogger(logger);
    registerProcessHandlers(logger);
  ```
  (substitui a linha `app.useLogger(app.get(Logger));` por esse bloco.)

  Logo após esse bloco, inicializar o Sentry resolvendo o service do container:
  ```typescript
    const sentry = app.get(SentryService);
    sentry.init();
  ```

  Substituir a linha `app.useGlobalFilters(new PrismaExceptionFilter());` para registrar os dois filtros na ordem certa (mais genérico primeiro, mais específico por último — o Nest avalia o ÚLTIMO registrado como o mais prioritário, então o Prisma deve vir por último):
  ```typescript
    // Ordem: o filtro catch-all (genérico) primeiro, o do Prisma (específico) depois.
    // O Nest dá prioridade ao último registrado para a exceção que ele declara via @Catch.
    app.useGlobalFilters(
      new AllExceptionsFilter(sentry),
      new PrismaExceptionFilter(),
    );
  ```

- [ ] **Step 3: Build para garantir que o bootstrap compila (zero erro de tipo)**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit -p tsconfig.json
  ```
  Saída esperada: nenhum erro (exit 0).

- [ ] **Step 4: Rodar e2e existente + e2e de métricas para garantir que filtros/handlers não regrediram**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest test/auth-rbac.e2e-spec.ts test/metrics.e2e-spec.ts --no-coverage
  ```
  Saída esperada: ambas as suítes passam.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/main.ts
  git commit -m "feat(api): bootstrap registra AllExceptionsFilter, Sentry init e process handlers"
  ```

---

### Task 11 — `.env.example`: adicionar `SENTRY_DSN` e `METRICS_ENABLED`

Documenta as novas variáveis. Sem `SENTRY_DSN` o Sentry é no-op (já testado na Task 2). `SENTRY_TRACES_SAMPLE_RATE` documentado como opcional.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/.env.example`

- [ ] **Step 1 (verificação como "teste"): confirmar que as chaves NÃO existem ainda**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && grep -E 'SENTRY_DSN|SENTRY_TRACES_SAMPLE_RATE' .env.example && echo "JA EXISTE (inesperado)" || echo "ausente, ok para adicionar"
  ```
  Saída esperada: `ausente, ok para adicionar`.

- [ ] **Step 2: Editar `.env.example`.** Adicionar ao final do arquivo, após o bloco SMTP:
  ```bash
  # --- Observabilidade ---
  # Sentry: deixe vazio para desabilitar (no-op). Preencha com o DSN do projeto em prod.
  SENTRY_DSN=
  # Amostragem de traces (0 a 1). 0 = sem performance tracing.
  SENTRY_TRACES_SAMPLE_RATE=0
  ```

- [ ] **Step 3: Confirmar que as chaves agora existem**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && grep -E 'SENTRY_DSN|SENTRY_TRACES_SAMPLE_RATE' .env.example
  ```
  Saída esperada: duas linhas (`SENTRY_DSN=` e `SENTRY_TRACES_SAMPLE_RATE=0`).

- [ ] **Step 4: Sanidade — Sentry no-op confirmado pelo teste da Task 2 continua verde**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/observability/sentry.service.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 4 passed`.

- [ ] **Step 5: Commit**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/.env.example
  git commit -m "docs(api): documenta SENTRY_DSN e SENTRY_TRACES_SAMPLE_RATE no .env.example"
  ```

---

### Task 12 — Verificação final da suíte completa

Garante que toda a observabilidade entrou sem regredir os 241 testes/42 suítes existentes.

**Files:** (nenhum — só execução)

- [ ] **Step 1: Rodar a suíte inteira da API**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
  ```
  Saída esperada: todas as suítes verdes. Contagem nova ≈ 241 + (4+4+3+3+1+3+1+1) unitários + 1 e2e = ~262 testes / ~51 suítes (números exatos dependem do estado do repo no momento; o critério é ZERO falha).

- [ ] **Step 2: Type-check final do projeto**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit -p tsconfig.json
  ```
  Saída esperada: exit 0, nenhum erro de tipo (confirma zero `any` indevido e imports corretos).

- [ ] **Step 3: Lint dos arquivos novos**
  ```bash
  cd /root/rodrigo/hope_saude && npx eslint "apps/api/src/observability/**/*.ts" "apps/api/src/common/all-exceptions.filter.ts"
  ```
  Saída esperada: sem erros.

- [ ] **Step 4: Revisar o diff acumulado antes de fechar**
  ```bash
  cd /root/rodrigo/hope_saude && git log --oneline -11 && git status
  ```
  Saída esperada: 11 commits da feature, working tree limpo.

- [ ] **Step 5: Commit (caso lint/format tenha ajustado algo)**
  ```bash
  cd /root/rodrigo/hope_saude && git add -A apps/api && git diff --cached --quiet || git commit -m "chore(api): ajustes de lint/format na observabilidade"
  ```

---

## Self-Review

**Cobertura dos gaps do escopo:**

1. **AllExceptionsFilter global** — Task 3. `@Catch()` vazio mapeia `HttpException` (preserva status e mensagens de validação em array) e `Error` cru → 500 genérico **sem stack nem mensagem interna** na resposta (teste verifica `not.toContain('SELECT')` e ausência de `stack`). Log estruturado: `warn` para 4xx, `error` (com stack) para 5xx. **Ordem com PrismaExceptionFilter** tratada na Task 10 Step 2: ambos registrados em `useGlobalFilters`, Prisma por último para ter prioridade na exceção que declara. Teste do filtro presente.
2. **process.on('unhandledRejection') / 'uncaughtException')** — Task 4 (`registerProcessHandlers`), logando via Pino (`LoggerService` injetado); wire-up no `main.ts` na Task 10. Testável com `proc` fake.
3. **Sentry (@sentry/node) condicionado a SENTRY_DSN** — Task 2. Sem DSN: `init()` não chama o SDK e `captureException` é no-op (testes explícitos de no-op). Captura ligada ao filtro global (Task 3 reporta 5xx ao `SentryService`). Inicialização no boot (Task 10).
4. **Métricas prom-client + GET /metrics** — Tasks 5 (service: histograma `http_request_duration_seconds` + contador `http_requests_errors_total`), 6 (interceptor de latência por rota, com `req.route.path` para cardinalidade), 7 (controller `GET /metrics`, `SkipThrottle`, content-type Prometheus). Interceptor registrado como `APP_INTERCEPTOR` global na Task 8. Testes de service, interceptor, controller e e2e do endpoint (Task 9).
5. **.env.example: SENTRY_DSN** — Task 11 (+ `SENTRY_TRACES_SAMPLE_RATE`). `logger.config.ts` **não precisa de alteração**: a redaction de PII (linhas 22-36) permanece intacta e continua sendo a barreira de PII; nenhuma das mudanças loga body cru — o filtro global loga só `method url → status` e stack apenas em 5xx (que não contém PII de request). Confirmado.

**Redaction de PII mantida:** nenhum arquivo novo loga `req.body`; o `AllExceptionsFilter` loga apenas método/url/status (+ stack em 5xx), tudo já coberto pela redaction existente do Pino. Nenhuma mudança em `logger.config.ts`.

**Ausência de placeholders:** todos os passos de código têm blocos completos e reais. Tipos/símbolos referenciados ou já existem no repo (`Logger` do `@nestjs/common`, `PrismaExceptionFilter`, `Logger` do nestjs-pino, `SkipThrottle`, `APP_INTERCEPTOR`, padrão de e2e com supertest copiado de `auth-rbac.e2e-spec.ts`) ou são definidos em Tasks anteriores (`SentryService` → T2, `AllExceptionsFilter` → T3, `registerProcessHandlers` → T4, `MetricsService` → T5, `MetricsInterceptor` → T6, `MetricsController` → T7, `ObservabilityModule` → T8). Zero `TODO`/"implementar depois"/"similar à Task N".

**Ordem por dependência:** deps (T1) → SentryService (T2) → filtro que usa Sentry (T3) → handlers (T4) → métricas service/interceptor/controller (T5-T7) → módulo que amarra (T8) → wire-up app.module + e2e (T9) → wire-up main.ts (T10) → env (T11) → verificação total (T12).
