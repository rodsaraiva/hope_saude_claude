# Migração para PostgreSQL & Retenção/Apagamento LGPD — Design Spec

**Data:** 2026-05-31
**Tipo:** Design doc (spec)
**Horizonte:** Médio prazo
**Plano TDD correspondente:** `medio-postgres-migration` (a ser escrito em `docs/superpowers/plans/`)
**Status atual do código:** API 241 testes / 42 suítes verdes; Web 183 / 40 verdes.

---

## 1. Contexto / Problema

O `apps/api` roda hoje sobre **SQLite com provider e URL hardcoded** no schema Prisma:

```prisma
// apps/api/prisma/schema.prisma:1-4
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

Em produção (Docker Swarm) o banco é um arquivo `dev.db` num bind mount único (`docker-compose.prod.yml:19-20`, `volumes: /opt/hope_saude/data:/app/prisma`) com `replicas: 1` (`docker-compose.prod.yml:30`). Isso impõe limitações estruturais que se chocam com os requisitos de uma plataforma de telepsiquiatria sob LGPD/CFM:

### 1.1. Achados da auditoria (arquivo:linha)

- **Provider e URL hardcoded** — `schema.prisma:1-4`. A URL `"file:./dev.db"` é literal, ignorando `DATABASE_URL` do `.env.example:2`. O `PrismaService` (`apps/api/src/prisma.service.ts:1-13`) instancia `PrismaClient` sem configuração explícita, herdando a URL do schema. Resultado: o env existe mas não é usado para apontar o banco.

- **JSON-as-String** (SQLite não tem tipo `Json`):
  - `DoctorProfile.availability String?` — `schema.prisma:50`. Lido por parsing manual em `AvailableSlotsService.getAvailableSlots` via `parseAvailabilityJson(profile.availability ?? null)` (`available-slots.service.ts:51`), que faz `JSON.parse` defensivo e devolve `[]` em qualquer falha (`weekly-availability.ts:66-98`). Validação na escrita por `assertValidDoctorAvailabilityJson` (`weekly-availability.ts:37-64`).
  - `Prescription.medications String` — `schema.prisma:140` ("JSON string contendo array de medicamentos"). Serializado com `JSON.stringify` no fluxo de assinatura (`prescription.service.ts:144`).
  - `ClinicalScale.answers String?` — `schema.prisma:166` ("JSON array de respostas"). Persistido com `JSON.stringify(answers)` (`clinical-scale.service.ts:146`) e lido com `JSON.parse` nos testes (`clinical-scale.service.spec.ts:131`).

- **Enums-as-String com comentário explícito de workaround**:
  - `User.role String @default("PATIENT")` — `schema.prisma:15`, comentário "Alterado para String para melhor compatibilidade SQLite". O domínio real é mais amplo que o tipo TS atual: `auth.types.ts:6` define `UserRole = 'DOCTOR' | 'PATIENT'`, mas há `@Roles('DOCTOR')`/`@Roles('PATIENT')` em controllers (`auth.controller.ts:79,89`) e `user.role as UserRole` em runtime (`auth.service.ts:72`). **Decisão de mapeamento de dados precisa contemplar `ADMIN` se existir em prod** (ver §6, questão aberta).
  - `Appointment.status String @default("CONFIRMED")` — `schema.prisma:75` (valores: CONFIRMED, COMPLETED, CANCELLED).
  - `MedicalRecord.status/type/template` — `schema.prisma:101-103` (DRAFT|SIGNED; EVOLUTION|ANAMNESIS; FREE|SOAP).
  - `Prescription.status String @default("DRAFT")` — `schema.prisma:143` (DRAFT|SIGNED).
  - `ClinicalScale.type/status/severity` — `schema.prisma:163,164,168` (PHQ9|GAD7|AUDIT|MOCA; PENDING|COMPLETED|EXPIRED; mínima|leve|moderada|moderadamente grave|grave).
  - `EmailOutbox.status` — `schema.prisma:200` (PENDING|SENT|FAILED) e tokens (`PasswordResetToken`, `EmailVerificationToken`).

- **`onDelete: RESTRICT` em todas as FKs para `User`** — confirmado na migração `20260408141426_add_email_outbox_and_auth_tokens/migration.sql` (`ON DELETE RESTRICT ON UPDATE CASCADE` em `DoctorProfile`, `PatientProfile`, `Appointment`, `MedicalRecord`, `Prescription`). Isso significa que **um usuário com qualquer registro vinculado não pode ser deletado** — bloqueio total ao "direito de apagamento" da LGPD (art. 18, VI). Ao mesmo tempo, `PasswordResetToken.userId` e `EmailVerificationToken.userId` (`schema.prisma:214,226`) são **`Int` solto, sem relação FK** — esses tokens viram lixo órfão e não deveriam sobreviver à exclusão do usuário.

- **FTS de prontuário incompatível com criptografia** — `MedicalRecord.content` é "encriptado via AES-256-GCM em repouso" (`schema.prisma:100`; `medical-record.service.ts:12-24,75`). O `CryptographyService` é **não-determinístico por design** (IV aleatório de 12 bytes — `cryptography.service.ts:5-9,81`), logo `where: { content: { contains: search } }` "não funciona após criptografia", como o próprio código admite em comentário (`medical-record.service.ts:101-107`). A busca textual de prontuário é hoje uma feature morta.

- **Concorrência / réplicas / backup** — SQLite serializa escritas (lock de arquivo) e não suporta `replicas > 1`. O hardening de curto prazo (WAL + busy_timeout + backup) é stopgap; PITR e réplicas de leitura só existem no Postgres.

### 1.2. Por que agora (médio prazo)

O hardening de SQLite (WAL/busy_timeout/backup) já está planejado no **curto prazo** como stopgap. Esta spec define o destino de **médio prazo**: PostgreSQL gerenciado pelo VPS (o `Postgres compartilhado` já hospeda Alana/N8N/Evolution), habilitando tipos nativos (Json, enums), índices apropriados, blind-index/FTS, réplicas e, sobretudo, a **infraestrutura de retenção/anonimização LGPD** que o `onDelete: RESTRICT` atual torna impossível.

---

## 2. Objetivos e Não-objetivos

### Objetivos

1. Trocar o datasource Prisma de `sqlite` para `postgresql`, lendo `env("DATABASE_URL")`; `PrismaService` passa a respeitar a env.
2. Converter os campos JSON-as-String para tipo `Json` nativo, eliminando parsing manual onde for seguro.
3. Converter os campos Enum-as-String para `enum` Prisma nativo (com CHECK no Postgres), definindo o mapeamento de dados legados.
4. Reescrever a política de FK: FK real com `onDelete` apropriado nos tokens de auth; soft-delete + anonimização de PII para `User`, preservando prontuário pelo prazo legal (CFM).
5. Definir a estratégia de busca de prontuário (blind-index determinístico de termos não-sensíveis) **ou** documentar explicitamente que FTS de conteúdo clínico fica fora de escopo.
6. Especificar backup/PITR e réplicas como responsabilidade do Postgres.
7. Entregar um runbook de migração de dados (SQLite → Postgres) testável em staging antes de prod.

### Não-objetivos

- **Não** reescrever a lógica de domínio (slots, assinatura, escalas) — só a camada de persistência e tipos.
- **Não** implementar o webhook Asaas idempotente nem o hardening de auth no front (specs separadas).
- **Não** entregar FTS com ranking/stemming de conteúdo clínico criptografado nesta fase (ver §5.2 — fica fora de escopo, com blind-index como mitigação parcial).
- **Não** trocar o algoritmo de criptografia em repouso (AES-256-GCM permanece).
- **Não** detalhar passos TDD aqui — isso é responsabilidade do plano `medio-postgres-migration`.

---

## 3. Decisões de design

### 3.1. Datasource → PostgreSQL + `env("DATABASE_URL")`

```prisma
// schema.prisma (proposto)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

`migration_lock.toml` passa de `provider = "sqlite"` para `"postgresql"`. O `PrismaService` não precisa de mudança de código se o schema lê a env (o `PrismaClient` resolve `DATABASE_URL` automaticamente), mas o `.env.example:2` muda de `DATABASE_URL="file:./dev.db"` para uma URL Postgres de exemplo (ex.: `postgresql://hope:***@postgres:5432/hope?schema=public`).

**Boot fail-fast:** alinhado à decisão de pagamento (fail-fast no boot se `ASAAS_API_KEY` faltar), o boot deve falhar se `DATABASE_URL` ausente/inválida em produção, em vez de cair silenciosamente em `file:./dev.db`.

**Alternativa rejeitada:** manter SQLite com `litestream`/réplica de arquivo. Rejeitada — não resolve Json/enum nativos, índices parciais, blind-index, nem a anonimização transacional sob concorrência.

### 3.2. JSON-as-String → `Json` nativo

| Campo | Hoje | Proposto |
|---|---|---|
| `DoctorProfile.availability` | `String?` (`:50`) | `Json?` |
| `Prescription.medications` | `String` (`:140`) | `Json` |
| `ClinicalScale.answers` | `String?` (`:166`) | `Json?` |

Com `Json` nativo, o Prisma entrega/recebe objetos JS — `parseAvailabilityJson` (`weekly-availability.ts:66`) deixa de fazer `JSON.parse` e passa a apenas **validar o shape** (a validação `assertValidDoctorAvailabilityJson` permanece relevante, pois `Json` aceita qualquer JSON). Em `prescription.service.ts:144` o `JSON.stringify` para o payload de assinatura permanece (assinatura precisa de string canônica), mas a leitura/escrita do campo deixa de stringificar.

**Importante para a migração de dados:** os valores SQLite são strings; ao carregar no Postgres, precisam ser parseados para JSON válido. Linhas com JSON inválido (que hoje o `parseAvailabilityJson` mascarava como `[]`) **falham no load** — o runbook (§7) precisa de um passo de saneamento/relatório dessas linhas.

**Alternativa rejeitada:** `Jsonb` via `@db.JsonB`. Na prática Prisma + Postgres já usa `jsonb` por padrão para `Json`; deixar explícito é opcional. Mantemos o default (`jsonb`) por permitir índices GIN futuros.

### 3.3. Enum-as-String → `enum` Prisma nativo

Definir enums e mapear strings legadas. Proposta de enums:

```prisma
enum UserRole          { PATIENT DOCTOR ADMIN }      // ADMIN condicional — ver §6
enum AppointmentStatus { CONFIRMED COMPLETED CANCELLED }
enum RecordStatus      { DRAFT SIGNED }
enum RecordType        { EVOLUTION ANAMNESIS }
enum RecordTemplate    { FREE SOAP }
enum PrescriptionStatus{ DRAFT SIGNED }
enum ScaleType         { PHQ9 GAD7 AUDIT MOCA }
enum ScaleStatus       { PENDING COMPLETED EXPIRED }
enum ScaleSeverity     { MINIMA LEVE MODERADA MODERADAMENTE_GRAVE GRAVE }
enum OutboxStatus      { PENDING SENT FAILED }
```

**Atenção `ScaleSeverity`:** o schema hoje guarda **valores em português com acento e espaço** (`schema.prisma:168`: "mínima | leve | moderada | moderadamente grave | grave"). Enum Prisma não aceita acento/espaço, então: (a) os *membros* do enum são ASCII (`MINIMA`, `MODERADAMENTE_GRAVE`), e (b) a camada de serviço passa a mapear membro→label PT-BR ao expor, OU mantemos `severity` como `String?` e só validamos. **Decisão:** converter para enum ASCII + helper de label, porque é o que dá CHECK no banco; o impacto em `clinical-scale.service.ts` (cálculo de severidade) é um passo do plano TDD.

**`UserRole`:** `auth.types.ts:6` só tem `DOCTOR | PATIENT`. O default do schema é `PATIENT`. Se prod tiver `ADMIN`, o enum precisa incluí-lo e `auth.types.ts` precisa ser ampliado (`auth.service.ts:72` faz `as UserRole`). Confirmar antes da migração (§6).

**Mapeamento de dados legados:** todos os valores atuais já são as strings ASCII esperadas (exceto severity). A migração de dados (§7) faz `UPDATE` direto onde os valores já batem; para severity, aplica a tabela de-para. Linhas com valor fora do domínio (ex.: `role` inesperado) **bloqueiam** a criação do enum no Postgres — saneamento prévio obrigatório.

**Alternativa rejeitada:** manter `String` + CHECK constraint manual. Rejeitada — perde a tipagem forte do Prisma Client e o autocomplete; enums nativos dão ambos de graça.

### 3.4. FKs, soft-delete e o conflito retenção × apagamento

**Tokens de auth — FK real:** `PasswordResetToken.userId` e `EmailVerificationToken.userId` (`schema.prisma:214,226`) ganham relação:

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

`onDelete: Cascade` é seguro aqui — são tokens efêmeros, sem valor legal.

**`User` — soft-delete + anonimização (não hard-delete):** as FKs de `Appointment`, `MedicalRecord`, `Prescription`, `DoctorProfile`, `PatientProfile` para `User` **permanecem `RESTRICT`** de propósito — o prontuário não pode sumir. Adiciona-se ao `User`:

```prisma
deletedAt    DateTime?   // soft-delete (LGPD: data da solicitação de apagamento)
anonymizedAt DateTime?   // quando PII foi efetivamente anonimizada
```

O "apagamento" LGPD vira **anonimização de PII** mantendo o registro clínico:
- `User.name` → `"Paciente anonimizado #<id>"`, `User.email` → valor sintético único (preserva `@unique`), `User.password` → hash inutilizável.
- `PatientProfile.cpf/phone/medicalHistory` → `NULL` (CPF já é criptografado; aqui é remoção definitiva).
- `MedicalRecord.content` **permanece** (exigência CFM de guarda do prontuário ~20 anos), mas desvinculado de PII direta — o vínculo passa a ser apenas o `id` numérico.

**Conflito documentado (LGPD art. 18 × CFM):** o titular tem direito ao apagamento (LGPD art. 18, VI), mas o prontuário médico tem **guarda obrigatória** (Resolução CFM 1.821/2007 e correlatas, ~20 anos). A LGPD (art. 16, I) ressalva o cumprimento de obrigação legal/regulatória como base para retenção. **Decisão:** anonimizar PII e reter o prontuário pelo prazo legal; só após o prazo legal o registro clínico pode ser hard-deleted. Isso é uma escolha jurídica que **deve ser validada com o DPO/jurídico** (§6).

**Alternativa rejeitada:** hard-delete em cascata do `User`. Rejeitada — viola guarda de prontuário CFM e destrói a trilha de auditoria (`MedicalRecordAudit`, `schema.prisma:119-129`, hoje já `onDelete: Cascade` em relação ao record).

### 3.5. Índices

Os índices atuais migram 1:1 (`@@index` em Appointment, MedicalRecord, Prescription, ClinicalScale, PendingCheckout, EmailOutbox). No Postgres adiciona-se:
- Índice parcial em `User(deletedAt) WHERE deletedAt IS NULL` para o filtro padrão de queries.
- (Opcional) GIN em `DoctorProfile.availability` (Json) se surgir consulta por conteúdo.

---

## 4. Mudanças de modelo de dados / interfaces

### 4.1. `schema.prisma` (resumo das mudanças)

- `datasource`: `provider = "postgresql"`, `url = env("DATABASE_URL")`.
- Novos `enum` (§3.3) e troca dos campos `String` correspondentes para o enum.
- `availability`, `medications`, `answers` → `Json`/`Json?`.
- `User`: `+ deletedAt DateTime?`, `+ anonymizedAt DateTime?`, `+ relação` para `PasswordResetToken[]` e `EmailVerificationToken[]`.
- `PasswordResetToken`/`EmailVerificationToken`: `userId` ganha `@relation(... onDelete: Cascade)`.

### 4.2. Impacto em código (a ser tratado pelo plano TDD)

- `parseAvailabilityJson(raw: string | ...)` (`weekly-availability.ts:66`) → assinatura passa a aceitar `unknown`/`WeeklySlot[]` (Json já parseado). `AvailableSlotsService` (`available-slots.service.ts:51`) deixa de passar string.
- `prescription.service.ts` / `clinical-scale.service.ts`: leitura/escrita dos campos Json sem `JSON.parse`/`stringify` redundante (mantém o `stringify` só para o payload de assinatura em `prescription.service.ts:144`).
- `auth.types.ts:6` (`UserRole`) e usos (`auth.service.ts:72`) alinhados ao enum Prisma.
- Novo serviço/método de anonimização (ex.: `UserService.anonymize(userId)`), transacional, idempotente (checa `anonymizedAt`).
- `medical-record.service.ts:92-116`: o parâmetro `search` que hoje faz `contains` no ciphertext (feature morta) passa a consultar o blind-index (§5.2) **ou** é removido/documentado como no-op.

### 4.3. `PrismaService`

Sem mudança estrutural obrigatória (`prisma.service.ts` já só faz connect/disconnect). Opcional: adicionar pragmas/sessão Postgres se necessário; o boot fail-fast de `DATABASE_URL` pode viver no `main.ts`/módulo de config, não aqui.

---

## 5. Considerações de segurança / LGPD

### 5.1. PII e criptografia

- CPF/medicalHistory já são tratados como sensíveis (CPF criptografado via `CryptographyService`). Na anonimização, viram `NULL` (não basta "esconder", a remoção é definitiva).
- `MedicalRecord.content` continua AES-256-GCM (`cryptography.service.ts`); a migração de dados move o ciphertext **como está** (não decripta/re-encripta), preservando IV/tag/ciphertext no formato `iv:tag:ciphertext` (`cryptography.service.ts:88`). **A `DATA_ENCRYPTION_KEY` não muda** na migração — caso contrário todo o conteúdo fica ilegível.

### 5.2. FTS vs criptografia — blind-index ou fora de escopo

O conteúdo é não-determinístico (IV aleatório), então busca textual direta é impossível (`medical-record.service.ts:101`). Opções:

1. **Blind-index determinístico de termos não-sensíveis** (recomendado como mitigação parcial): manter uma tabela auxiliar `MedicalRecordSearchToken(recordId, tokenHash)` onde `tokenHash = HMAC-SHA256(termo_normalizado, chave_dedicada)`. Permite busca por igualdade de termo (ex.: "ansiedade", nome de medicação) sem expor conteúdo. **Não** dá ranking/stemming/like parcial. Usa o padrão de HMAC já existente (`cryptography.service.ts:32` `sign()`), mas com **chave dedicada de busca** (não a `JWT_SECRET`).
2. **Fora de escopo total:** documentar que prontuário não é pesquisável por conteúdo; busca clínica se dá por metadados (paciente, data, tipo) — os índices `@@index([patientId, createdAt])` etc. já cobrem isso.

**Decisão desta spec:** blind-index é **opcional** no escopo; se entrar, é o item de maior risco/complexidade e deve ser uma Task isolada. O default seguro é tratar FTS de conteúdo como **fora de escopo** e documentar. A escolha final fica como questão aberta (§6).

### 5.3. Retenção / anonimização

- Anonimização é **transacional e idempotente** (Postgres dá isolamento real; sob SQLite isso era frágil).
- Trilha de auditoria (`MedicalRecordAudit`) preservada; a anonimização do `User` **não** apaga auditorias — elas referenciam `changedByUserId` (Int solto, `schema.prisma:124`), que pode ser mantido como pseudônimo.
- Política de retenção: prontuário retido pelo prazo CFM; tokens de auth, `EmailOutbox` e `PendingCheckout` podem ter expurgo por idade (cron de retenção — fora desta spec, mencionado como follow-up).

---

## 6. Questões abertas (validar com humano)

1. **`ADMIN` existe em produção?** Define se `UserRole` enum inclui `ADMIN` e se `auth.types.ts:6` precisa ampliar. Sem confirmação, a criação do enum pode falhar no load se houver `role` fora de `{PATIENT, DOCTOR}`.
2. **Prazo legal exato de guarda do prontuário** (CFM ~20 anos) e base jurídica da anonimização — validar com DPO/jurídico antes de implementar o hard-delete pós-prazo.
3. **Blind-index entra no escopo desta migração ou vira follow-up?** Impacta tabela auxiliar, chave dedicada e re-indexação dos prontuários existentes.
4. **Instância Postgres:** usar o Postgres compartilhado do VPS (com database/role dedicados `hope`) ou subir instância isolada? Afeta `docker-compose.prod.yml` (hoje sem serviço de DB) e backup/PITR.
5. **`ScaleSeverity`:** virar enum ASCII + label PT-BR (com CHECK) ou permanecer `String?` validado? Impacta `clinical-scale.service.ts`.

---

## 7. Plano de rollout / risco

### 7.1. Runbook de migração de dados (testar em staging primeiro)

1. **Snapshot/backup** do `dev.db` de produção (`/opt/hope_saude/data`).
2. **Saneamento prévio (SQLite):** relatório de linhas com (a) JSON inválido em `availability`/`medications`/`answers`; (b) `role`/`status`/`type`/`severity` fora do domínio do enum. Corrigir/decidir descarte.
3. **Provisionar Postgres** (database + role dedicados; `DATABASE_URL` em `/opt/hope_saude/api.env`).
4. **Schema:** `prisma migrate` gera o schema Postgres novo (enums, Json, FKs, soft-delete).
5. **Load/transform:** script de ETL lê do SQLite e insere no Postgres convertendo string→Json e string→enum (de-para de severity), **sem tocar no ciphertext** de `MedicalRecord.content` (mover byte-a-byte). `DATA_ENCRYPTION_KEY` idêntica.
6. **Verificação:** contagens por tabela batem; amostragem de decriptação de `content` com a mesma chave; suíte de testes da API verde apontando para o Postgres de staging (`cd /root/rodrigo/hope_saude/apps/api && npx jest <arquivo> --no-coverage`).
7. **Cutover prod:** janela de manutenção, repetir 1–6 contra prod, atualizar `docker-compose.prod.yml` (remover bind mount de `dev.db`, adicionar `DATABASE_URL`/serviço DB), redeploy. Habilitar `replicas > 1` só **depois** de validar.

### 7.2. Riscos

- **Perda de dados na conversão** (JSON inválido, enum fora do domínio) — mitigado pelo passo 2 de saneamento e teste em staging.
- **Conteúdo ilegível** se a chave AES mudar — mitigado: chave constante, verificação de decriptação no passo 6.
- **Downtime no cutover** — mitigado por janela de manutenção e ensaio prévio em staging.
- **Replicação prematura** — só ligar `replicas > 1` após validar consistência.
- **Regressão de testes** por mudança de tipo (Json/enum) — TDD: testes vermelhos antes da implementação garantem cobertura (plano).

---

## 8. Esboço de Tasks (expandido pelo plano `medio-postgres-migration`)

> O plano TDD `medio-postgres-migration` detalha cada Task no ciclo red→green→refactor. Aqui fica só o esqueleto.

1. **Datasource + boot fail-fast:** trocar provider/url para Postgres + `env("DATABASE_URL")`; `migration_lock.toml`; boot falha sem `DATABASE_URL`; atualizar `.env.example`.
2. **Enums nativos:** declarar enums (§3.3); converter campos `String`→enum; alinhar `auth.types.ts`/`auth.service.ts`; de-para de `ScaleSeverity`.
3. **Json nativo:** `availability`/`medications`/`answers` → `Json`; ajustar `parseAvailabilityJson`, `AvailableSlotsService`, `prescription.service`, `clinical-scale.service`.
4. **FKs de tokens:** relação + `onDelete: Cascade` em `PasswordResetToken`/`EmailVerificationToken`.
5. **Soft-delete + anonimização:** campos `deletedAt`/`anonymizedAt` em `User`; serviço de anonimização transacional/idempotente; filtro padrão `deletedAt IS NULL`.
6. **(Opcional) Blind-index** de termos não-sensíveis para busca de prontuário, ou remoção/documentação do `search` morto em `medical-record.service.ts`.
7. **Índices** Postgres (parcial em `deletedAt`, GIN opcional).
8. **Runbook/ETL** de migração de dados + verificação em staging.
9. **Infra:** `docker-compose.prod.yml` (serviço/conn Postgres, backup/PITR, remoção do bind mount de `dev.db`).
