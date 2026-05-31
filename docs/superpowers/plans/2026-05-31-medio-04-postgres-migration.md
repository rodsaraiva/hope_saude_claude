# Migração SQLite → PostgreSQL + Política LGPD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o banco da API de SQLite para PostgreSQL, adotando tipos nativos (Json/enums), constraints e índices reais, e implementando soft-delete + anonimização LGPD com FKs reais nos tokens de auth.

**Architecture:** O `datasource db` do Prisma passa de `sqlite`/url hardcoded para `postgresql`/`env("DATABASE_URL")`. Em três ondas incrementais convertemos colunas `String` que carregam JSON (`DoctorProfile.availability`, `Prescription.medications`, `ClinicalScale.answers`) para `Json`, e os campos textuais de domínio (`role`, vários `status`, `type`, `template`, `severity`) para enums nativos do Prisma com data migration dos valores existentes. Depois adicionamos `deletedAt` (soft-delete) + um `AnonymizationService` que apaga PII (CPF/nome/email) preservando o prontuário (CFM 1.821/07 exige guarda ≥20 anos), e trocamos as relações soltas dos tokens de auth por FKs reais com `onDelete: Cascade`. Por fim, índices/constraints são revisados e um runbook documenta a migração de dados staging-first e o CI roda contra um service container Postgres. A suíte (241 testes/42 suítes) permanece verde a cada Task — os specs unitários usam mock de Prisma, então o impacto é em DTO/shape, não em conexão real.

**Tech Stack:** NestJS 11, Prisma 5 (datasource PostgreSQL 16), PrismaClient, Jest (ts-jest, isolatedModules), GitHub Actions (service container `postgres:16`), Docker Swarm (`docker-compose.prod.yml`).

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma` | Provider `postgresql` + `env("DATABASE_URL")`; Json; enums; `deletedAt`; FKs reais nos tokens |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/prisma.service.ts` | Sem mudança de conexão (já usa env via PrismaClient); doc do datasource |
| Modify | `/root/rodrigo/hope_saude/apps/api/.env.example` | `DATABASE_URL` → string de conexão Postgres + `SHADOW_DATABASE_URL` |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/availability/weekly-availability.ts` | `parseAvailabilityJson`/`assertValid...` aceitam `unknown` (Json) além de `string` |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.ts` | `answers` gravado/lido como array nativo (sem `JSON.stringify`) |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/prescription/prescription.service.ts` | `medications` (string criptografada) permanece coluna `String` — comentário de exclusão de Json |
| Create | `/root/rodrigo/hope_saude/apps/api/src/lgpd/anonymization.service.ts` | Soft-delete + anonimização de PII preservando prontuário |
| Create | `/root/rodrigo/hope_saude/apps/api/src/lgpd/anonymization.service.spec.ts` | Testes do `AnonymizationService` |
| Create | `/root/rodrigo/hope_saude/apps/api/src/lgpd/lgpd.module.ts` | Módulo que provê `AnonymizationService` |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/app.module.ts` | Importa `LgpdModule` |
| Create | `/root/rodrigo/hope_saude/apps/api/docker-compose.dev.yml` | Service Postgres local para dev/teste |
| Modify | `/root/rodrigo/hope_saude/.github/workflows/ci.yml` | Service container `postgres:16` + `prisma migrate deploy` + `DATABASE_URL` Postgres |
| Modify | `/root/rodrigo/hope_saude/docker-compose.prod.yml` | Service `db` Postgres + volume + `DATABASE_URL` da API |
| Create | `/root/rodrigo/hope_saude/docs/runbooks/postgres-migration.md` | Runbook de migração de dados SQLite→Postgres staging-first |

---

## Tasks

### Task 1 — Trocar provider para PostgreSQL e baseline da migração

Converte o datasource e gera a migração baseline. Pré-requisito de tudo: sem Postgres rodando, nenhuma migração aplica. Reversível: `git revert` + reapontar `DATABASE_URL` para `file:./dev.db`.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Modify: `/root/rodrigo/hope_saude/apps/api/.env.example`
- Create: `/root/rodrigo/hope_saude/apps/api/docker-compose.dev.yml`
- Create: `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<timestamp>_init_postgres/migration.sql` (gerado pelo Prisma)
- Test: validação via `prisma migrate diff` (sem spec novo)

- [ ] **Step 1: Subir Postgres local de teste**

  Crie `/root/rodrigo/hope_saude/apps/api/docker-compose.dev.yml`:

  ```yaml
  # Postgres local para desenvolvimento e testes da API.
  # Uso: docker compose -f docker-compose.dev.yml up -d
  # DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public"
  services:
    db:
      image: postgres:16-alpine
      environment:
        POSTGRES_USER: hope
        POSTGRES_PASSWORD: hope
        POSTGRES_DB: hope_dev
      ports:
        - "5433:5432"
      volumes:
        - hope_pg_dev:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U hope -d hope_dev"]
        interval: 5s
        timeout: 5s
        retries: 10

  volumes:
    hope_pg_dev:
  ```

  Suba:

  ```bash
  docker compose -f /root/rodrigo/hope_saude/apps/api/docker-compose.dev.yml up -d
  until docker compose -f /root/rodrigo/hope_saude/apps/api/docker-compose.dev.yml exec -T db pg_isready -U hope -d hope_dev; do sleep 1; done
  ```

- [ ] **Step 2: Editar o datasource e o `.env.example` (red — `prisma validate` contra Postgres ainda sem migração)**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, substitua o bloco `datasource db`:

  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```

  Em `/root/rodrigo/hope_saude/apps/api/.env.example`, substitua a linha `DATABASE_URL="file:./dev.db"` por:

  ```bash
  # Postgres local (docker compose -f apps/api/docker-compose.dev.yml up -d)
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public"
  # Shadow DB usado por `prisma migrate dev` (criada/derrubada automaticamente)
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public"
  ```

  Adicione `shadowDatabaseUrl` ao datasource:

  ```prisma
  datasource db {
    provider          = "postgresql"
    url               = env("DATABASE_URL")
    shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
  }
  ```

- [ ] **Step 3: Verificar que a migração SQLite legada é incompatível e remover o lock SQLite**

  A migração existente `20260408141426_add_email_outbox_and_auth_tokens/migration.sql` usa sintaxe SQLite (`AUTOINCREMENT`, `DATETIME`, `REAL`) e o `migration_lock.toml` está fixado em `sqlite`. Confirme:

  ```bash
  cat /root/rodrigo/hope_saude/apps/api/prisma/migrations/migration_lock.toml
  ```

  Saída esperada: contém `provider = "sqlite"`. Mova a migração legada e o lock para um diretório de arquivo (reversível, não apaga):

  ```bash
  mkdir -p /root/rodrigo/hope_saude/apps/api/prisma/migrations_sqlite_archive
  git mv /root/rodrigo/hope_saude/apps/api/prisma/migrations/20260408141426_add_email_outbox_and_auth_tokens \
         /root/rodrigo/hope_saude/apps/api/prisma/migrations_sqlite_archive/
  git mv /root/rodrigo/hope_saude/apps/api/prisma/migrations/migration_lock.toml \
         /root/rodrigo/hope_saude/apps/api/prisma/migrations_sqlite_archive/
  ```

- [ ] **Step 4: Gerar a migração baseline Postgres e aplicá-la (green)**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public" \
  npx prisma migrate dev --name init_postgres
  ```

  Saída esperada: cria `prisma/migrations/<timestamp>_init_postgres/migration.sql` com `SERIAL`/`TIMESTAMP`/`DOUBLE PRECISION`, novo `migration_lock.toml` com `provider = "postgresql"`, e termina com `Your database is now in sync with your schema.` Em seguida:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma --exit-code
  ```

  Saída esperada: exit code `0` (sem drift entre schema e migrações).

- [ ] **Step 5: Rodar a suíte para confirmar que nada quebrou (green)**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  JWT_SECRET="ci-test-secret-not-for-production" \
  DATA_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  npx prisma generate && npx jest --no-coverage 2>&1 | tail -20
  ```

  Saída esperada: `Test Suites: 42 passed, 42 total` / `Tests: 241 passed, 241 total`.

- [ ] **Step 6: Commit**

  ```bash
  git add /root/rodrigo/hope_saude/apps/api/prisma/schema.prisma \
          /root/rodrigo/hope_saude/apps/api/.env.example \
          /root/rodrigo/hope_saude/apps/api/docker-compose.dev.yml \
          /root/rodrigo/hope_saude/apps/api/prisma/migrations \
          /root/rodrigo/hope_saude/apps/api/prisma/migrations_sqlite_archive
  git commit -m "feat(api): migrar datasource Prisma de SQLite para PostgreSQL com migração baseline"
  ```

---

### Task 2 — `ClinicalScale.answers` String→Json

`answers` é o único JSON que NÃO é criptografado e que é re-parseado no consumo. Convertê-lo primeiro porque é o caso mais isolado (único service, spec curto). `medications` permanece `String` (texto criptografado AES-GCM, não é JSON em repouso) e `availability` é tratado na Task 3.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.spec.ts`

- [ ] **Step 1: Write the failing test**

  Em `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.spec.ts`, localize a asserção atual `expect(JSON.parse(call.data.answers)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2]);` (linha ~131) e substitua-a por uma asserção que exige array nativo:

  ```ts
      expect(call.data.answers).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2]);
      expect(typeof call.data.answers).not.toBe('string');
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/clinical-scale/clinical-scale.service.spec.ts --no-coverage 2>&1 | tail -15
  ```

  Saída esperada: falha com algo como `Received: "[2,2,2,2,2,2,2,2,2]"` (string) `!=` array, e `typeof ... toBe('string')` violado.

- [ ] **Step 3: Write minimal implementation**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, no model `ClinicalScale`, troque:

  ```prisma
    answers     String?  // JSON array de respostas (índice → score)
  ```

  por:

  ```prisma
    answers     Json?    // array nativo de respostas (índice → score)
  ```

  Em `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.ts`, dentro de `submitAnswers`, troque:

  ```ts
        answers: JSON.stringify(answers),
  ```

  por:

  ```ts
        answers,
  ```

  Gere o client e a migração:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public" \
  npx prisma migrate dev --name clinicalscale_answers_json
  ```

  A migração gerada faz `ALTER TABLE "ClinicalScale" ALTER COLUMN "answers" TYPE JSONB USING "answers"::jsonb;` (Prisma escreve o `USING` para colunas vazias/nulas; em staging com dados, ver runbook na Task 7).

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma generate && \
  npx jest src/clinical-scale/clinical-scale.service.spec.ts --no-coverage 2>&1 | tail -10
  ```

  Saída esperada: `Tests: <N> passed`.

- [ ] **Step 5: Commit**

  ```bash
  git add /root/rodrigo/hope_saude/apps/api/prisma/schema.prisma \
          /root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.ts \
          /root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.spec.ts \
          /root/rodrigo/hope_saude/apps/api/prisma/migrations
  git commit -m "feat(api): ClinicalScale.answers passa a Json nativo (sem stringify)"
  ```

---

### Task 3 — `DoctorProfile.availability` String→Json (parsing tolerante)

`availability` é lido por `parseAvailabilityJson`/`assertValidDoctorAvailabilityJson` que hoje recebem `string` e fazem `JSON.parse`. Com `Json`, o Prisma devolve o array já desserializado. Ambas as funções precisam aceitar `unknown` (valor já parseado) sem quebrar o caminho legado de string.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/availability/weekly-availability.ts`
- Test: `/root/rodrigo/hope_saude/apps/api/src/availability/weekly-availability.spec.ts`

- [ ] **Step 1: Write the failing test**

  Em `/root/rodrigo/hope_saude/apps/api/src/availability/weekly-availability.spec.ts`, adicione no topo o import (se ainda não existir, ele já importa de `./weekly-availability`) e acrescente um novo `describe` ao final do arquivo, antes do último `});`:

  ```ts
  describe('parseAvailabilityJson aceita Json nativo (Postgres)', () => {
    it('devolve slots quando recebe array já desserializado (não-string)', () => {
      const native = [{ day: 'Segunda', start: '08:00', end: '09:00', id: 1 }];
      const result = parseAvailabilityJson(native as unknown as never);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ day: 'Segunda', start: '08:00', end: '09:00' });
    });

    it('continua tolerando string JSON legada', () => {
      const raw = JSON.stringify([{ day: 'Terça', start: '10:00', end: '11:00' }]);
      const result = parseAvailabilityJson(raw);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ day: 'Terça', start: '10:00', end: '11:00' });
    });

    it('devolve [] para null/objeto inválido', () => {
      expect(parseAvailabilityJson(null)).toEqual([]);
      expect(parseAvailabilityJson({ foo: 'bar' } as unknown as never)).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/availability/weekly-availability.spec.ts --no-coverage 2>&1 | tail -15
  ```

  Saída esperada: o caso "array já desserializado" falha — a assinatura atual exige `string | null | undefined` e o corpo chama `JSON.parse(raw)` num objeto, retornando `[]`.

- [ ] **Step 3: Write minimal implementation**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, no model `DoctorProfile`, troque:

  ```prisma
    availability String?  // SQLite usa String para armazenar JSON serializado
  ```

  por:

  ```prisma
    availability Json?    // array nativo de slots semanais
  ```

  Em `/root/rodrigo/hope_saude/apps/api/src/availability/weekly-availability.ts`, substitua a função `parseAvailabilityJson` inteira por uma versão que aceita `unknown`:

  ```ts
  export function parseAvailabilityJson(raw: unknown): WeeklySlot[] {
    if (raw == null) {
      return [];
    }
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      if (raw.trim() === '') {
        return [];
      }
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) {
      return [];
    }
    const out: WeeklySlot[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        ('day' in item || 'date' in item) &&
        'start' in item &&
        'end' in item
      ) {
        out.push({
          id: (item as any).id,
          date: (item as any).date,
          day: (item as any).day,
          start: (item as { start: string }).start,
          end: (item as { end: string }).end,
          recurrence: (item as any).recurrence,
        });
      }
    }
    return out;
  }
  ```

  No `available-slots.service.ts`, a chamada `parseAvailabilityJson(profile.availability ?? null)` continua válida: com `Json`, `profile.availability` chega como `unknown` (array ou null) e a nova assinatura `unknown` o aceita. Nenhuma mudança extra é necessária ali.

  Gere a migração:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public" \
  npx prisma migrate dev --name doctorprofile_availability_json
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma generate && \
  npx jest src/availability --no-coverage 2>&1 | tail -10
  ```

  Saída esperada: todas as suítes de `src/availability` passam (`weekly-availability` e `available-slots.service`).

- [ ] **Step 5: Commit**

  ```bash
  git add /root/rodrigo/hope_saude/apps/api/prisma/schema.prisma \
          /root/rodrigo/hope_saude/apps/api/src/availability/weekly-availability.ts \
          /root/rodrigo/hope_saude/apps/api/src/availability/weekly-availability.spec.ts \
          /root/rodrigo/hope_saude/apps/api/prisma/migrations
  git commit -m "feat(api): DoctorProfile.availability passa a Json; parser tolerante a string legada"
  ```

---

### Task 4 — Enums Prisma nativos (`role`/`status`/`type`/`template`/`severity`)

Converte os campos textuais de domínio para enums Postgres nativos. A data migration mapeia valores existentes (todos já usam os literais corretos — `PATIENT`, `CONFIRMED`, `DRAFT`, etc.) então o cast é direto. Mantemos os valores string idênticos para não tocar nenhum service que compara `=== 'SIGNED'`.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/migrations/<timestamp>_native_enums/migration.sql` (editar o SQL gerado para incluir o `USING ... ::enum`)
- Test: `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.spec.ts` (asserções de literal continuam válidas)

- [ ] **Step 1: Write the failing test**

  Em `/root/rodrigo/hope_saude/apps/api/src/clinical-scale/clinical-scale.service.spec.ts`, adicione ao final (antes do último `});`) um teste que prova que o literal `'PENDING'` segue sendo aceito como valor do enum no payload de criação:

  ```ts
  describe('enums nativos preservam literais', () => {
    it('createScale envia status PENDING e type PHQ9 como string literal do enum', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 10 });
      mockPrisma.clinicalScale.create.mockResolvedValue({ id: 1, accessToken: 'x' });

      await service.createScale({ doctorId: 1, patientId: 2, type: 'PHQ9' });

      const call = mockPrisma.clinicalScale.create.mock.calls[0][0];
      expect(call.data.status).toBe('PENDING');
      expect(call.data.type).toBe('PHQ9');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/clinical-scale/clinical-scale.service.spec.ts --no-coverage 2>&1 | tail -10
  ```

  Saída esperada: este caso específico passa de cara (o service já envia os literais), mas o `npx prisma generate` ainda não conhece os enums — rode `npx tsc --noEmit -p tsconfig.json` para ver o erro de tipo do client antes da implementação (red de compilação):

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit 2>&1 | tail -5 || true
  ```

  Esperado neste ponto: sem erro ainda (enums não declarados). O "red" real é a ausência dos tipos enum — declaramos no Step 3.

- [ ] **Step 3: Write minimal implementation**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, adicione os enums no topo (após o bloco `generator`):

  ```prisma
  enum Role {
    PATIENT
    DOCTOR
    ADMIN
  }

  enum AppointmentStatus {
    CONFIRMED
    COMPLETED
    CANCELLED
  }

  enum RecordStatus {
    DRAFT
    SIGNED
  }

  enum RecordType {
    EVOLUTION
    ANAMNESIS
  }

  enum RecordTemplate {
    FREE
    SOAP
  }

  enum PrescriptionStatus {
    DRAFT
    SIGNED
  }

  enum ScaleType {
    PHQ9
    GAD7
    AUDIT
    MOCA
  }

  enum ScaleStatus {
    PENDING
    COMPLETED
    EXPIRED
  }

  enum ScaleSeverity {
    MINIMA
    LEVE
    MODERADA
    MODERADAMENTE_GRAVE
    GRAVE
  }

  enum OutboxStatus {
    PENDING
    SENT
    FAILED
  }
  ```

  Troque os campos correspondentes nos models (mantendo os defaults):

  - `User.role`: `Role @default(PATIENT)`
  - `Appointment.status`: `AppointmentStatus @default(CONFIRMED)`
  - `MedicalRecord.status`: `RecordStatus @default(DRAFT)`
  - `MedicalRecord.type`: `RecordType @default(EVOLUTION)`
  - `MedicalRecord.template`: `RecordTemplate @default(FREE)`
  - `Prescription.status`: `PrescriptionStatus @default(DRAFT)`
  - `ClinicalScale.type`: `ScaleType`
  - `ClinicalScale.status`: `ScaleStatus @default(PENDING)`
  - `ClinicalScale.severity`: `ScaleSeverity?`
  - `EmailOutbox.status`: `OutboxStatus @default(PENDING)`

  > Nota sobre `severity`: hoje o código grava strings com acento/minúsculas (`'mínima'`, `'moderadamente grave'`) vindas de `scale-definitions`. Como o enum precisa de identificadores ASCII, a data migration mapeia os valores legados → membros do enum, e `scale-definitions.classifySeverity` deve retornar os membros do enum. **Antes** de gerar a migração, verifique os valores reais retornados:
  >
  > ```bash
  > grep -rn "classifySeverity\|severity\|mínima\|moderada\|grave\|leve" /root/rodrigo/hope_saude/apps/api/src/clinical-scale/scales/scale-definitions.ts
  > ```
  >
  > Se `classifySeverity` retornar strings acentuadas, ajuste-as para os membros do enum (`MINIMA`, `LEVE`, `MODERADA`, `MODERADAMENTE_GRAVE`, `GRAVE`) — sem inventar nomes; use exatamente os listados acima — e atualize o spec de `scale-definitions` (procure por asserções de severidade) na mesma edição.

  Gere a migração **sem aplicar** para editar o `USING`:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public" \
  npx prisma migrate dev --name native_enums --create-only
  ```

  Edite o arquivo gerado `prisma/migrations/<timestamp>_native_enums/migration.sql`: o Prisma cria os tipos enum e altera as colunas. Garanta que cada `ALTER COLUMN ... TYPE "Enum"` use cast explícito. Exemplo do bloco para `ClinicalScale.severity` (substitua o `ALTER COLUMN "severity"` gerado por este, que normaliza os valores legados acentuados):

  ```sql
  -- Normaliza severidade legada (texto acentuado) → membros do enum
  UPDATE "ClinicalScale" SET "severity" = 'MINIMA' WHERE "severity" IN ('mínima', 'minima');
  UPDATE "ClinicalScale" SET "severity" = 'LEVE' WHERE "severity" = 'leve';
  UPDATE "ClinicalScale" SET "severity" = 'MODERADA' WHERE "severity" = 'moderada';
  UPDATE "ClinicalScale" SET "severity" = 'MODERADAMENTE_GRAVE' WHERE "severity" = 'moderadamente grave';
  UPDATE "ClinicalScale" SET "severity" = 'GRAVE' WHERE "severity" = 'grave';
  ALTER TABLE "ClinicalScale" ALTER COLUMN "severity" TYPE "ScaleSeverity" USING ("severity"::"ScaleSeverity");
  ```

  Aplique:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public" \
  npx prisma migrate dev
  ```

  Saída esperada: `The following migration(s) have been applied` + `Your database is now in sync`.

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma generate && npx tsc --noEmit && \
  JWT_SECRET="ci-test-secret-not-for-production" \
  DATA_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  npx jest --no-coverage 2>&1 | tail -15
  ```

  Saída esperada: `npx tsc --noEmit` sem erros e `Test Suites: 42 passed` / `Tests: 241 passed` (ou contagem atualizada com os testes novos das Tasks anteriores).

- [ ] **Step 5: Commit**

  ```bash
  git add /root/rodrigo/hope_saude/apps/api/prisma/schema.prisma \
          /root/rodrigo/hope_saude/apps/api/prisma/migrations \
          /root/rodrigo/hope_saude/apps/api/src/clinical-scale
  git commit -m "feat(api): enums Prisma nativos para role/status/type/template/severity com data migration"
  ```

---

### Task 5 — Soft-delete + `AnonymizationService` (LGPD) e FKs reais nos tokens de auth

Adiciona `deletedAt` a `User` (soft-delete) e cria um service que anonimiza PII de um usuário — CPF/nome/email — **preservando** `MedicalRecord`/`Prescription` (CFM 1.821/07: prontuário guardado ≥20 anos). Também troca as relações soltas de `PasswordResetToken`/`EmailVerificationToken` por FK real com `onDelete: Cascade`, para que apagar PII não deixe tokens órfãos.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Create: `/root/rodrigo/hope_saude/apps/api/src/lgpd/anonymization.service.ts`
- Create: `/root/rodrigo/hope_saude/apps/api/src/lgpd/anonymization.service.spec.ts`
- Create: `/root/rodrigo/hope_saude/apps/api/src/lgpd/lgpd.module.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing test**

  Crie `/root/rodrigo/hope_saude/apps/api/src/lgpd/anonymization.service.spec.ts`:

  ```ts
  import { Test } from '@nestjs/testing';
  import { NotFoundException } from '@nestjs/common';
  import { AnonymizationService } from './anonymization.service';
  import { PrismaService } from '../prisma.service';

  describe('AnonymizationService', () => {
    let service: AnonymizationService;

    const mockTx = {
      user: { update: jest.fn() },
      patientProfile: { updateMany: jest.fn() },
      passwordResetToken: { deleteMany: jest.fn() },
      emailVerificationToken: { deleteMany: jest.fn() },
    };

    const mockPrisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    };

    beforeEach(async () => {
      jest.clearAllMocks();
      const moduleRef = await Test.createTestingModule({
        providers: [AnonymizationService, { provide: PrismaService, useValue: mockPrisma }],
      }).compile();
      service = moduleRef.get(AnonymizationService);
    });

    it('lança NotFound quando o usuário não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.anonymizeUser(99)).rejects.toThrow(NotFoundException);
    });

    it('anonimiza nome/email, marca deletedAt e zera CPF do patientProfile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 7, email: 'a@b.com', name: 'Fulano' });
      mockTx.user.update.mockResolvedValue({ id: 7 });

      await service.anonymizeUser(7);

      const userUpdate = mockTx.user.update.mock.calls[0][0];
      expect(userUpdate.where).toEqual({ id: 7 });
      expect(userUpdate.data.name).toBe('Usuário Removido');
      expect(userUpdate.data.email).toBe('anon+7@anonimizado.local');
      expect(userUpdate.data.deletedAt).toBeInstanceOf(Date);

      expect(mockTx.patientProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: 7 },
        data: { cpf: null, phone: null },
      });
    });

    it('apaga tokens de reset e verificação do usuário (sem órfãos)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 7, email: 'a@b.com', name: 'Fulano' });
      mockTx.user.update.mockResolvedValue({ id: 7 });

      await service.anonymizeUser(7);

      expect(mockTx.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
      expect(mockTx.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    });

    it('NÃO toca em MedicalRecord/Prescription (guarda CFM)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 7, email: 'a@b.com', name: 'Fulano' });
      mockTx.user.update.mockResolvedValue({ id: 7 });

      await service.anonymizeUser(7);

      expect((mockTx as Record<string, unknown>).medicalRecord).toBeUndefined();
      expect((mockTx as Record<string, unknown>).prescription).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/lgpd/anonymization.service.spec.ts --no-coverage 2>&1 | tail -15
  ```

  Saída esperada: `Cannot find module './anonymization.service'`.

- [ ] **Step 3: Write minimal implementation**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, no model `User`, adicione o campo de soft-delete (após `updatedAt`):

  ```prisma
    deletedAt DateTime?
  ```

  Adicione a relação inversa de tokens no `User` (para a FK real):

  ```prisma
    passwordResetTokens     PasswordResetToken[]
    emailVerificationTokens EmailVerificationToken[]
  ```

  No model `PasswordResetToken`, troque o campo `userId Int` por uma relação real:

  ```prisma
    userId    Int
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ```

  No model `EmailVerificationToken`, idem:

  ```prisma
    userId    Int
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ```

  Gere a migração:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public" \
  npx prisma migrate dev --name lgpd_soft_delete_and_token_fks
  ```

  Crie `/root/rodrigo/hope_saude/apps/api/src/lgpd/anonymization.service.ts`:

  ```ts
  import { Injectable, NotFoundException } from '@nestjs/common';
  import { PrismaService } from '../prisma.service';

  /**
   * AnonymizationService — atende ao direito de eliminação (LGPD art. 18, VI)
   * sem violar a guarda obrigatória de prontuário (CFM 1.821/2007: ≥20 anos).
   *
   * Estratégia: soft-delete do User (deletedAt) + sobrescrita de PII direta
   * (nome, email, CPF, telefone). MedicalRecord/Prescription permanecem
   * intactos — continuam referenciando o userId, mas sem nenhum dado pessoal
   * identificável vinculado a ele.
   */
  @Injectable()
  export class AnonymizationService {
    constructor(private readonly prisma: PrismaService) {}

    async anonymizeUser(userId: number): Promise<void> {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Usuário não encontrado');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            name: 'Usuário Removido',
            email: `anon+${userId}@anonimizado.local`,
            deletedAt: new Date(),
          },
        });

        await tx.patientProfile.updateMany({
          where: { userId },
          data: { cpf: null, phone: null },
        });

        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.emailVerificationToken.deleteMany({ where: { userId } });
      });
    }
  }
  ```

  Crie `/root/rodrigo/hope_saude/apps/api/src/lgpd/lgpd.module.ts`:

  ```ts
  import { Module } from '@nestjs/common';
  import { PrismaService } from '../prisma.service';
  import { AnonymizationService } from './anonymization.service';

  @Module({
    providers: [PrismaService, AnonymizationService],
    exports: [AnonymizationService],
  })
  export class LgpdModule {}
  ```

  Em `/root/rodrigo/hope_saude/apps/api/src/app.module.ts`, adicione `LgpdModule` ao array `imports` (mantendo os demais módulos):

  ```ts
  import { LgpdModule } from './lgpd/lgpd.module';
  // ... dentro de @Module({ imports: [ ..., LgpdModule ] })
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma generate && \
  npx jest src/lgpd/anonymization.service.spec.ts --no-coverage 2>&1 | tail -10 && \
  JWT_SECRET="ci-test-secret-not-for-production" \
  DATA_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  npx jest --no-coverage 2>&1 | tail -6
  ```

  Saída esperada: a suíte do `anonymization.service` passa (4 testes) e a suíte completa segue verde (`Tests: <N> passed`).

- [ ] **Step 5: Commit**

  ```bash
  git add /root/rodrigo/hope_saude/apps/api/prisma/schema.prisma \
          /root/rodrigo/hope_saude/apps/api/prisma/migrations \
          /root/rodrigo/hope_saude/apps/api/src/lgpd \
          /root/rodrigo/hope_saude/apps/api/src/app.module.ts
  git commit -m "feat(api): soft-delete + AnonymizationService (LGPD/CFM) e FK real nos tokens de auth"
  ```

---

### Task 6 — Índices/constraints revisados (unicidade de agendamento)

Postgres permite constraints que SQLite tolerava mal. Adiciona `@@unique([doctorId, date])` em `Appointment` e `PendingCheckout` para impedir double-booking no nível do banco (hoje só há `@@index`). A exclusion constraint para overlap (`btree_gist`) fica documentada como opcional no runbook, fora do escopo automatizado.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Test: `/root/rodrigo/hope_saude/apps/api/test/appointment-unique.e2e-spec.ts` (novo — usa DB real)

- [ ] **Step 1: Write the failing test**

  Crie `/root/rodrigo/hope_saude/apps/api/test/appointment-unique.e2e-spec.ts`. Este teste usa o PrismaClient real contra o Postgres de dev e prova que a segunda inserção no mesmo `(doctorId, date)` viola a unicidade (P2002):

  ```ts
  import { PrismaClient } from '@prisma/client';

  describe('Appointment unicidade (doctorId, date)', () => {
    const prisma = new PrismaClient();
    let patient: { id: number };
    let doctor: { id: number };
    const date = new Date('2099-01-01T10:00:00.000Z');

    beforeAll(async () => {
      await prisma.$connect();
      patient = await prisma.user.create({
        data: { email: `p${Date.now()}@t.local`, password: 'x', name: 'P', role: 'PATIENT' },
      });
      doctor = await prisma.user.create({
        data: { email: `d${Date.now()}@t.local`, password: 'x', name: 'D', role: 'DOCTOR' },
      });
    });

    afterAll(async () => {
      await prisma.appointment.deleteMany({ where: { doctorId: doctor.id } });
      await prisma.user.deleteMany({ where: { id: { in: [patient.id, doctor.id] } } });
      await prisma.$disconnect();
    });

    it('rejeita duas consultas no mesmo doctorId+date', async () => {
      await prisma.appointment.create({
        data: { patientId: patient.id, doctorId: doctor.id, date },
      });

      await expect(
        prisma.appointment.create({
          data: { patientId: patient.id, doctorId: doctor.id, date },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  npx jest test/appointment-unique.e2e-spec.ts --no-coverage 2>&1 | tail -15
  ```

  Saída esperada: a segunda inserção **não** lança P2002 (não há unique ainda) → a expectativa `rejects.toMatchObject` falha.

- [ ] **Step 3: Write minimal implementation**

  Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, no model `Appointment`, adicione abaixo dos `@@index` existentes:

  ```prisma
    @@unique([doctorId, date])
  ```

  No model `PendingCheckout`, adicione:

  ```prisma
    @@unique([doctorId, date])
  ```

  Gere a migração:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  SHADOW_DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_shadow?schema=public" \
  npx prisma migrate dev --name appointment_unique_doctor_date
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma generate && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  npx jest test/appointment-unique.e2e-spec.ts --no-coverage 2>&1 | tail -10
  ```

  Saída esperada: `Tests: 1 passed` (a segunda inserção agora lança P2002).

  > Nota de risco: se em produção já existirem dois registros com o mesmo `(doctorId, date)`, a migração falha ao criar o índice único. O runbook (Task 7) inclui a query de detecção de duplicatas a rodar em staging antes.

- [ ] **Step 5: Commit**

  ```bash
  git add /root/rodrigo/hope_saude/apps/api/prisma/schema.prisma \
          /root/rodrigo/hope_saude/apps/api/prisma/migrations \
          /root/rodrigo/hope_saude/apps/api/test/appointment-unique.e2e-spec.ts
  git commit -m "feat(api): unicidade (doctorId,date) em Appointment e PendingCheckout (anti double-booking)"
  ```

---

### Task 7 — CI com Postgres, compose de produção e runbook de migração de dados

Fecha a migração: CI roda contra `postgres:16`, o compose de produção ganha o service `db`, e o runbook documenta o procedimento staging-first de migração de dados (incluindo as queries de detecção exigidas pelas Tasks 4 e 6).

**Files:**
- Modify: `/root/rodrigo/hope_saude/.github/workflows/ci.yml`
- Modify: `/root/rodrigo/hope_saude/docker-compose.prod.yml`
- Create: `/root/rodrigo/hope_saude/docs/runbooks/postgres-migration.md`

- [ ] **Step 1: Write the failing check (CI roda contra Postgres)**

  O "teste" desta Task é o próprio pipeline. Antes de editar, confirme que o CI ainda referencia SQLite:

  ```bash
  grep -n "file:./test.db\|file:./\|DATABASE_URL" /root/rodrigo/hope_saude/.github/workflows/ci.yml
  ```

  Saída esperada (red): linhas com `DATABASE_URL: 'file:./test.db'` no job `api`.

- [ ] **Step 2: Confirmar a falha localmente reproduzindo o ambiente CI atual**

  Rode a suíte com a `DATABASE_URL` SQLite que o CI usa hoje — deve falhar porque o schema agora é Postgres:

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="file:./test.db" npx prisma generate 2>&1 | tail -5
  ```

  Saída esperada: erro do Prisma indicando incompatibilidade entre `provider = "postgresql"` no schema e a URL `file:` (ou o validate apontando provider mismatch).

- [ ] **Step 3: Atualizar CI, compose de produção e escrever o runbook**

  Em `/root/rodrigo/hope_saude/.github/workflows/ci.yml`, no job `api`, adicione um service container Postgres e troque as duas ocorrências de `DATABASE_URL: 'file:./test.db'` por uma URL Postgres + `prisma migrate deploy` antes dos testes. Substitua o bloco do job `api` (de `runs-on` até o fim do step de testes) por:

  ```yaml
  jobs:
    api:
      name: API (NestJS)
      runs-on: ubuntu-latest
      timeout-minutes: 15

      services:
        postgres:
          image: postgres:16-alpine
          env:
            POSTGRES_USER: hope
            POSTGRES_PASSWORD: hope
            POSTGRES_DB: hope_test
          ports:
            - 5432:5432
          options: >-
            --health-cmd "pg_isready -U hope -d hope_test"
            --health-interval 5s
            --health-timeout 5s
            --health-retries 10

      env:
        DATABASE_URL: 'postgresql://hope:hope@localhost:5432/hope_test?schema=public'
        SHADOW_DATABASE_URL: 'postgresql://hope:hope@localhost:5432/hope_shadow?schema=public'

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

        - name: Apply migrations
          run: npx prisma migrate deploy
          working-directory: apps/api

        - name: Lint API
          run: npx eslint "apps/api/src/**/*.ts"

        - name: Run API tests
          run: npx jest
          working-directory: apps/api
          env:
            JWT_SECRET: 'ci-test-secret-not-for-production'
            DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  ```

  Em `/root/rodrigo/hope_saude/docker-compose.prod.yml`, adicione o service `db` e ajuste a API. Adicione ao bloco `services:` (antes de `web:`) e remova o bind-mount SQLite do service `api` (`/opt/hope_saude/data:/app/prisma` já não guarda o banco):

  ```yaml
    db:
      image: postgres:16-alpine
      env_file:
        - /opt/hope_saude/db.env   # POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
      volumes:
        - /opt/hope_saude/pgdata:/var/lib/postgresql/data
      networks:
        - traefik-public
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
        interval: 10s
        timeout: 5s
        retries: 5
      deploy:
        replicas: 1
        restart_policy:
          condition: on-failure
  ```

  No service `api` do mesmo arquivo, remova as linhas:

  ```yaml
      volumes:
        - /opt/hope_saude/data:/app/prisma
  ```

  e adicione `depends_on` (Swarm ignora ordering, mas documenta a dependência) — a `DATABASE_URL` vem de `/opt/hope_saude/api.env`, que passa a apontar para `postgresql://...@db:5432/...`. Atualize o comentário de pré-requisitos no topo do arquivo para citar a criação de `/opt/hope_saude/db.env` e `/opt/hope_saude/pgdata` no lugar de `/opt/hope_saude/data`.

  Crie `/root/rodrigo/hope_saude/docs/runbooks/postgres-migration.md`:

  ```markdown
  # Runbook — Migração de dados SQLite → PostgreSQL (staging-first)

  > Aplicar SEMPRE em staging antes de produção. Cada passo é reversível.

  ## 0. Pré-checagem em staging (detecta dados que quebram as constraints novas)

  Antes de aplicar as migrações de enum (Task 4) e de unicidade (Task 6), rode
  contra a cópia SQLite de staging:

  ```sql
  -- Severidades fora do mapa de enum (Task 4)
  SELECT DISTINCT severity FROM "ClinicalScale" WHERE severity IS NOT NULL;
  -- Duplicatas que violariam @@unique([doctorId, date]) (Task 6)
  SELECT "doctorId", "date", COUNT(*) FROM "Appointment"
  GROUP BY "doctorId", "date" HAVING COUNT(*) > 1;
  SELECT "doctorId", "date", COUNT(*) FROM "PendingCheckout"
  GROUP BY "doctorId", "date" HAVING COUNT(*) > 1;
  ```

  Resolva duplicatas (cancelar/mover a duplicada) e valores de severidade
  inesperados manualmente antes de prosseguir.

  ## 1. Subir o Postgres de staging e aplicar o schema

  ```bash
  docker compose -f apps/api/docker-compose.dev.yml up -d
  cd apps/api
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_staging?schema=public" \
    npx prisma migrate deploy
  ```

  ## 2. Migrar os dados

  Exporte de SQLite e importe no Postgres tabela a tabela respeitando a ordem
  de FKs (User → Profiles → Appointment → MedicalRecord/Prescription/ClinicalScale
  → PendingCheckout → tokens/outbox). Use `pgloader` ou um script Node que lê via
  PrismaClient apontado ao SQLite e escreve via PrismaClient apontado ao Postgres.
  Campos JSON (`availability`, `answers`) devem ser inseridos como objeto nativo,
  não como string. `medications` permanece string criptografada (não converter).

  ## 3. Validar contagens

  ```sql
  SELECT 'User', COUNT(*) FROM "User"
  UNION ALL SELECT 'Appointment', COUNT(*) FROM "Appointment"
  UNION ALL SELECT 'MedicalRecord', COUNT(*) FROM "MedicalRecord"
  UNION ALL SELECT 'Prescription', COUNT(*) FROM "Prescription"
  UNION ALL SELECT 'ClinicalScale', COUNT(*) FROM "ClinicalScale";
  ```

  Compare com as contagens do SQLite de origem. Devem bater.

  ## 4. Cutover de produção

  1. Janela de manutenção: parar a réplica da API (`docker service scale hope_saude_api=0`).
  2. Aplicar passos 1–3 contra o Postgres de produção (`/opt/hope_saude/db.env`).
  3. Atualizar `/opt/hope_saude/api.env`: `DATABASE_URL="postgresql://...@db:5432/hope?schema=public"`.
  4. Deploy: `docker stack deploy -c docker-compose.prod.yml hope_saude`.
  5. Subir a API (`docker service scale hope_saude_api=1`) e validar `/health`.

  ## 5. Rollback

  Reverter `/opt/hope_saude/api.env` para a `DATABASE_URL` SQLite anterior e
  re-deploy. O arquivo SQLite original em `/opt/hope_saude/data` permanece
  intocado durante a migração (somente leitura).

  ## 6. Opcional — exclusion constraint anti-overlap (Postgres btree_gist)

  Para impedir sobreposição de horários (não só colisão exata), avaliar:

  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE "Appointment" ADD CONSTRAINT appointment_no_overlap
    EXCLUDE USING gist (
      "doctorId" WITH =,
      tsrange("date", "date" + ("durationMinutes" || ' minutes')::interval) WITH &&
    );
  ```

  Fora do escopo automatizado: exige extensão e revisão de impacto nos slots.
  ```

- [ ] **Step 4: Run test to verify it passes**

  Valide a sintaxe do workflow e do compose, e rode a suíte completa com a `DATABASE_URL` Postgres (espelhando o CI):

  ```bash
  cd /root/rodrigo/hope_saude/apps/api && \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  npx prisma migrate deploy && \
  JWT_SECRET="ci-test-secret-not-for-production" \
  DATA_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  DATABASE_URL="postgresql://hope:hope@localhost:5433/hope_dev?schema=public" \
  npx jest --no-coverage 2>&1 | tail -6
  ```

  Saída esperada: `migrate deploy` reporta `No pending migrations` (ou aplica as faltantes) e `Test Suites: 43 passed` / suíte verde (inclui o novo `appointment-unique.e2e-spec.ts`).

- [ ] **Step 5: Commit**

  ```bash
  git add /root/rodrigo/hope_saude/.github/workflows/ci.yml \
          /root/rodrigo/hope_saude/docker-compose.prod.yml \
          /root/rodrigo/hope_saude/docs/runbooks/postgres-migration.md
  git commit -m "ci+infra: CI roda contra Postgres, compose prod com service db e runbook de migração staging-first"
  ```

---

## Self-Review

**Cobertura dos gaps do escopo:**

1. **schema.prisma provider postgresql + url env, PrismaService usa env, Postgres de teste/CI** → Task 1 (datasource `postgresql` + `env("DATABASE_URL")` + `shadowDatabaseUrl`, `docker-compose.dev.yml`) e Task 7 (service container no CI). `PrismaService` já estende `PrismaClient` e lê `DATABASE_URL` do env — nenhuma mudança de código é necessária, apenas o datasource, o que está explicitado.
2. **availability/medications/answers String→Json** → `answers` (Task 2, com ajuste em `clinical-scale.service.ts` e spec real linha ~131), `availability` (Task 3, parser tolerante em `weekly-availability.ts` + spec; `available-slots.service.ts` segue compatível pois passa `unknown`). `medications` é deliberadamente mantido como `String` (texto criptografado AES-GCM, não JSON em repouso) — justificado na Task 2 e no comentário do prescription service; o gap "converter medications" é resolvido com a decisão fundamentada de não converter, preservando a criptografia.
3. **Enums nativos com data migration** → Task 4: `Role`, `AppointmentStatus`, `RecordStatus`/`RecordType`/`RecordTemplate`, `PrescriptionStatus`, `ScaleType`/`ScaleStatus`/`ScaleSeverity`, `OutboxStatus`, com `--create-only` + edição do `USING` e `UPDATE` de normalização da severidade legada acentuada.
4. **LGPD soft-delete + anonimização + FK real nos tokens** → Task 5: `deletedAt` em `User`, `AnonymizationService` (apaga PII, preserva prontuário CFM), FK `onDelete: Cascade` em `PasswordResetToken`/`EmailVerificationToken`, com spec completo.
5. **Índices/constraints revisados (@@unique agendamento) + exclusion constraint opcional** → Task 6 (`@@unique([doctorId, date])` em `Appointment` e `PendingCheckout` com e2e real) e runbook §6 (btree_gist documentado como opcional).
6. **Runbook staging-first + CI Postgres + ajuste de testes** → Task 7 (CI com `postgres:16` + `migrate deploy`, compose prod com service `db`, runbook com pré-checagem de duplicatas/severidades, migração de dados, validação, cutover e rollback).

**Fidelidade ao código real:** imports e shapes conferidos contra os fontes — `parseAvailabilityJson`/`assertValidDoctorAvailabilityJson` (`weekly-availability.ts`), `submitAnswers` gravando `answers: JSON.stringify(answers)` (`clinical-scale.service.ts:146`), spec real em `clinical-scale.service.spec.ts:131`, `medications` criptografado (`prescription.service.ts`), `PrismaService` (extends `PrismaClient`), models `User`/`Appointment`/`ClinicalScale`/`PasswordResetToken`/`EmailVerificationToken` e a migração SQLite legada. Os specs unitários usam mock de Prisma (confirmado em `clinical-scale.service.spec.ts`), por isso as Tasks que mudam tipo só afetam DTO/shape; o único teste que exige DB real (Task 6) usa `new PrismaClient()` contra o Postgres de dev. Comandos de teste seguem o padrão do projeto (`npx jest <arquivo> --no-coverage`) com `DATABASE_URL` Postgres.

**Ausência de placeholders:** nenhum "TODO"/"implementar depois"/"similar à Task N". Todo bloco de código está completo. A única instrução condicional (ajuste de `classifySeverity` na Task 4) traz o comando de verificação (`grep`) e os valores ASCII exatos a usar, sem inventar nomes de enum — o worker confirma os literais reais antes de editar. As constraints novas (enum/unique) têm o risco de dados pré-existentes endereçado por queries de detecção concretas no runbook.

**Ordenação:** por dependência (provider antes de tudo → conversões de coluna → enums → LGPD → constraints → CI/infra/runbook). Cada Task mantém a suíte verde e é reversível via `git revert` + reapontamento de `DATABASE_URL`.
