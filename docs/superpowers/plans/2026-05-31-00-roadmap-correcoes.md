# Roadmap de Correções — Hope Saúde (2026-05-31)

Índice mestre dos specs de design e planos TDD que suprem **todos os gaps** levantados na auditoria multi-dimensional de 2026-05-31 (8 dimensões, achados verificados adversarialmente contra o código real). Organizado por horizonte (curto / médio / longo).

> **Como usar:** cada plano é autossuficiente e segue `superpowers:writing-plans` (header com REQUIRED SUB-SKILL, Tasks bite-sized red→green→refactor, código real, paths absolutos). Execute um plano por vez via `superpowers:subagent-driven-development` (subagente por Task + revisão entre Tasks) ou `superpowers:executing-plans` (em lote com checkpoints). Mantenha a suíte verde (API 241/42, Web 183/40) a cada Task.

## Decisões de arquitetura já tomadas
1. **Banco:** hardening de SQLite (WAL+busy_timeout+backup) no **curto** como stopgap; **migração para PostgreSQL no médio prazo** (Json/enums nativos, réplicas, retenção/anonimização LGPD).
2. **Auth front:** endurecer `localStorage` agora (checar `exp`, logout-on-401 global, sanitizar XSS, parar de gravar PHI); **cookie HttpOnly + refresh token no médio prazo**.
3. **Pagamento:** curto = gatear `/payments/:id/confirm` por `NODE_ENV` + exigir status real + fail-fast de `ASAAS_API_KEY`; **webhook Asaas idempotente no médio prazo** (cron vira reconciliação).

---

## Specs de design (4)
Leia a spec antes do(s) plano(s) correspondente(s) — ela contém a justificativa e as alternativas rejeitadas.

| Spec | Cobre | Planos que a implementam |
|---|---|---|
| [`specs/2026-05-31-seguranca-hardening-design.md`](../specs/2026-05-31-seguranca-hardening-design.md) | Autorização por ownership, sanitização XSS, fail-fast/fail-closed, localStorage→cookie | curto-01, medio-03 |
| [`specs/2026-05-31-integridade-pagamento-agendamento-design.md`](../specs/2026-05-31-integridade-pagamento-agendamento-design.md) | Transação pagamento→consulta, idempotência, anti double-booking, webhook | curto-02, medio-05 |
| [`specs/2026-05-31-confiabilidade-email-obs-deploy-design.md`](../specs/2026-05-31-confiabilidade-email-obs-deploy-design.md) | Outbox worker, reset/verify, observabilidade, deploy/migrations/backup | medio-01, medio-02, curto-03 |
| [`specs/2026-05-31-postgres-migration-lgpd-design.md`](../specs/2026-05-31-postgres-migration-lgpd-design.md) | SQLite→Postgres, enums/Json nativos, retenção/anonimização LGPD | medio-04 |

---

## 🔴 Curto prazo — pré-produção (criticais + altos urgentes)
Bloqueiam um go-live seguro. Fazer primeiro, nesta ordem.

| # | Plano | Gaps principais (sev.) | Tasks | Depende de |
|---|---|---|---|---|
| C1 | [`curto-01-seguranca-criticos`](2026-05-31-curto-01-seguranca-criticos.md) | IDOR vídeo (CRÍT), gate `/confirm` (CRÍT), fail-fast Asaas (CRÍT), XSS prontuário (ALTO), `console.log` PII, `dev-secret-key`, CORS fail-closed, PHI no localStorage | 11 | — |
| C2 | [`curto-02-integridade-pagamento-agendamento`](2026-05-31-curto-02-integridade-pagamento-agendamento.md) | `$transaction` confirm+delete, `@unique(paymentId)`, anti double-booking + `@@unique(doctorId,date)`, lock de cron, data passada, `consultationModelId` inválido | 8 | C1 (toca payment) |
| C3 | [`curto-03-ops-ci-hygiene`](2026-05-31-curto-03-ops-ci-hygiene.md) | jest e2e separado (CI verde), typecheck no CI, SQLite WAL+busy_timeout, `migrate deploy` no boot, backup Litestream, remover `stripe`, README/SQUAD_LOG/path do plano antigo | 9 | — |

## 🟠 Médio prazo — robustez e fechamento de fluxos
| # | Plano | Gaps principais (sev.) | Tasks | Depende de |
|---|---|---|---|---|
| M1 | [`medio-01-entrega-email-e-reset`](2026-05-31-medio-01-entrega-email-e-reset.md) | Outbox worker `@Cron`+backoff (ALTO), reset/verify ponta-a-ponta (ALTO) | 10 | — |
| M2 | [`medio-02-observabilidade`](2026-05-31-medio-02-observabilidade.md) | `AllExceptionsFilter`, `unhandledRejection`, Sentry, métricas `/metrics` (ALTO) | 12 | — |
| M3 | [`medio-03-auth-cookie-refresh`](2026-05-31-medio-03-auth-cookie-refresh.md) | JWT em cookie HttpOnly + refresh, logout-on-401 global, helper de decode único | 11 | C1 |
| M4 | [`medio-04-postgres-migration`](2026-05-31-medio-04-postgres-migration.md) | SQLite→Postgres, Json/enums nativos, soft-delete+anonimização LGPD, `@@unique` agendamento | 7 | C2, C3 |
| M5 | [`medio-05-asaas-webhook`](2026-05-31-medio-05-asaas-webhook.md) | Webhook Asaas idempotente, cron→reconciliação (ALTO) | 8 | C2 |
| M6 | [`medio-06-cancelamento-reagendamento`](2026-05-31-medio-06-cancelamento-reagendamento.md) | Cancelar/reagendar consulta — **gap de MVP** (ALTO) | 8 | C2 (usa `findOverlappingForDoctor`) |

## 🟡 Longo prazo — qualidade, cobertura e produto
| # | Plano | Gaps principais (sev.) | Tasks | Depende de |
|---|---|---|---|---|
| L1 | [`longo-01-qualidade-arquitetura`](2026-05-31-longo-01-qualidade-arquitetura.md) | `strict:true` real, zero `any`, DTOs clínicos, RBAC guard unificado, `Error`→HttpException, auditoria de assinatura | 6 | — |
| L2 | [`longo-02-frontend-a11y-decomposicao`](2026-05-31-longo-02-frontend-a11y-decomposicao.md) | Focus-trap modais, decompor `agenda/page.tsx`, key de slot estável | 5 | — |
| L3 | [`longo-03-testes-ci-e2e`](2026-05-31-longo-03-testes-ci-e2e.md) | Integração com DB real, Playwright no CI, worker leak, polling vs setTimeout, timing-mitigation, `@SkipThrottle` | 8 | C3 |
| L4 | [`longo-04-produto-features-e-limpeza`](2026-05-31-longo-04-produto-features-e-limpeza.md) | Atestados PDF (cifrados), métricas, recibos, Swagger, busca prontuário, limpeza `squads/` | 20 | M4 (cifra/Json) |

**Total: 123 Tasks TDD** em 13 planos + 4 specs. (O plano antigo [`2026-04-09-features-bundle.md`](2026-04-09-features-bundle.md) é reaproveitado/corrigido pelo L4 — não execute o original: tem path errado e specs já existentes.)

---

## Ordem de execução recomendada
`C1 → C2 → C3` (libera prod) → `M1, M2` (paralelizáveis) → `M5, M6` → `M3` → `M4` (migração; depois dela o L4 ganha Json/cifra) → `L1, L2, L3` (paralelizáveis) → `L4`.

---

## ⚠️ Decisões em aberto (precisam de você antes/durante a execução)
Consolidadas dos `openQuestions` dos planos. As de **infra/produto** bloqueiam Tasks específicas.

**Autorização de dependências** (regra de safety: `npm install` exige OK explícito):
- C1/M1: `sanitize-html`, `joi` — C3: (remoção de `stripe`) — M2: `@sentry/node`, `prom-client` — M3: `cookie-parser` — L4: `pdfkit`, `recharts`. Autorizo instalar localmente nos workspaces?

**Dados & infra:**
- Antes das migrations `@unique`/`@@unique` (C2/M4): o `dev.db`/prod tem duplicatas de `paymentId` ou `(doctorId,date)`? Precisa limpeza prévia.
- Postgres (M4): instância isolada **ou** o Postgres compartilhado do VPS com role/database `hope` dedicados? Afeta `docker-compose.prod.yml` (hoje sem serviço de DB) e backup/PITR.
- Backup SQLite (C3): destino do Litestream (S3/MinIO + credenciais) — ou cron de snapshot off-host?
- `/metrics` (M2) e webhook Asaas (M5): atrás do Traefik/rede interna, ou guard/allowlist de IP? Nome/secret reais do header (`asaas-access-token` / `ASAAS_WEBHOOK_TOKEN`).

**Produto / negócio:**
- Gate de `/confirm` por `NODE_ENV` (C1): o staging roda como `production`? Pode quebrar QA.
- Janela de antecedência de cancelamento (M6): 24h fixo, configurável por médico, ou por método de pagamento? Reembolso Asaas automático no cancelamento — sim/não?
- `verifyEmail` (M1): basta marcar o token como usado, ou precisa de `User.emailVerifiedAt` persistido?
- Existe role `ADMIN` em produção? (M4 enum, L1 RBAC).
- Retenção legal do prontuário (CFM ~20 anos) e base jurídica da anonimização (M4) — validar com DPO/jurídico.

---

## Critérios de pronto (por plano)
1. Todas as Tasks com teste vermelho→verde; suíte relevante passa.
2. `npx tsc --noEmit` (API) sem erros novos.
3. UI validada no browser (Playwright) nos planos visuais (L2, partes do L4).
4. `git diff` revisado; commits pequenos por contexto (já embutidos nos passos).

## Fonte
Gerado a partir da auditoria de gaps de 2026-05-31. Os specs ancoram cada decisão em `arquivo:linha` do código real; os planos foram autorados lendo os fontes (sem placeholders).
