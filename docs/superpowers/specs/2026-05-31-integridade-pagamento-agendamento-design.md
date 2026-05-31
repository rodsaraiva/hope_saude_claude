# Integridade de Pagamento & Agendamento — Design Spec

**Data:** 2026-05-31
**Tipo:** Design doc (spec)
**Escopo:** `apps/api` — domínios `payment`, `appointment`, `availability`
**Planos derivados:** `curto-integridade-pagamento-agendamento` e `medio-asaas-webhook` (TDD, expandem o "Esboço de Tasks" desta spec)

---

## 1. Contexto / Problema

O fluxo de monetização da Hope Saúde é um *checkout único*: o paciente escolhe médico + horário, paga via Asaas (PIX ou cartão), e a consulta (`Appointment`) só deve nascer **depois** que o pagamento for confirmado. Hoje a confirmação acontece por **polling** (`PaymentCronService` a cada 15 min) e por um endpoint manual `POST /payments/:id/confirm`. A auditoria encontrou que essa máquina de estados tem furos que permitem (a) criar consulta sem pagamento real, (b) rodar em produção contra um mock silencioso, (c) gravar dados de forma não-atômica e não-idempotente, e (d) reservar o mesmo horário duas vezes (double-booking).

Achados (arquivo:linha):

- **CRÍTICO — `/confirm` cria consulta sem comprovar pagamento.** `payment.service.ts:211-242` (`confirmPayment`). O método chama `receiveInSandbox` dentro de um `try/catch` otimista (`payment.service.ts:221-227`) e, **mesmo se o Asaas falhar**, segue direto para `createConfirmedAppointment` (`payment.service.ts:230-238`). Não há nenhuma verificação de `getPaymentStatus`. Como o endpoint está apenas atrás de `AuthGuard('jwt')` (`payment.controller.ts:11,28-34`), qualquer paciente autenticado, dono de um `PendingCheckout`, cria uma consulta CONFIRMED sem pagar. O teste `payment.service.spec.ts:157-177` ("should confirm payment manual even if Asaas Sandbox fails") **cristaliza o bug** como comportamento esperado.

- **CRÍTICO — fallback mock silencioso.** `asaas.service.ts:13` faz `this.apiKey = ... || 'MOCK_API_KEY'`, e `asaas.service.ts:16-18` (`isMock`) faz todos os métodos retornarem respostas falsas (`createPayment` → `{ id: 'pay_mock_123', status: 'CONFIRMED' }` em `asaas.service.ts:103-108`; `getPaymentStatus` → `RECEIVED` em `asaas.service.ts:141`). Se `ASAAS_API_KEY` faltar **em produção**, o sistema "confirma pagamentos" que nunca existiram, sem nenhum sinal.

- **ALTO — confirmação não-transacional.** Tanto `confirmPayment` (`payment.service.ts:230-239`) quanto o cron (`payment.cron.service.ts:31-40`) executam `createConfirmedAppointment` e `deletePendingCheckout` como **duas escritas soltas**. Se a segunda falhar, fica um `Appointment` confirmado + `PendingCheckout` órfão, que o próximo ciclo do cron processa de novo → consulta duplicada. O projeto já tem o padrão de transação correto em `medical-record.service.ts:162` (`this.prisma.$transaction(async (tx) => { ... })`).

- **ALTO — sem idempotência por pagamento.** `Appointment.paymentId` é `String?` **sem `@unique`** (`schema.prisma:76`). Nada impede dois `Appointment` com o mesmo `paymentId` quando cron e `/confirm` correm juntos, ou quando o cron reprocessa um checkout órfão.

- **ALTO — double-booking.** `createConfirmedAppointment` (`appointment.service.ts:35-56`) e `createPendingCheckout` (`appointment.service.ts:8-18`) criam linhas **sem checar conflito de horário**. O overlap só existe na **leitura** dos slots disponíveis (`available-slots.service.ts:54-66` + `subtractBusyFromCandidates`/`intervalsOverlap` em `weekly-availability.ts:101-103,238-246`). Entre o `GET` de slots e o `POST /checkout` há uma janela de corrida: dois pacientes pegam o mesmo slot e ambos viram `PendingCheckout`/`Appointment`.

- **ALTO — sem webhook Asaas (médio prazo).** A confirmação depende exclusivamente do cron de 15 min (`payment.cron.service.ts:15`), gerando latência de até 15 minutos entre "paguei o PIX" e "consulta confirmada".

- **MÉDIO — cron sem guarda de reentrância.** `payment.cron.service.ts:15-48` não tem lock; se um ciclo demorar (muitos checkouts pendentes, Asaas lento), o próximo `@Cron('*/15 * * * *')` pode sobrepor e processar a mesma linha em paralelo.

- **MÉDIO — duração de conflito fixa em 60 min.** `available-slots.service.ts:96-108` (`buildBusyIntervals`) usa `r.durationMinutes || 60`. Para registros antigos/sem duração o bloqueio é sempre de 1h, podendo liberar/bloquear slots errados quando a consulta dura 30 ou 45 min.

- **MÉDIO — `consultationModelId` inválido ignorado em silêncio.** `payment.service.ts:60-71`: se `body.consultationModelId` for passado mas não casar com nenhum modelo do médico (`model` indefinido), o código **não lança erro** — cai no fallback `value = 150 / durationMinutes = 60`. O paciente pode pagar valor/duração errados sem perceber.

- **MÉDIO — checkout não rejeita data no passado.** `checkout.dto.ts:48-49` valida `@IsDateString()` mas não rejeita datas passadas, e `processCheckout` (`payment.service.ts:52-189`) não revalida disponibilidade contra a agenda do médico no momento do checkout.

### Estado atual dos testes
API: 241 testes / 42 suítes verdes. Web: 183 / 40. Todo trabalho derivado segue TDD estrito (red → green → refactor), SOLID, TypeScript strict, zero `any` em produção, sem `forwardRef`.

---

## 2. Objetivos e Não-objetivos

### Objetivos (curto prazo)
1. Garantir que **nenhuma consulta seja criada sem prova de pagamento** (`getPaymentStatus` ∈ {`RECEIVED`, `CONFIRMED`}).
2. **Fail-fast** no boot se `ASAAS_API_KEY` faltar em produção — nunca cair em mock silencioso.
3. Tornar a confirmação **atômica** (`$transaction`) e **idempotente** (`Appointment.paymentId @unique`, P2002 → no-op).
4. Eliminar o **double-booking** com checagem de conflito de intervalo **dentro de transação** antes de criar a cobrança Asaas, mais `@@unique([doctorId, date])` como rede de segurança barata.
5. Guardar o cron contra **reentrância**.
6. Endurecer validações de checkout: `consultationModelId` inválido → `BadRequest`; data no passado → `BadRequest`; duração real refletida no bloqueio de agenda.

### Objetivos (médio prazo — plano `medio-asaas-webhook`)
7. **Webhook Asaas idempotente** com validação do header `asaas-access-token`, transformando o cron em mera **reconciliação** (rede de segurança), não no caminho principal.

### Não-objetivos
- Migração para PostgreSQL (tratada na spec de banco; exclusion constraints `tstzrange` ficam para lá).
- Estorno/cancelamento de consultas e reembolso Asaas.
- Mudança no fluxo de cartão de crédito além das validações de integridade acima.
- Mudança no front-end (`api-client.ts`, telas de checkout) além do contrato já existente.

---

## 3. Decisões de design

### 3.1 Gate de produção + verificação de status em `/confirm` (CRÍTICO)

**Decisão.** `confirmPayment` (`payment.service.ts:211`) passa a:
1. **Bloquear em produção** via `NODE_ENV`. Em produção (`NODE_ENV === 'production'`), o método lança `ForbiddenException` (ou `NotFoundException` para não revelar a rota) — é um atalho de sandbox, não um endpoint de negócio.
2. **Fora de produção**, remover o `try/catch` otimista (`payment.service.ts:221-227`): se `receiveInSandbox` falhar, ainda assim **consultar `getPaymentStatus`** e só prosseguir se o status for `RECEIVED`/`CONFIRMED` — exatamente a mesma regra do cron (`payment.cron.service.ts:28-30`). Status diferente → `BadRequestException('Pagamento ainda não confirmado')`.
3. Delegar a criação atômica para um helper compartilhado com o cron (§3.3).

**Justificativa.** A confirmação manual existe para agilizar testes em sandbox; em produção ela é um bypass de pagamento. O gate por `NODE_ENV` é o stopgap mais barato e reversível. A verificação de `getPaymentStatus` reaproveita a regra que o cron já considera correta, eliminando a divergência entre os dois caminhos.

**Alternativas rejeitadas.**
- *Remover o endpoint inteiro agora:* quebraria o fluxo de QA/sandbox e os testes e2e que dependem dele; o gate por env preserva o uso legítimo.
- *Guard de role (só ADMIN):* não resolve — o problema não é quem chama, é a ausência de prova de pagamento.

**Impacto em teste.** O teste `payment.service.spec.ts:157-177` (`should confirm payment manual even if Asaas Sandbox fails`) descreve o bug e precisa ser **reescrito** (red primeiro): quando `receiveInSandbox` falha **e** `getPaymentStatus` retorna não-confirmado, `confirmPayment` deve lançar e **não** chamar `createConfirmedAppointment`. Um novo teste cobre o gate de produção (`NODE_ENV='production'` → lança, sem tocar no repositório).

### 3.2 Fail-fast no boot do Asaas (CRÍTICO)

**Decisão.** No construtor de `AsaasService` (`asaas.service.ts:10-14`): se `NODE_ENV === 'production'` e `ASAAS_API_KEY` ausente/igual a `'MOCK_API_KEY'`, lançar erro no boot (ex.: `throw new Error('ASAAS_API_KEY obrigatória em produção')`). Mantém o mock apenas para `NODE_ENV !== 'production'` (dev/test), preservando a suíte atual (`isMock` em `asaas.service.ts:16-18` já isenta `test`).

**Justificativa.** Falhar no startup é infinitamente preferível a "confirmar" pagamentos fantasmas silenciosamente em runtime. Boot quebrado é visível e bloqueia deploy ruim.

**Alternativa rejeitada.** *Warning de log:* logs passam despercebidos; o dano (consultas grátis) é grave e silencioso.

### 3.3 Confirmação atômica + idempotente (ALTO)

**Decisão.** Criar um helper único — p.ex. `AppointmentService.confirmAppointmentFromCheckout(checkout)` — que envolve em `this.prisma.$transaction(async (tx) => { ... })` (padrão de `medical-record.service.ts:162`):
1. `tx.appointment.create({ ... status: 'CONFIRMED', paymentId })`
2. `tx.pendingCheckout.delete({ where: { id } })`

`confirmPayment` (`payment.service.ts:230-239`) e o cron (`payment.cron.service.ts:31-40`) passam a chamar esse helper único em vez de fazer duas escritas soltas.

**Idempotência.** Adicionar `@unique` a `Appointment.paymentId` (`schema.prisma:76`). Como `paymentId` é opcional (`String?`), o `@unique` no SQLite trata múltiplos `NULL` como distintos — ok, pois apenas consultas confirmadas têm `paymentId`. Quando dois caminhos (cron + webhook futuro, ou cron + `/confirm`) tentarem confirmar o mesmo pagamento, o segundo recebe **P2025/P2002** dentro da transação → capturar e tratar como **no-op** (`{ success: true, alreadyConfirmed: true }`), sem propagar 500. O `PrismaExceptionFilter` (`prisma-exception.filter.ts:54-62`) já mapeia P2002 → 409, mas como queremos no-op, o tratamento é feito **no service** (catch do P2002/P2025), não deixando o filtro responder.

**Justificativa.** Atomicidade elimina o estado órfão; `@unique` + tratamento de P2002 dá idempotência de graça e prepara o terreno para o webhook (que correrá em paralelo ao cron). Reusar `$transaction` mantém a convenção do repo.

**Alternativas rejeitadas.**
- *Marcar `PendingCheckout` como `processed` em vez de deletar:* adiciona estado; o `@unique` em `paymentId` já garante idempotência sem coluna extra.
- *Lock pessimista:* SQLite não suporta de forma útil; a transação serializada do SQLite (WAL + busy_timeout, ver spec de banco) já basta no curto prazo.

### 3.4 Anti-double-booking (ALTO)

**Decisão (curto prazo).** Antes de criar a cobrança Asaas em `processCheckout` (`payment.service.ts:152` e `:170`, ou seja, antes de `createPayment`), checar conflito de horário **dentro de uma transação**:
- Computar o intervalo `[date, date + durationMinutes)` do checkout pretendido.
- Buscar `Appointment` e `PendingCheckout` do médico que **sobreponham** esse intervalo (reaproveitando `intervalsOverlap` de `weekly-availability.ts:101-103`).
- Se houver overlap → `ConflictException('Horário indisponível')` **antes** de tocar no Asaas (evita cobrança órfã).

Adicionar `@@unique([doctorId, date])` a `Appointment` (e considerar em `PendingCheckout`) como rede de segurança.

**NUANCE IMPORTANTE (registrar explicitamente).** `@@unique([doctorId, date])` só pega **colisão de início exato** (mesmo `doctorId` + mesmo `date`). **Sobreposição parcial** — ex.: consulta A das 10:00 por 60 min vs consulta B das 10:30 por 60 min — **não** é capturada por unique de igualdade. Por isso a **checagem de intervalo em transação é obrigatória** e o `@@unique` é só defesa-em-profundidade barata. **SQLite não tem exclusion constraint** (`EXCLUDE USING gist` com `tstzrange`), que seria a solução nativa — isso fica para a migração PostgreSQL (não-objetivo desta spec).

**Justificativa.** Checar antes de cobrar evita o pior caso (paciente pagou e não tem horário). A transação fecha a janela de corrida entre dois checkouts simultâneos. O `@@unique` cobre o caso degenerado de mesmo início exato mesmo se a lógica de intervalo tiver bug.

**Alternativas rejeitadas.**
- *Confiar só no `@@unique([doctorId,date])`:* não pega sobreposição parcial (a nuance acima).
- *Confiar só na filtragem de slots na leitura:* tem janela de corrida read→write; é o status quo que causou o gap.

### 3.5 Webhook Asaas idempotente (MÉDIO — plano `medio-asaas-webhook`)

**Decisão.** Endpoint público `POST /payments/webhook/asaas` que:
1. **Valida o header `asaas-access-token`** contra um secret de env (`ASAAS_WEBHOOK_TOKEN`); token ausente/errado → `401`.
2. Em eventos `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`, localiza o `PendingCheckout` por `asaasPaymentId` e chama o **mesmo** helper atômico/idempotente do §3.3 (`confirmAppointmentFromCheckout`).
3. Idempotente por construção: reentregas do Asaas e corridas com o cron viram no-op via `@unique` em `paymentId`.

O **cron passa a ser reconciliação**: roda menos vezes, só varre `PendingCheckout` antigos que o webhook por algum motivo não confirmou. A latência de confirmação cai de até 15 min para segundos.

**Justificativa.** Webhook é o mecanismo correto de notificação; idempotência reaproveita o trabalho do curto prazo. Manter o cron como rede evita perder pagamentos em entregas de webhook falhas.

**Alternativa rejeitada.** *Substituir o cron pelo webhook:* webhooks podem falhar/atrasar; reconciliação é barata e protege a receita.

### 3.6 Guarda de reentrância do cron (MÉDIO)

**Decisão.** Flag `private isRunning = false` em `PaymentCronService`; `handleCron` (`payment.cron.service.ts:16`) retorna cedo se `isRunning`, seta no `try`, limpa no `finally`. Lock em memória basta no curto prazo (instância única); concorrência real será resolvida no webhook idempotente + transação.

### 3.7 Validações de checkout (MÉDIO)

- **`consultationModelId` inválido:** em `processCheckout` (`payment.service.ts:60-71`), se `body.consultationModelId` for informado e `model` ficar indefinido → `BadRequestException('Modelo de consulta inválido para este médico')` em vez do fallback silencioso.
- **Data no passado:** validar em `processCheckout` (ou via DTO custom) que `new Date(body.date)` é futura → `BadRequestException`.
- **Duração real no bloqueio:** `buildBusyIntervals` (`available-slots.service.ts:96-108`) já lê `durationMinutes`; garantir que `Appointment.durationMinutes` e `PendingCheckout.durationMinutes` sejam sempre persistidos com o valor real do modelo (já são, via `processCheckout`), e revisar o fallback `|| 60` para registros legados (documentar como dívida).

---

## 4. Mudanças de modelo de dados / interfaces

### 4.1 Prisma schema (`schema.prisma`)

```prisma
model Appointment {
  // ...
  paymentId  String?  @unique   // era: String? (linha 76) — idempotência por pagamento
  // ...
  @@unique([doctorId, date])     // rede de segurança p/ colisão de início exato (NÃO cobre overlap parcial)
  @@index([doctorId, date])
  @@index([patientId, date])
  @@index([date])
}
```

`PendingCheckout.asaasPaymentId` já é `@unique` (`schema.prisma:185`) — nenhuma mudança.
Migration SQLite gerada via `prisma migrate`; aplicar com banco endurecido (WAL + busy_timeout, ver spec de banco).

### 4.2 `AppointmentService` (`appointment.service.ts`)

Novo método atômico (substitui o par `createConfirmedAppointment` + `deletePendingCheckout` nos call sites):

```ts
async confirmAppointmentFromCheckout(checkout: {
  id: number;
  patientId: number;
  doctorId: number;
  date: Date;
  asaasPaymentId: string;
  consultationModelId?: number | null;
  durationMinutes: number;
  price: number;
}): Promise<{ created: boolean }>;
// $transaction: appointment.create({ status:'CONFIRMED', paymentId }) + pendingCheckout.delete
// captura P2002/P2025 → { created: false } (no-op idempotente)
```

Novo método de checagem de conflito (usado por `processCheckout`):

```ts
async hasConflictingBooking(
  doctorId: number,
  start: Date,
  durationMinutes: number,
): Promise<boolean>;
// busca Appointment + PendingCheckout do médico que sobreponham [start, start+dur)
```

### 4.3 `PaymentService` (`payment.service.ts`)

- `confirmPayment` (linha 211): gate `NODE_ENV`; remover `try/catch` otimista; consultar `getPaymentStatus`; delegar a `confirmAppointmentFromCheckout`.
- `processCheckout` (linha 52): `consultationModelId` inválido → `BadRequest`; data passada → `BadRequest`; `hasConflictingBooking` em transação **antes** de `createPayment`.

### 4.4 `AsaasService` (`asaas.service.ts`)

- Construtor (linha 10): fail-fast em produção se `ASAAS_API_KEY` ausente/`MOCK_API_KEY`.

### 4.5 `CheckoutDto` (`checkout.dto.ts`)

- Validação de data futura para `date` (validador custom ou checagem em service).

### 4.6 Webhook (médio prazo)

- Novo `POST /payments/webhook/asaas` em `payment.controller.ts` (rota **sem** `AuthGuard('jwt')` — autenticada por `asaas-access-token`).
- Env nova: `ASAAS_WEBHOOK_TOKEN`.

---

## 5. Considerações de segurança / LGPD

- **Bypass de pagamento (fraude):** o gate `/confirm` + verificação de status fecham um caminho de obtenção de serviço sem pagamento (impacto financeiro direto).
- **Mock silencioso em produção:** fail-fast impede um deploy mal configurado de virar "consultas grátis" para todos.
- **Webhook público:** validar `asaas-access-token` é obrigatório; sem isso, qualquer um confirma pagamentos. Token via env/secret, **nunca** commitado (regra de safety do repo). Não logar o token nem o corpo cru do webhook (pode conter PII do pagador).
- **Idempotência ↔ integridade clínica:** evitar `Appointment` duplicado também evita prontuários/agenda inconsistentes ligados ao mesmo pagamento.
- **Mensagens de erro:** manter o padrão do `PrismaExceptionFilter` — não vazar detalhes crus do Prisma/Asaas ao cliente. Conflito de horário responde 409 genérico ("Horário indisponível"), sem expor dados de outro paciente.
- **Dado mínimo:** a checagem de conflito lê apenas `date`/`durationMinutes`/ids do médico — sem PII do outro paciente.

---

## 6. Plano de rollout / risco

1. **Schema first (reversível):** adicionar `@unique` em `paymentId` e `@@unique([doctorId,date])`. **Risco:** se já existirem duplicatas no `dev.db`, a migration falha — rodar checagem de dados antes (query de duplicados). Backup do `dev.db` antes (estratégia de backup da spec de banco).
2. **Fail-fast Asaas:** mudança de boot; validar que `NODE_ENV=test`/dev seguem com mock (suíte verde) e que prod sem key quebra o boot (teste de unidade do construtor).
3. **Confirmação atômica + idempotente:** trocar call sites do cron e `/confirm` para o helper; rodar suíte (`payment.service.spec.ts`, `payment.cron.service.spec.ts`, `appointment.service.spec.ts`).
4. **Gate `/confirm` + status:** reescrever `payment.service.spec.ts:157-177` (red), depois implementar.
5. **Anti-double-booking:** checagem de intervalo em transação + `@@unique`; testes de corrida (dois checkouts no mesmo slot, overlap parcial 10:00×10:30).
6. **Cron lock + validações de checkout:** baixo risco, incremental.
7. **Webhook (médio prazo):** feature nova atrás de env `ASAAS_WEBHOOK_TOKEN`; cron permanece como reconciliação até o webhook provar estável em sandbox.

**Métricas de sucesso:** zero `Appointment` sem `paymentId` confirmado; zero `PendingCheckout` órfão após confirmação; suíte API permanece verde (≥ 241 testes) com os novos casos; nenhuma consulta criada com `NODE_ENV=production` + `ASAAS_API_KEY` ausente (boot falha).

---

## 7. Esboço de Tasks (expandido pelos planos TDD)

> Cada task segue red → green → refactor. Os planos `curto-integridade-pagamento-agendamento` e `medio-asaas-webhook` detalham os testes vermelhos primeiro. Rodar: `cd /root/rodrigo/hope_saude/apps/api && npx jest <arquivo> --no-coverage`.

**Curto prazo — `curto-integridade-pagamento-agendamento`:**
1. Fail-fast `AsaasService` em produção sem `ASAAS_API_KEY` (teste do construtor).
2. `Appointment.paymentId @unique` + migration + checagem de duplicatas.
3. `AppointmentService.confirmAppointmentFromCheckout` atômico ($transaction) e idempotente (P2002/P2025 → no-op).
4. Cron passa a usar o helper atômico (`payment.cron.service.ts:31-40`).
5. Gate `NODE_ENV` em `confirmPayment` + verificação `getPaymentStatus`; **reescrever** `payment.service.spec.ts:157-177`.
6. `@@unique([doctorId, date])` + `hasConflictingBooking` (overlap parcial) em transação antes de `createPayment`.
7. Guarda de reentrância no cron (`isRunning`).
8. Validação `consultationModelId` inválido → `BadRequest` (`payment.service.ts:60-71`).
9. Validação de data no passado no checkout (`checkout.dto.ts` / `processCheckout`).

**Médio prazo — `medio-asaas-webhook`:**
10. `POST /payments/webhook/asaas` com validação `asaas-access-token` (401 se inválido).
11. Webhook reaproveita `confirmAppointmentFromCheckout` (idempotente; corrida com cron = no-op).
12. Cron reduzido a reconciliação (frequência + escopo); documentar SLA de confirmação.
