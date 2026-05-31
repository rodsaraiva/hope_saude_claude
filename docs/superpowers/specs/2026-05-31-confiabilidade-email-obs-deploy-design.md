# Confiabilidade: E-mail/Outbox, Reset, Observabilidade e Deploy — Design Spec

Data: 2026-05-31
Autor: Auditoria técnica Hope Saúde
Tipo: design spec (horizonte: spec; alimenta planos médio/curto prazo)
Escopo: `apps/api` (NestJS 11 + Prisma 5/SQLite) e infraestrutura de deploy.

---

## 1. Contexto / Problema

A API entrega 241 testes verdes em 42 suítes, mas a auditoria encontrou um conjunto de gaps de **confiabilidade operacional** que não aparecem nos testes unitários porque dependem de tempo, processo (cron/worker), processo de boot e ambiente de produção. Os achados, com arquivo:linha:

### 1.1. EmailOutbox sem worker — envio inline que engole erro (ALTO)
`apps/api/src/notifications/notifications.service.ts:57-89` — o método privado `deliver()` cria a linha `PENDING` no outbox (`outbox.createPending`, linha 64) e, **na mesma requisição HTTP**, chama `provider.send()` (linha 71). Em caso de exceção do provider (Postmark/SMTP fora do ar, rate limit, DNS), o erro é capturado (linha 79), logado e a linha vira `FAILED` (linha 87) — e **nunca mais é reprocessada**. O outbox vira um cemitério: o padrão "outbox" foi modelado no schema (campos `attempts`, `status`, índice `@@index([status, createdAt])` em `prisma/schema.prisma:195-211`) mas **não há nenhum consumidor**. `apps/api/src/notifications/outbox/email-outbox.repository.ts:1-50` só expõe `createPending`, `markSent`, `markFailed` — **não há `findMany` por status**, logo nenhum worker conseguiria pegar pendentes mesmo que existisse. `ScheduleModule.forRoot()` já está montado em `app.module.ts`, então a infra de `@Cron` existe e está ociosa.

Consequência: e-mail de reset de senha some silenciosamente quando o provider hiccup; o usuário fica travado fora da conta. Em telepsiquiatria isso é bloqueio de acesso ao cuidado.

### 1.2. Fluxo reset/verify pela metade — token emitido, nunca consumido (ALTO)
`apps/api/src/auth/auth.service.ts:100-146` — `requestPasswordReset()` e `requestEmailVerification()` **apenas emitem** o token: geram `randomBytes(32)`, gravam o `sha256` em `PasswordResetToken`/`EmailVerificationToken` (linhas 110, 134) e disparam o e-mail. **Não existe endpoint de consumo.** `auth.controller.ts:48-62` só tem `forgot-password` e `verify-email/request` (os emissores). Os campos `usedAt` e `expiresAt` (schema linhas 218, 217, 230, 229) **nunca são lidos** — a senha nunca é trocada de fato e o token nunca é marcado como usado. O fluxo é uma porta sem fechadura do outro lado.

Consequência: a feature de reset de senha está incompleta e não funcional ponta a ponta. Se um endpoint de consumo for adicionado sem cuidado, abre risco de replay (token single-use não enforced) e de troca de senha sem validar expiração.

### 1.3. Sem filtro global de exceção, sem Sentry/APM, sem métricas (ALTO)
`apps/api/src/main.ts:34` registra **apenas** `PrismaExceptionFilter`. Qualquer erro não-Prisma (TypeError, falha de I/O, bug de lógica) cai no exception handler default do Nest → 500 genérico, sem captura externa. **Não há `AllExceptionsFilter`**, não há handlers de `process.on('unhandledRejection')`/`'uncaughtException')`, não há Sentry (ausente das deps — confirmado em `apps/api/package.json`), não há `/metrics` (sem `prom-client`). O logger estruturado (`common/logger/logger.config.ts`) já existe e já faz redaction de PHI/secrets, mas log estruturado sem agregação de erro e sem métricas = cego em produção.

### 1.4. Deploy sem migrations — /health verde com schema ausente (CRÍTICO/ALTO)
`apps/api/Dockerfile:36` — `CMD ["node", "dist/main.js"]`. **Não roda `prisma migrate deploy`** antes de subir. O único script de migration em `apps/api/package.json:8` é `"prisma:migrate": "prisma migrate dev"`, que é **proibido em produção** (cria migrations, pede confirmação interativa, usa shadow DB). Existe uma migration aplicada (`prisma/migrations/20260408141426_add_email_outbox_and_auth_tokens`), mas nada garante que ela rode no volume de produção. Pior: o `/health` (`health/health.controller.ts:30-42`) faz `SELECT 1`, que **passa mesmo num banco vazio sem tabelas** → o healthcheck do `docker-compose.prod.yml:24` dá verde, o Traefik roteia tráfego, e os endpoints retornam 500 silenciosos (`no such table`). Healthcheck que mente é pior que não ter healthcheck.

### 1.5. SQLite em produção sem backup (CRÍTICO)
`docker-compose.prod.yml:19-20` — bind mount `/opt/hope_saude/data:/app/prisma` com `replicas: 1` (linha 30). O banco é um arquivo único num host, sem réplica, sem snapshot, sem WAL configurado. `prisma.service.ts:1-13` só faz `$connect()`/`$disconnect()` — **não aplica PRAGMA** algum (`journal_mode=WAL`, `busy_timeout`). Sob concorrência o SQLite em modo default (DELETE journal, sem busy_timeout) dá `SQLITE_BUSY`; sem backup, um corrompimento de arquivo = perda total de prontuários, receitas e dados de pacientes (PHI). Risco LGPD e clínico máximo.

### 1.6. CI sem type-check (MÉDIO)
`.github/workflows/ci.yml:33-37,61-65` — o pipeline roda **só** `eslint` + `jest` por workspace. Como o projeto usa `ts-jest` com `isolatedModules` (cada arquivo transpilado isolado), **erros de tipo cross-file não quebram os testes**. `tsc --noEmit`/`build` nunca roda no CI. A única rede de segurança de tipos hoje é o `docker build` (que roda `nest build` no Dockerfile linha 19) — mas só no deploy, tarde demais.

### 1.7. Decisões de arquitetura já firmadas (pano de fundo)
- **Banco**: hardening SQLite (WAL + busy_timeout + backup) no CURTO como stopgap; PostgreSQL no MÉDIO. A migração Postgres é tratada em `spec-data` (out of scope aqui — esta spec só cobre o stopgap operacional do SQLite).
- **Pagamento / Auth front**: out of scope desta spec.

---

## 2. Objetivos e Não-objetivos

### Objetivos
1. **Entrega de e-mail resiliente**: `deliver()` apenas persiste `PENDING`; um worker `@Cron` reprocessa `PENDING`/`FAILED` com `attempts < N` e backoff exponencial, marcando `SENT`/`FAILED` de forma idempotente.
2. **Fluxo reset/verify completo e seguro**: endpoints `POST /auth/reset-password` e `POST /auth/verify-email` que consomem o token (lookup por SHA-256, valida `expiresAt > now` e `usedAt == null`), trocam senha (bcrypt) em transação, marcam `usedAt` (single-use) e invalidam tokens anteriores do mesmo usuário; tudo sob throttle.
3. **Observabilidade**: `AllExceptionsFilter` global, handlers de `unhandledRejection`/`uncaughtException`, integração Sentry e `/metrics` (prom-client).
4. **Deploy confiável**: `prisma migrate deploy` no entrypoint + script `prisma:deploy`; `/health` que detecta schema ausente (não só conectividade).
5. **Backup SQLite no curto prazo**: PRAGMA WAL + busy_timeout no `PrismaService` e replicação/snapshot off-host (Litestream ou cron).
6. **CI com type-check**: `tsc --noEmit` (ou `build`) por workspace no pipeline.

### Não-objetivos
- Migração para PostgreSQL (médio prazo, `spec-data`).
- Webhook Asaas idempotente / reconciliação de pagamento (`spec`/plano de pagamento).
- Endurecimento de auth no front (cookie HttpOnly, DOMPurify).
- Fila externa (Redis/BullMQ): o `@Cron` + outbox no banco é suficiente para o volume atual; fila dedicada fica para quando migrar a Postgres.
- Distributed tracing completo (OpenTelemetry): só erro (Sentry) + métricas básicas (prom-client) nesta fase.

---

## 3. Decisões de design

### D1 — Outbox worker via @Cron, `deliver()` só grava PENDING
**Decisão**: separar responsabilidades (SRP). `NotificationsService.deliver()` passa a **apenas** chamar `outbox.createPending()` e retornar — não envia mais inline. Um novo `OutboxWorker` (provider com `@Cron`) roda a cada N segundos:
1. Busca lote via novo `EmailOutboxRepository.findDeliverable(limit)`: linhas com `status IN ('PENDING','FAILED')` e `attempts < MAX_ATTEMPTS`, ordenadas por `createdAt` (usa o índice `[status, createdAt]` já existente).
2. Para cada linha aplica backoff: só processa se `now >= lastAttemptAt + base * 2^(attempts)` (cap em teto, ex. 1h). Como hoje só há `failedAt`/`sentAt`, adicionamos cálculo de "próxima tentativa" a partir de `failedAt` e `attempts`.
3. Renderiza o template e chama `provider.send()`. Em sucesso → `markSent`; em falha → `markFailed` (que já incrementa `attempts`).

**Persistência do corpo**: `createPending` hoje só grava `to/subject/tag` — **não o HTML/texto**. Para o worker enviar depois, o corpo precisa estar disponível. Duas alternativas:
- **(A) Re-render no worker**: gravar `tag` + um `payload` JSON (string, p/ SQLite) com os parâmetros de render (`userName`, `resetUrl`/`verifyUrl`), e o worker re-renderiza pelo `tag`. Mantém o outbox enxuto, evita HTML grande no banco. **Escolhida.**
- (B) Gravar `htmlBody`/`textBody` direto na linha. Rejeitada: incha o banco SQLite (arquivo único, sem backup robusto) e duplica conteúdo já derivável do payload.

Isso exige **um campo novo** `payload String?` em `EmailOutbox` (migration). O `tag` ('password-reset' | 'email-verification') vira o discriminador que escolhe o template no worker.

**Idempotência**: o worker é o único que transiciona `PENDING→SENT`. Se um envio teve sucesso no provider mas o processo morreu antes de `markSent`, a linha continua `PENDING` e será reenviada (em-most-once não é garantido; **at-least-once** é o contrato — aceitável para e-mail transacional). Para reduzir duplicata, o worker processa em `runInBand` lógico (lote sequencial) e o índice único de provider message não é necessário nesta fase.

**Constantes**: `OUTBOX_MAX_ATTEMPTS` (default 5), `OUTBOX_CRON` (default a cada 30s via `@Cron(CronExpression.EVERY_30_SECONDS)` ou `EVERY_MINUTE`), `OUTBOX_BACKOFF_BASE_MS`. Configuráveis via `ConfigService`.

### D2 — Endpoints de consumo reset/verify com single-use transacional
**Decisão**: dois endpoints novos no `AuthController`, espelhando o estilo dos existentes (Throttle `auth`, `@HttpCode`):

```
POST /auth/reset-password   body: { token: string, newPassword: string }  -> 204
POST /auth/verify-email     body: { token: string }                        -> 204
```

Novos DTOs em `apps/api/src/auth/dto/`: `ResetPasswordDto` (`token` `@IsString @IsNotEmpty`; `newPassword` com a **mesma policy do `RegisterDto`** — reusar o validator de senha existente em `register.dto.ts`) e `VerifyEmailDto` (`token`).

Lógica no `AuthService` (segue o padrão de hashing já usado nas linhas 106-107: `createHash('sha256').update(token).digest('hex')`):

`resetPassword(token, newPassword)`:
1. `tokenHash = sha256(token)`; `findUnique({ where: { tokenHash } })` em `passwordResetToken`.
2. Se não achar, ou `usedAt != null`, ou `expiresAt <= now` → `BadRequestException('Token inválido ou expirado')`. **Mensagem genérica** (não vazar se token existe).
3. `prisma.$transaction`:
   - `user.update({ data: { password: await bcrypt.hash(newPassword, 10) } })`;
   - `passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } })` (single-use);
   - `passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } })` (**invalida tokens anteriores** do mesmo user — anti-replay).
4. (Opcional) emitir evento/log para futura invalidação de sessões JWT — fora de escopo (JWT é stateless hoje).

`verifyEmail(token)`: idêntico, mas marca o usuário como verificado. **Achado de modelo**: o `User` (schema linhas 10-30) **não tem campo `emailVerifiedAt`/`isEmailVerified`**. Decisão: adicionar `emailVerifiedAt DateTime?` ao `User` (migration), setado dentro da transação; o token vira `usedAt`. Alternativa rejeitada: não persistir verificação (apenas marcar token usado) — inútil, pois nada poderia consumir o estado "verificado".

**Throttle**: `@Throttle({ auth: { limit: 5, ttl: 60_000 } })` igual ao `forgot-password` (controller linha 49) — limita brute-force de token.

**Por que transação**: trocar senha e marcar token usado precisam ser atômicos; senão, falha entre os dois deixa senha trocada com token ainda válido (replay) ou token queimado sem senha nova (usuário travado).

### D3 — AllExceptionsFilter + process handlers + Sentry + /metrics
**Decisão**:
- `AllExceptionsFilter implements ExceptionFilter` (catch-all com `@Catch()` sem args) registrado em `main.ts` **depois** do `PrismaExceptionFilter` (ordem: Nest aplica filtros do mais específico para o mais genérico; o catch-all é o fallback). Loga via Pino (já injetável), responde shape consistente `{ statusCode, message, timestamp, path }`, e **captura no Sentry** os 5xx. Não vaza stack/detalhe interno ao cliente em produção.
- **Process handlers** em `main.ts` (ou módulo dedicado): `process.on('unhandledRejection')` e `process.on('uncaughtException')` → logam estruturado + `Sentry.captureException` + `flush`. Em `uncaughtException` o processo deve encerrar após flush (estado indefinido) — o `restart_policy: on-failure` do Swarm o ressobe.
- **Sentry**: `@sentry/node`, init no boot **só se `SENTRY_DSN` presente** (sem DSN → no-op, mantém dev/test limpos). Adicionar `@sentry/node` às deps da API.
- **/metrics**: `prom-client` com `collectDefaultMetrics()` + contadores customizados (ex.: `email_outbox_sent_total`, `email_outbox_failed_total`, `http_requests_total` por rota/status). Endpoint `GET /metrics` em `MetricsController` com `@SkipThrottle()` (igual ao health, controller linha 15) e **protegido** (rede interna / token / `X-Metrics-Token`) para não expor métricas publicamente via Traefik. Adicionar `prom-client` às deps.

**Alternativa rejeitada**: APM completo (Datadog/New Relic/OTel) — custo e complexidade desproporcionais ao estágio; Sentry (erros) + prom-client (métricas) cobrem 90% do valor agora.

### D4 — `prisma migrate deploy` no boot + /health honesto
**Decisão**:
- Adicionar script `"prisma:deploy": "prisma migrate deploy"` em `apps/api/package.json` (não-interativo, sem shadow DB, idempotente — aplica só migrations pendentes).
- **Entrypoint**: criar `apps/api/docker-entrypoint.sh` que roda `npx prisma migrate deploy` e então `exec node dist/main.js`. Dockerfile passa de `CMD ["node", "dist/main.js"]` para `ENTRYPOINT ["./docker-entrypoint.sh"]`. O entrypoint precisa do CLI `prisma` no runtime stage (hoje o stage `runtime` copia `node_modules` inteiro do builder — confirmar que `prisma` está lá; se devDep não vier, copiar o binário ou rodar via `node_modules/.bin/prisma`).
- **/health honesto**: além do `SELECT 1`, validar que o schema existe — ex.: `SELECT 1 FROM User LIMIT 1` ou `prisma.$queryRaw` numa tabela-chave, ou checar `_prisma_migrations` (nº de migrations aplicadas > 0). Decisão: query leve numa tabela real do domínio (`SELECT count(*) FROM _prisma_migrations`) → se falhar/zero, `status: down`. Assim o Traefik não roteia para instância com schema ausente.

**Alternativa rejeitada**: rodar migrate como job separado (init container). Em Swarm com `replicas: 1` e bind mount, o entrypoint inline é mais simples e suficiente; init container vira relevante só com múltiplas réplicas (race de migration) — endereçado quando migrar a Postgres.

### D5 — Hardening SQLite (stopgap curto prazo)
**Decisão** (curto prazo, até a migração Postgres):
- **PRAGMA no `PrismaService.onModuleInit()`**: após `$connect()`, executar `PRAGMA journal_mode = WAL;` e `PRAGMA busy_timeout = 5000;` via `$executeRawUnsafe`. WAL melhora concorrência leitura/escrita; busy_timeout evita `SQLITE_BUSY` imediato sob contenção.
- **Backup off-host**: preferir **Litestream** (replicação contínua do WAL para object storage/host remoto, RPO ~segundos) rodando como sidecar/processo no host; alternativa de menor esforço = **cron de snapshot** (`sqlite3 .backup` ou cópia consistente do arquivo + WAL) para fora do volume, com retenção. Decisão: documentar Litestream como preferido; cron como fallback mínimo se Litestream não puder subir no Swarm.
- Detalhe importante: WAL cria arquivos `-wal`/`-shm` ao lado do `.db`; o bind mount `/opt/hope_saude/data` precisa abrigá-los (já abriga, pois aponta para `/app/prisma`).

**Nota**: este é stopgap explícito. A solução definitiva (Postgres) está em `spec-data`. Não investir em ferramental SQLite além do necessário para reduzir risco de perda de dados agora.

### D6 — CI type-check por workspace
**Decisão**: adicionar step `tsc --noEmit` (ou `nest build`) no job `api` e `tsc --noEmit`/`next build` no job `web` do `.github/workflows/ci.yml`, após o lint e antes/junto dos testes. Como `ts-jest` usa `isolatedModules`, o `tsc --noEmit` é a única checagem de tipos cross-file no CI. Reusa o `tsconfig` de cada workspace. Não duplica o que o `docker build` faz — antecipa a falha para o PR.

---

## 4. Mudanças de modelo de dados / interfaces

### 4.1. Prisma schema (migration nova)
```prisma
model EmailOutbox {
  // ... campos atuais ...
  payload      String?   // JSON com params de render (userName, resetUrl/verifyUrl) — re-render por tag no worker
  lastAttemptAt DateTime? // base para cálculo de backoff (deriva de failedAt hoje; explicitar)
  // índice [status, createdAt] já existe e serve ao worker
}

model User {
  // ... campos atuais ...
  emailVerifiedAt DateTime?  // setado por verifyEmail()
}
```
(Migration aplicada via `prisma migrate dev` em dev e `prisma migrate deploy` em prod — D4.)

### 4.2. `EmailOutboxRepository` (novos métodos)
```ts
// findDeliverable: lote de PENDING/FAILED com attempts < max, ordenado por createdAt
findDeliverable(limit: number, maxAttempts: number): Promise<EmailOutboxRow[]>
// createPending passa a aceitar payload
createPending(input: { to; subject; tag; payload?: string }): Promise<string>
```
`markSent`/`markFailed` permanecem (já incrementam `attempts`).

### 4.3. `NotificationsService.deliver()` (mudança de comportamento)
Passa a só `createPending` (com `payload`); remove o `provider.send()` inline e o try/catch de envio. O envio migra para o `OutboxWorker`.

### 4.4. `OutboxWorker` (novo provider em `notifications/`)
```ts
@Injectable()
export class OutboxWorker {
  constructor(
    private readonly outbox: EmailOutboxRepository,
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
    private readonly config: ConfigService,
  ) {}
  @Cron(CronExpression.EVERY_30_SECONDS)
  async processOutbox(): Promise<void> { /* findDeliverable → backoff → render → send → markSent/markFailed */ }
}
```

### 4.5. `AuthService` (novos métodos)
```ts
resetPassword(token: string, newPassword: string): Promise<void>   // 204
verifyEmail(token: string): Promise<void>                          // 204, set User.emailVerifiedAt
```
Reusam `createHash('sha256')`, `bcrypt.hash`, `prisma.$transaction`. Lançam `BadRequestException` (mensagem genérica) em token inválido/expirado/usado.

### 4.6. `AuthController` (novas rotas) + DTOs
`POST /auth/reset-password` (`ResetPasswordDto`), `POST /auth/verify-email` (`VerifyEmailDto`), ambos `@Throttle({ auth: {...} })`, `@HttpCode(204)`. DTOs com `class-validator` + `@ApiProperty`.

### 4.7. Filtros / observabilidade
- `apps/api/src/common/all-exceptions.filter.ts` (`AllExceptionsFilter`), registrado em `main.ts` após `PrismaExceptionFilter`.
- `apps/api/src/observability/` (ou similar): init Sentry, process handlers, `MetricsController` (`GET /metrics`, `@SkipThrottle`).
- Deps novas: `@sentry/node`, `prom-client`.

### 4.8. Infra
- `apps/api/package.json`: + `"prisma:deploy": "prisma migrate deploy"`.
- `apps/api/docker-entrypoint.sh`: `npx prisma migrate deploy && exec node dist/main.js`.
- `apps/api/Dockerfile`: copiar entrypoint, `ENTRYPOINT ["./docker-entrypoint.sh"]`.
- `apps/api/src/prisma.service.ts`: PRAGMA WAL + busy_timeout no `onModuleInit`.
- `health.controller.ts`: ping de schema (`_prisma_migrations`), não só `SELECT 1`.
- `.github/workflows/ci.yml`: step `tsc --noEmit`/build por workspace.
- `docker-compose.prod.yml` / docs de deploy: instruções de backup (Litestream/cron).

---

## 5. Considerações de segurança / LGPD

- **Tokens de reset/verify**: nunca logados (Pino já redige `*.access_token`; garantir que `token` do body de reset entre na lista de redaction — adicionar `req.body.token`/`req.body.newPassword` ao `redact.paths` em `logger.config.ts`). Lookup por `sha256` (token em claro nunca persiste). Single-use + expiração + invalidação dos anteriores fecham replay.
- **Mensagens genéricas**: `forgot-password`/`verify-email/request` já não revelam se o e-mail existe (`auth.service.ts:102-104`); os novos endpoints de consumo devem manter mensagem genérica ("Token inválido ou expirado") para não permitir enumeração.
- **Throttle**: reset/verify sob `auth` throttler (limite 5/min) para mitigar brute-force de token de 32 bytes (já praticamente inviável, mas defesa em profundidade).
- **/metrics**: não expor publicamente — métricas vazam volume/timing que ajudam atacante. Proteger por token/rede interna; **não** adicionar router Traefik público para `/metrics`.
- **Sentry e PHI**: scrubbing obrigatório — configurar `beforeSend` para remover body/headers sensíveis (CPF, e-mail de paciente, conteúdo de prontuário). O Sentry não pode receber PHI. Reusar a lista de campos já redigida no Pino.
- **Backup SQLite (LGPD)**: o backup off-host carrega PHI (prontuários, CPF) → destino criptografado em repouso e com controle de acesso; documentar retenção e que o backup entra no escopo de eliminação/anonimização LGPD (médio prazo, `spec-data`).
- **Migrate no boot**: `prisma migrate deploy` só aplica migrations versionadas (sem `--accept-data-loss`); nenhum DDL destrutivo automático.

---

## 6. Plano de rollout / risco

**Ordem recomendada** (menor risco primeiro, cada item testável isoladamente em TDD):

1. **D4 (deploy/migrations) + /health honesto** — CRÍTICO e barato. Sem ele, qualquer outra entrega pode subir num banco sem schema. Risco baixo (entrypoint + script). Reversível (voltar CMD).
2. **D5 (PRAGMA + backup)** — CRÍTICO p/ não perder dados. PRAGMA é mudança mínima no `PrismaService`; backup é operacional (Litestream/cron), não toca código de app.
3. **D6 (CI type-check)** — rede de segurança; habilita as próximas mudanças com confiança. Zero risco em prod.
4. **D1 (outbox worker)** — mudança de comportamento em `deliver()`. Risco: e-mail deixa de ser inline (latência some da request, mas entrega passa a ter delay de até 1 ciclo de cron). Mitigar com cron curto (30s) e testes do worker (backoff, maxAttempts, idempotência).
5. **D2 (endpoints reset/verify)** — feature nova, aditiva (não quebra nada existente). Depende de D1 estar de pé para o e-mail de reset realmente chegar.
6. **D3 (observabilidade)** — aditivo. Sentry/metrics no-op sem env. `AllExceptionsFilter` é o de maior cuidado (não pode mascarar o `PrismaExceptionFilter` — validar ordem e que P2025→404 continua).

**Riscos transversais**:
- `AllExceptionsFilter` capturando o que era do `PrismaExceptionFilter` → teste e2e dos mapeamentos P2025/P2002/P2003 deve continuar verde.
- WAL + bind mount: garantir que `-wal`/`-shm` persistam no volume (senão checkpoint/backup inconsistente).
- Worker + SQLite: `findDeliverable` + `markSent` concorrentes com a request — `busy_timeout` (D5) mitiga; com `replicas: 1` não há concorrência entre instâncias.
- `prisma` no runtime stage do Docker: confirmar binário presente (devDep). Se não, ajustar Dockerfile para incluí-lo.

**Métrica de sucesso**: e-mail de reset com provider derrubado momentaneamente é reenviado e chega; deploy num volume vazio falha o `/health` até migrate rodar; 500 não-Prisma aparece no Sentry; `/metrics` expõe contadores de outbox; CI quebra em erro de tipo cross-file.

---

## 7. Esboço de Tasks (expandido nos planos TDD)

Os planos abaixo expandem cada decisão em ciclos red→green→refactor. Testes da API rodam com `cd /root/rodrigo/hope_saude/apps/api && npx jest <arquivo> --no-coverage`.

### Plano `medio-entrega-email-e-reset` (D1 + D2)
- T1 — `EmailOutboxRepository.findDeliverable(limit, maxAttempts)` + campo `payload`/`lastAttemptAt` (migration). Teste: retorna PENDING/FAILED com `attempts < max`, ordenado por `createdAt`.
- T2 — `NotificationsService.deliver()` só grava PENDING com `payload`; remover envio inline. Teste: não chama `provider.send`, grava payload por tag.
- T3 — `OutboxWorker.processOutbox()` com backoff exponencial + maxAttempts; render por tag; markSent/markFailed. Testes: sucesso → SENT; falha → FAILED + attempts++; respeita backoff; ignora attempts>=max.
- T4 — `ResetPasswordDto`/`VerifyEmailDto` + reuso do validator de senha do `RegisterDto`.
- T5 — `AuthService.resetPassword`: lookup sha256, valida expiração/usedAt, transação (bcrypt + usedAt + invalidar anteriores). Testes: token válido troca senha e marca usedAt; expirado/usado/inexistente → BadRequest genérico; tokens anteriores invalidados.
- T6 — `AuthService.verifyEmail`: set `User.emailVerifiedAt`, marca usedAt. Migration do campo `emailVerifiedAt`.
- T7 — `AuthController` rotas `POST /auth/reset-password` e `/auth/verify-email` com `@Throttle(auth)`, `@HttpCode(204)`; e2e.

### Plano `medio-observabilidade` (D3)
- T8 — `AllExceptionsFilter` (catch-all) + registro em `main.ts` após `PrismaExceptionFilter`; e2e confirma que P2025/P2002/P2003 seguem corretos e 5xx genérico tem shape consistente.
- T9 — Process handlers `unhandledRejection`/`uncaughtException` (log + Sentry + flush). Teste unit do handler.
- T10 — Init Sentry condicional a `SENTRY_DSN` + `beforeSend` scrubbing PHI. Dep `@sentry/node`.
- T11 — `MetricsController` `GET /metrics` (`@SkipThrottle`, protegido) + contadores outbox/http. Dep `prom-client`.
- T12 — Redaction extra no Pino (`req.body.token`, `req.body.newPassword`).

### Plano `curto-ops-ci-hygiene` (D4 + D5 + D6)
- T13 — Script `prisma:deploy` + `docker-entrypoint.sh` + `ENTRYPOINT` no Dockerfile (garantir `prisma` no runtime).
- T14 — `/health` valida schema (`_prisma_migrations`), não só `SELECT 1`. Teste: schema ausente → down.
- T15 — `PrismaService` PRAGMA WAL + busy_timeout no `onModuleInit`. Teste: pragmas aplicados.
- T16 — Backup SQLite off-host (Litestream preferido / cron fallback) — operacional, documentar no compose/deploy docs.
- T17 — CI: step `tsc --noEmit`/build por workspace em `.github/workflows/ci.yml`.

---

### Referências de código (fonte da verdade)
- `apps/api/src/notifications/notifications.service.ts:57-89` — `deliver()` inline.
- `apps/api/src/notifications/outbox/email-outbox.repository.ts:1-50` — sem `findMany`.
- `apps/api/src/auth/auth.service.ts:100-146` — emissão de token sem consumo.
- `apps/api/src/auth/auth.controller.ts:48-62` — só emissores.
- `apps/api/prisma/schema.prisma:195-235` — EmailOutbox, PasswordResetToken, EmailVerificationToken; `:10-30` — User (sem emailVerifiedAt).
- `apps/api/src/main.ts:34` — só PrismaExceptionFilter.
- `apps/api/src/prisma.service.ts:1-13` — sem PRAGMA.
- `apps/api/src/health/health.controller.ts:30-42` — `SELECT 1`.
- `apps/api/Dockerfile:36` — `CMD` sem migrate.
- `apps/api/package.json:8` — só `migrate dev`.
- `docker-compose.prod.yml:19-30` — bind mount, replicas:1.
- `.github/workflows/ci.yml:33-65` — só eslint + jest.
- `apps/api/src/common/logger/logger.config.ts` — Pino + redaction.
- `apps/api/src/app.module.ts` — `ScheduleModule.forRoot()` montado, throttler `auth`.
