# Segurança & LGPD — Hardening — Design Spec

**Data:** 2026-05-31
**Escopo:** `apps/api` (NestJS 11 + Prisma) e `apps/web` (Next.js 15)
**Status:** Proposta de design (a ser expandida em planos TDD)
**Planos de implementação:** `2026-05-31-curto-seguranca-criticos.md` (curto prazo) e `2026-05-31-medio-auth-cookie-refresh.md` (médio prazo)

---

## 1. Contexto / Problema

A auditoria de segurança identificou vazamentos de dados de saúde (PHI), bypasses de autorização e falhas de fail-safe espalhados pela API e pelo front. Como plataforma de telepsiquiatria, qualquer um destes é incidente de LGPD (dados sensíveis de saúde, art. 11). Achados, por arquivo:linha sobre o código real:

### Críticos

- **IDOR no token de vídeo** — `apps/api/src/video/video.controller.ts:18-43`. O handler `getToken` só checa `appt.status === 'CONFIRMED'`; **não compara** `req.user.userId` com `appt.patientId`/`appt.doctorId`. Qualquer usuário autenticado que adivinhe um `appointmentId` recebe um token LiveKit válido para a sala `room-${appointmentId}` e entra na consulta de terceiros. Pior: a resposta inclui `patientName: (appt as any).patient?.name` (linha 40) — vaza o nome do paciente para quem não é parte da consulta, e ainda usa `as any`, violando a regra "ZERO any em produção".
- **Bypass de pagamento** — `apps/api/src/payment/payment.controller.ts:28-34` expõe `POST /payments/:id/confirm` que chama `paymentService.confirmPayment` (`payment.service.ts:211-242`). Esse método tenta `receiveInSandbox` e, **mesmo se falhar** (catch que só loga, linha 223-227), cria a consulta confirmada sem nunca consultar o status real do pagamento. Em produção isso permite criar consultas sem pagar. Tratado em detalhe no spec de pagamento; aqui cobrimos apenas o gate de ambiente. 
- **Fallback mock do Asaas em produção** — `apps/api/src/payment/asaas.service.ts:13-18`. `apiKey` cai em `'MOCK_API_KEY'` quando `ASAAS_API_KEY` falta, e `isMock()` retorna `true` fora de `NODE_ENV==='test'`. Se a env não estiver setada em produção, todo o fluxo de pagamento vira mock silencioso (`createPayment` devolve `pay_mock_123` com status `CONFIRMED`, `getPaymentStatus` devolve `RECEIVED`) — consultas "pagas" sem cobrança real.

### Altos

- **XSS armazenado em prontuário** — `apps/web/src/components/MedicalRecordModal.tsx:335,407` e `apps/web/src/components/profile/MedicalRecordsList.tsx:71` usam `dangerouslySetInnerHTML={{ __html: record.content }}` (e `audit.content`) sem sanitização. O comentário em `MedicalRecordsList.tsx:17-20` afirma que o conteúdo "vem do backend já sanitizado via ValidationPipe" — isso é **FALSO**: o `ValidationPipe` (`main.ts:25-31`) só faz whitelist/transform de DTO, não remove HTML perigoso. O `content` é HTML do Tiptap, gravado como veio e renderizado como HTML — `<img src=x onerror=...>` ou `<script>` persistido executa no navegador de quem abre o prontuário (paciente e outros médicos).
- **PII em log fora da redaction** — `apps/api/src/auth/roles.guard.ts:17`: `console.log(\`[ROLES] ... User: ${JSON.stringify(user)}\`)`. O `req.user` contém `userId/email/role`. Esse `console.log` escapa do pipeline do nestjs-pino (e da lista de redaction em `logger/logger.config.ts`), gravando e-mail em texto plano nos logs em toda request com `@Roles`.

### Médios

- **JWT + PHI em `localStorage`** — `apps/web/src/lib/api-client.ts:17` lê o token de `localStorage.getItem('token')` (vetor de roubo via XSS, ver acima); não checa `exp`; não há logout-on-401 global (cada chamada anexa `error.status` em `api-client.ts:38` mas ninguém reage globalmente). Em `MedicalRecordModal.tsx:122-123`, `handleSign` grava `pending_signature_content` (o conteúdo clínico inteiro) e `pending_signature_record_id` no `localStorage` — o `pending_signature_content` é um **dead-write** (nunca é lido em lugar nenhum do front, confirmado por grep), então é PHI escrito no disco do cliente sem nenhum propósito.
- **Reúso do JWT_SECRET como chave HMAC + fallback inseguro** — `apps/api/src/common/cryptography.service.ts:17-19`: `this.secret = JWT_SECRET || 'dev-secret-key'`. Os métodos `sign`/`verify` (HMAC-SHA256) **só têm um caller: eles mesmos** (`cryptography.service.ts:41`). A assinatura real de prontuário/receita vai por `signatureProvider.sign()` (Lacuna) em `medical-record.service.ts:191` e `prescription.service.ts:152`. Ou seja: a chave HMAC compartilha o segredo do JWT (acoplamento perigoso) e cai num literal `'dev-secret-key'` se a env faltar — e nem é usada em produção.
- **CORS fail-open** — `apps/api/src/common/cors.util.ts:5-13` retorna `true` (libera qualquer origin) quando `CORS_ORIGINS` está vazio, e `main.ts:20-23` usa isso com `credentials: true`. Sem env em produção, a API aceita requests autenticados de qualquer origem.
- **Token LiveKit sem TTL** — `apps/api/src/video/video.service.ts:18-26`: `new AccessToken(apiKey, apiSecret, { identity })` sem `ttl`. O token herda o default da lib e não expira junto com a janela da consulta.

### Baixo

- **`validateUser` sem timing-mitigation** — `apps/api/src/auth/auth.service.ts:76-83`: quando o e-mail não existe, retorna `null` sem nunca rodar `bcrypt.compare`. A diferença de tempo entre "usuário inexistente" e "senha errada" permite enumeração de e-mails por timing.

---

## 2. Objetivos e Não-objetivos

### Objetivos

1. Eliminar os IDOR / bypass que permitem acesso a PHI e criação de consultas não pagas (curto prazo).
2. Estabelecer um **modelo de autorização por ownership** reutilizável para recursos vinculados a consulta/paciente.
3. Estabelecer uma **estratégia de sanitização de HTML** para conteúdo clínico, eliminando o XSS armazenado.
4. Fechar os fail-open (CORS, mock Asaas, secret default) com **fail-fast/fail-closed** em produção.
5. Parar de gravar PHI no `localStorage` e endurecer a sessão do front (checar `exp`, logout-on-401).
6. Manter TDD estrito (red→green→refactor), SOLID, TypeScript strict, ZERO `any`.

### Não-objetivos (ficam para os planos de médio/longo prazo)

- Migração de SQLite → PostgreSQL (spec de banco).
- Migração do JWT para cookie `HttpOnly` + refresh token — desenhada aqui em alto nível, **implementada** no plano `2026-05-31-medio-auth-cookie-refresh.md`.
- Webhook Asaas idempotente (spec de pagamento).
- Blind-index / FTS sobre campos cifrados.

---

## 3. Decisões de design

### 3.1 Autorização por ownership (núcleo)

**Decisão:** a checagem "este usuário é parte deste recurso?" passa a ser explícita e centralizada num método de serviço, **não** num decorator mágico.

Para o token de vídeo, o `VideoController.getToken` passa a exigir que `req.user.userId` seja `appt.patientId` **ou** `appt.doctorId`, caso contrário `ForbiddenException`. Como `appointmentService.findById` (`appointment.service.ts:79-97`) já retorna `patientId`/`doctorId`, a checagem é local e barata. O payload de resposta para de incluir `patient?.name` (e elimina o `as any`): o front já recebe `patientName` por outro caminho (o modal recebe `patientName` como prop), então o token de vídeo não precisa vazar isso.

**Forma reutilizável:** introduzir em `appointment.service.ts` um helper puro/explícito do tipo:

```ts
// pseudo-assinatura — o teste vermelho define o shape exato
assertParticipant(appt: { patientId: number; doctorId: number }, userId: number): void
// lança ForbiddenException se userId !== patientId && userId !== doctorId
```

Os controllers que operam sobre uma consulta (vídeo agora; futuros endpoints de chat/anexo) chamam esse helper. O padrão de ownership já existe no projeto em `medical-record.controller.ts:57-61` (paciente só vê o próprio `patientId`) — vamos seguir esse mesmo estilo (checagem no controller/serviço com `req.user`), em vez de inventar um guard novo com `Reflector`, para não acoplar autorização baseada em **dado do banco** ao ciclo de guards (que roda antes de carregar o recurso).

**Alternativa rejeitada:** um `@OwnsAppointment()` guard via `Reflector`. Rejeitada porque o guard precisaria buscar o appointment do banco (duplicando o `findById` que o handler já faz) e não tem acesso fácil ao `appointmentId` tipado. Mais código, mais query, sem ganho de clareza para 1-2 call sites hoje.

### 3.2 Sanitização de HTML do prontuário

**Decisão (defense in depth, duas camadas):**

1. **Backend ao persistir (autoritativo):** sanitizar o `content` HTML no `MedicalRecordService` antes de cifrar/gravar, na criação (`create`) e na atualização (`update`). Biblioteca: `sanitize-html` (server-side, sem dependência de DOM). Allowlist restrita às tags que o Tiptap emite (`p, strong, em, u, s, ul, ol, li, h1-h3, br, blockquote`) e **zero atributos de evento** / `style` / `src` arbitrário. Isso é autoritativo porque protege qualquer cliente futuro (app mobile, export PDF) e mata o conteúdo malicioso na fonte. Importante: a sanitização roda **antes** do `cryptographyService.encrypt`, e o hash de integridade (`signedHash`) passa a refletir o conteúdo já sanitizado — registros assinados continuam imutáveis.
2. **Frontend ao renderizar (cinto e suspensório):** sanitizar com **DOMPurify** dentro de um wrapper compartilhado (ex.: `apps/web/src/lib/sanitize.ts` + um componente `SafeHtml`) e substituir os três `dangerouslySetInnerHTML` (`MedicalRecordModal.tsx:335,407`, `MedicalRecordsList.tsx:71`) por esse componente. Cobre dados legados gravados antes da camada de backend existir.

**Correção do comentário falso:** o comentário de `MedicalRecordsList.tsx:17-20` será reescrito para descrever a sanitização real (DOMPurify no render + sanitize-html no persist), nunca mais "sanitizado via ValidationPipe".

**Alternativa rejeitada:** sanitizar só no front. Rejeitada porque deixa o dado sujo no banco (qualquer novo consumidor herda o XSS) e depende de o desenvolvedor lembrar de usar o wrapper. Sanitizar na fonte é o invariante correto.

### 3.3 Fail-fast no boot e fail-closed em runtime

**Decisão:** validar a configuração no boot via `validationSchema` do `ConfigModule.forRoot` (`app.module.ts:21`). Hoje é `ConfigModule.forRoot({ isGlobal: true })` sem schema. Passa a ter um schema (`joi` ou validação equivalente em TS) que, **quando `NODE_ENV==='production'`**, exige: `ASAAS_API_KEY` (sem cair em `MOCK_API_KEY`), `JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `CORS_ORIGINS` (não-vazio), `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`. Faltando qualquer um → a app **não sobe**.

- **Asaas:** remover o default `'MOCK_API_KEY'` da inicialização (`asaas.service.ts:13`); o mock fica restrito a `NODE_ENV` de dev/test e o boot falha em prod sem a key. `isMock()` continua válido para dev/test.
- **CORS:** `parseCorsOrigins` (`cors.util.ts`) passa a **lançar** (ou `main.ts` passa a rejeitar) quando `CORS_ORIGINS` vazio em produção, em vez de retornar `true`. Em dev, mantém o fallback permissivo. Fail-closed.
- **CryptographyService:** remover o fallback `'dev-secret-key'` (`cryptography.service.ts:18`). Como `sign`/`verify` HMAC **não têm caller de produção** (Lacuna é o assinador real), a decisão preferida é **remover os métodos `sign`/`verify` e o campo `secret`** do `CryptographyService`, deixando-o só com `encrypt`/`decrypt`/`hashContent` (que usam `DATA_ENCRYPTION_KEY`, já validado e separado do JWT). Se algum caller futuro precisar de HMAC, introduzir uma env dedicada (`HMAC_SIGNING_KEY`) — nunca reusar `JWT_SECRET`.

**Alternativa rejeitada (CryptographyService):** manter `sign`/`verify` trocando só o fallback por uma chave dedicada. Rejeitada por YAGNI — não há consumidor em produção; manter código de assinatura morto que parece autoritativo é risco de alguém ligar nele por engano achando que é a assinatura legal (que é a Lacuna).

### 3.4 Sessão do front (curto prazo) e cookie HttpOnly (médio)

**Curto prazo (este spec → plano de críticos):**
- Parar de gravar `pending_signature_content` em `MedicalRecordModal.tsx:122-123` (dead-write de PHI). Manter só `pending_signature_record_id` (não é PHI) se ainda for necessário ao retorno do fluxo Lacuna — investigar no plano se sequer é lido.
- `api-client.ts`: checar `exp` do JWT antes de anexar o `Bearer` (decodificar o payload base64 e comparar com `Date.now()`); se expirado, limpar o token e redirecionar para login.
- Logout-on-401 global: centralizar em `apiFetch` (`api-client.ts:35-41`) — ao receber 401, limpar `localStorage('token')` e disparar redirect para `/login`. Hoje o `error.status` é anexado mas não há reação global.

**Médio prazo (plano `medio-auth-cookie-refresh`):** mover o JWT para cookie `HttpOnly + Secure + SameSite=Strict/Lax`, com refresh token rotativo. Isso remove o token do alcance de JS (e portanto de XSS) e torna o item 3.2 frontend menos crítico. Requer ajuste no `JwtStrategy` (`jwt.strategy.ts:15-19`) para extrair o JWT do cookie em vez de `fromAuthHeaderAsBearerToken`, e CORS com `credentials` já está ligado.

### 3.5 TTL do token LiveKit

**Decisão:** `video.service.ts` passa `ttl` ao `AccessToken` atrelado à janela da consulta — opção preferida: `ttl` curto e fixo (ex.: duração da consulta + folga, derivável de `appt.durationMinutes`), passado de `video.controller.ts` ao `generateToken`. Assinatura de `generateToken` ganha um parâmetro `ttlSeconds`. Mantém ZERO `any`.

### 3.6 Timing-mitigation no login (baixo)

**Decisão:** em `validateUser` (`auth.service.ts:76-83`), quando o usuário não existe, rodar um `bcrypt.compare` contra um hash dummy fixo para igualar o tempo de resposta. Custo trivial, fecha a enumeração por timing. Item de menor prioridade — entra no fim do plano de críticos ou início do médio.

---

## 4. Mudanças de modelo de dados / interfaces

Não há mudança de schema Prisma nesta spec (puramente comportamental/segurança). Mudanças de assinatura/interface previstas:

- `AppointmentService`: novo `assertParticipant(appt, userId): void` (lança `ForbiddenException`).
- `VideoService.generateToken(roomName, identity, ttlSeconds)`: novo parâmetro `ttlSeconds: number`.
- `VideoController.getToken`: checa ownership; payload de resposta **sem** `patient.name` e **sem** `as any`.
- `MedicalRecordService.create/update`: sanitizam `content` (server-side) antes de cifrar.
- `CryptographyService`: remoção de `sign`/`verify`/`secret` (mantém `encrypt`/`decrypt`/`hashContent`/`encryptNullable`/`decryptNullable`).
- `parseCorsOrigins` (`cors.util.ts`): fail-closed em produção (lança ou sinaliza para `main.ts` rejeitar).
- `ConfigModule.forRoot`: adicionar `validationSchema` (`app.module.ts:21`).
- `AsaasService` ctor: sem default `MOCK_API_KEY` (`asaas.service.ts:13`).
- `RolesGuard`: remover o `console.log` (`roles.guard.ts:17`).
- Web: novo `apps/web/src/lib/sanitize.ts` + `SafeHtml`; `api-client.ts` com checagem de `exp` e logout-on-401; `MedicalRecordModal.handleSign` sem `pending_signature_content`.

---

## 5. Considerações de segurança / LGPD

- **PHI (art. 11):** nome de paciente, conteúdo clínico e e-mails são dados sensíveis. As correções de IDOR de vídeo, XSS de prontuário, dead-write de `pending_signature_content` e `console.log` de PII atacam exatamente os pontos onde PHI vaza para fora do titular/operador autorizado.
- **Minimização:** parar de gravar PHI no `localStorage` (princípio da minimização/necessidade).
- **Integridade do prontuário:** a sanitização server-side roda **antes** do hash de integridade e da assinatura Lacuna, então não quebra a imutabilidade de registros `SIGNED` — apenas garante que o que é assinado já é HTML seguro.
- **Fail-closed por padrão:** o sistema deve recusar-se a operar inseguro (sem CORS allowlist, sem chave Asaas, sem secret) em produção, em vez de degradar silenciosamente.
- **Sem novos `any`:** todas as mudanças mantêm TypeScript strict; o `as any` de `video.controller.ts:40` é **removido**, não substituído por outro.

---

## 6. Plano de rollout / risco

1. **Ordem (curto prazo):** começar pelos críticos sem mudança de contrato externo — IDOR vídeo, gate `/payments/:id/confirm`, fail-fast Asaas, remoção do `console.log`. Cada um com teste vermelho antes.
2. **XSS:** backend (sanitize-html no persist) primeiro, depois front (DOMPurify/SafeHtml). Risco: dados legados sujos — daí a camada de render também sanitizar.
3. **CORS/secret/config schema:** mexem no boot — validar com `NODE_ENV` simulado em teste e em staging antes de prod, para não derrubar a subida por env faltando.
4. **Front (exp/logout-401):** validar no browser (regra do projeto: UI testada no browser), checando que sessão expirada redireciona sem loop.
5. **Médio prazo:** cookie HttpOnly + refresh em plano separado, atrás de feature flag/branch, com fallback de header durante a transição.

**Riscos principais:** (a) adicionar `validationSchema` pode quebrar ambientes que hoje sobem sem env — mitigar exigindo as envs **só** em produção; (b) sanitização agressiva pode comer formatação legítima do Tiptap — mitigar com allowlist espelhando exatamente o output do editor e testes de fixtures reais; (c) remover `sign`/`verify` exige confirmar (já confirmado por grep) que não há caller externo.

---

## 7. Esboço de Tasks (expandido nos planos TDD)

Os itens abaixo viram Tasks TDD (red→green→refactor) nos planos `2026-05-31-curto-seguranca-criticos.md` (curto) e `2026-05-31-medio-auth-cookie-refresh.md` (médio).

**Curto prazo (`curto-seguranca-criticos`):**
1. IDOR vídeo: teste de acesso negado a terceiro + remoção de `patient.name`/`as any` (`video.controller.ts`); `assertParticipant` em `appointment.service.ts`.
2. Gate de `/payments/:id/confirm` por `NODE_ENV` + exigir status real (cross-ref spec de pagamento).
3. Fail-fast Asaas: remover default `MOCK_API_KEY` + `validationSchema` exigindo `ASAAS_API_KEY` em prod.
4. Remover `console.log` de PII em `roles.guard.ts:17`.
5. Sanitização de prontuário: server-side (sanitize-html no `MedicalRecordService`) + front (`SafeHtml`/DOMPurify nos 3 `dangerouslySetInnerHTML`); corrigir comentário falso.
6. CORS fail-closed em produção (`cors.util.ts` + `main.ts`).
7. CryptographyService: remover `sign`/`verify`/`secret` e o fallback `dev-secret-key`.
8. TTL no token LiveKit (`video.service.ts`/`video.controller.ts`).
9. Front: parar dead-write de `pending_signature_content`; checar `exp`; logout-on-401 global (`api-client.ts`).
10. Timing-mitigation em `validateUser` (`auth.service.ts`).

**Médio prazo (`medio-auth-cookie-refresh`):**
- JWT em cookie `HttpOnly + Secure + SameSite` + refresh token rotativo; ajustar `JwtStrategy` para extrair do cookie; transição com fallback de header.
