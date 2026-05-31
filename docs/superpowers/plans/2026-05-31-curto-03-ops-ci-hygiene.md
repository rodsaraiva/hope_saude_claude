# Ops, CI e Higiene (Curto Prazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabilizar o pipeline (separar e2e dos unit, typecheck no CI), endurecer o SQLite como stopgap (WAL + busy_timeout + migrate deploy + backup), remover dependência órfã (stripe) e corrigir documentação desatualizada (README, SQUAD_LOG, plano features-bundle com path errado).

**Architecture:** A API é NestJS 11 + Prisma 5 (SQLite, `provider="sqlite"`). O `jest.config.js` foi alterado localmente (não commitado) para varrer `test/*.e2e-spec.ts`, fazendo `npx jest` no CI tentar rodar testes que dependem de Mailpit/SMTP e quebram. Este plano separa unit de e2e via `jest-e2e.json` dedicado, mantém o `jest.config.js` apenas com `src/`, adiciona typecheck (`tsc --noEmit`) aos jobs do CI, move o PRAGMA WAL para `PrismaService.onModuleInit` com `enableShutdownHooks` no `main.ts`, parametriza a `DATABASE_URL` no schema, roda `prisma migrate deploy` no entrypoint do container e adiciona Litestream ao compose de produção. Mudanças com lógica testável (PrismaService) seguem TDD red→green→refactor; mudanças puramente de config têm verificação concreta por comando.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite WAL), Jest 29 (ts-jest, isolatedModules), GitHub Actions, Docker (multi-stage + Swarm), Litestream, TypeScript strict.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `/root/rodrigo/hope_saude/apps/api/jest-e2e.json` | Config Jest dedicada aos `test/*.e2e-spec.ts` (rootDir `test/`) |
| Modify | `/root/rodrigo/hope_saude/apps/api/jest.config.js` | Reverter para varrer só `src/`, ignorar `/test/` |
| Modify | `/root/rodrigo/hope_saude/apps/api/package.json` | Scripts `test`, `test:e2e`, `typecheck`, `prisma:deploy`; remover `stripe` |
| Modify | `/root/rodrigo/hope_saude/.github/workflows/ci.yml` | Step `npx tsc --noEmit` (api) e `npm run build` (web) por job |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/prisma.service.ts` | PRAGMA `journal_mode=WAL` + `busy_timeout` no `onModuleInit` |
| Create | `/root/rodrigo/hope_saude/apps/api/src/prisma.service.spec.ts` | Teste do PRAGMA WAL/busy_timeout |
| Modify | `/root/rodrigo/hope_saude/apps/api/src/main.ts` | `app.enableShutdownHooks()` antes do `listen` |
| Modify | `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma` | `url = env("DATABASE_URL")` no datasource |
| Create | `/root/rodrigo/hope_saude/apps/api/docker-entrypoint.sh` | `prisma migrate deploy` antes do `node dist/main.js` |
| Modify | `/root/rodrigo/hope_saude/apps/api/Dockerfile` | Copiar entrypoint + `ENTRYPOINT` |
| Modify | `/root/rodrigo/hope_saude/docker-compose.prod.yml` | Serviço `litestream` (backup contínuo do SQLite) |
| Create | `/root/rodrigo/hope_saude/litestream.yml` | Config Litestream (replica off-host) |
| Modify | `/root/rodrigo/hope_saude/README.md` | NestJS 11, contagens via comando, Pino/Swagger em Concluído, módulos novos |
| Modify | `/root/rodrigo/hope_saude/SQUAD_LOG.md` | Reconverter ISO-8859→UTF-8 (corrigir mojibake), citar LiveKit/Asaas |
| Modify | `/root/rodrigo/hope_saude/docs/superpowers/plans/2026-04-09-features-bundle.md` | `sed` corrigindo `/root/hope_saude`→`/root/rodrigo/hope_saude` |

---

## Tasks

### Task 1: Separar e2e dos unit no Jest (CI verde)

O `git diff` mostra que `apps/api/jest.config.js` foi alterado localmente (não commitado) para:
`rootDir: '.'`, `roots: ['<rootDir>/src','<rootDir>/test']` e `testRegex: '.*\\.(?:e2e-)?spec\\.tsx?$'`.
Com isso `npx jest` (rodado pelo CI) varre `test/auth-rbac.e2e-spec.ts` e `test/notifications-auth.e2e-spec.ts`, que dependem de Mailpit (`http://localhost:8025`), SMTP (`localhost:1025`) e DB migrado — indisponíveis no runner. Resultado: CI vermelho. Corrigimos restaurando o `jest.config.js` para só `src/` (com `testPathIgnorePatterns` defensivo) e criando um `jest-e2e.json` dedicado.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/jest.config.js`
- Create: `/root/rodrigo/hope_saude/apps/api/jest-e2e.json`
- Modify: `/root/rodrigo/hope_saude/apps/api/package.json`

- [ ] **Step 1: Write the failing test (verificação de que `npx jest` NÃO pega e2e)**

Antes de editar, capture o estado quebrado. Com o `jest.config.js` modificado atual, liste o que o Jest enxerga:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --listTests 2>/dev/null | grep -c "e2e-spec"
```
Expected (estado quebrado, ANTES do fix): imprime `2` — o Jest está pegando os dois `.e2e-spec.ts`. Esse é o "vermelho": a config de unit não deveria incluir e2e.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest test/notifications-auth.e2e-spec.ts --no-coverage 2>&1 | tail -20
```
Expected: FAIL — erros de conexão (`ECONNREFUSED` para Mailpit/SMTP) ou `fetch failed`, confirmando que e2e não roda sem infra.

- [ ] **Step 3: Write minimal implementation**

Substitua TODO o conteúdo de `/root/rodrigo/hope_saude/apps/api/jest.config.js` por (volta a varrer só `src/`, com guarda explícita contra `/test/`):

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.tsx?$',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/../test/'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)sx?'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

Crie `/root/rodrigo/hope_saude/apps/api/jest-e2e.json` (config dedicada aos e2e):

```json
{
  "moduleFileExtensions": ["js", "json", "ts", "tsx"],
  "rootDir": "test",
  "testRegex": ".*\\.e2e-spec\\.tsx?$",
  "transform": {
    "^.+\\.(t|j)sx?$": ["ts-jest", { "tsconfig": "tsconfig.json", "isolatedModules": true }]
  },
  "testEnvironment": "node",
  "testTimeout": 60000
}
```

Em `/root/rodrigo/hope_saude/apps/api/package.json`, ajuste o bloco `"scripts"` (adiciona `test:e2e`, comenta o pré-requisito via README — ver Task 7):

```json
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
    "test:cov": "NODE_OPTIONS=--experimental-vm-modules jest --coverage",
    "test:e2e": "NODE_OPTIONS=--experimental-vm-modules jest --config jest-e2e.json --runInBand"
  },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --listTests 2>/dev/null | grep -c "e2e-spec"
```
Expected: imprime `0` — unit run não enxerga mais e2e.

```bash
cd /root/rodrigo/hope_saude/apps/api && DATABASE_URL='file:./test.db' JWT_SECRET='ci-test-secret-not-for-production' DATA_ENCRYPTION_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' npx jest 2>&1 | tail -5
```
Expected: PASS — 241 testes / 42 suítes verdes, zero e2e na contagem.

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --config jest-e2e.json --listTests 2>/dev/null | grep -c "e2e-spec"
```
Expected: imprime `2` — a config e2e enxerga exatamente os dois arquivos.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/jest.config.js apps/api/jest-e2e.json apps/api/package.json
git commit -m "test(api): separar e2e dos unit — jest.config so src/, jest-e2e.json dedicado

CI rodava 'npx jest' com config que varria test/*.e2e-spec.ts (Mailpit/SMTP),
quebrando o pipeline. Unit run volta a cobrir so src/; e2e via test:e2e."
```

---

### Task 2: Adicionar typecheck ao CI (tsc --noEmit api + build web)

O `ci.yml` atual roda apenas lint + jest. O TypeScript strict do projeto (`noImplicitAny`, `strictNullChecks`) só é validado no build, que não roda em CI. Adicionamos `npx tsc --noEmit` no job `api` e `npm run build` (que invoca `next build` = typecheck) no job `web`.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/package.json`
- Modify: `/root/rodrigo/hope_saude/.github/workflows/ci.yml`

- [ ] **Step 1: Write the failing test (typecheck deve passar localmente — baseline)**

Adicione o script `typecheck` ao `apps/api/package.json`. No bloco `"scripts"` (após `test:e2e`), insira:

```json
    "typecheck": "tsc --noEmit -p tsconfig.json"
```

Rode para estabelecer baseline:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx prisma generate >/dev/null 2>&1; npx tsc --noEmit -p tsconfig.json; echo "exit=$?"
```
Expected: `exit=0` (o código atual compila; o CI vai exigir que continue assim).

- [ ] **Step 2: Run test to verify it fails (CI atual NÃO tem o step)**

```bash
cd /root/rodrigo/hope_saude && grep -c "tsc --noEmit\|npm run build" .github/workflows/ci.yml
```
Expected: `0` — confirma que typecheck/build não existem no CI hoje (o "vermelho": uma regressão de tipo passaria batido).

- [ ] **Step 3: Write minimal implementation**

Edite `/root/rodrigo/hope_saude/.github/workflows/ci.yml`. No job `api`, adicione um step ENTRE "Generate Prisma Client" e "Lint API":

```yaml
      - name: Typecheck API
        run: npx tsc --noEmit -p tsconfig.json
        working-directory: apps/api
```

No job `web`, adicione um step APÓS "Lint web" (o `next build` faz typecheck do App Router):

```yaml
      - name: Build web (typecheck + build)
        run: npm run build
        working-directory: apps/web
        env:
          NEXT_PUBLIC_API_URL: 'http://localhost:3000'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude && grep -c "Typecheck API\|Build web" .github/workflows/ci.yml
```
Expected: `2` — ambos os steps presentes.

```bash
cd /root/rodrigo/hope_saude && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"
```
Expected: `YAML OK` — o workflow continua sintaticamente válido.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/package.json .github/workflows/ci.yml
git commit -m "ci: adicionar typecheck (tsc --noEmit) na api e build na web

Strict mode so era validado no build; uma regressao de tipo passava batido no CI."
```

---

### Task 3: SQLite WAL + busy_timeout no PrismaService (TDD) + shutdown hooks

O `PrismaService` atual só faz `$connect()`/`$disconnect()`. Sob concorrência o SQLite serializa escritas e dá `SQLITE_BUSY`. WAL + `busy_timeout` mitigam isso (stopgap até Postgres). Aplicamos os PRAGMAs no `onModuleInit` via `$executeRawUnsafe` e habilitamos `enableShutdownHooks` no `main.ts` para o `onModuleDestroy` rodar em SIGTERM (Swarm).

**Files:**
- Create: `/root/rodrigo/hope_saude/apps/api/src/prisma.service.spec.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/prisma.service.ts`
- Modify: `/root/rodrigo/hope_saude/apps/api/src/main.ts`

- [ ] **Step 1: Write the failing test**

Crie `/root/rodrigo/hope_saude/apps/api/src/prisma.service.spec.ts`:

```typescript
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('aplica PRAGMA journal_mode=WAL e busy_timeout no onModuleInit', async () => {
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    const execSpy = jest
      .spyOn(service, '$executeRawUnsafe')
      .mockResolvedValue(0 as unknown as number);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(execSpy).toHaveBeenCalledWith('PRAGMA journal_mode=WAL;');
    expect(execSpy).toHaveBeenCalledWith('PRAGMA busy_timeout=5000;');
  });

  it('onModuleDestroy chama $disconnect', async () => {
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest prisma.service.spec --no-coverage 2>&1 | tail -15
```
Expected: FAIL — `expect(execSpy).toHaveBeenCalledWith('PRAGMA journal_mode=WAL;')` falha porque `onModuleInit` ainda não chama `$executeRawUnsafe`.

- [ ] **Step 3: Write minimal implementation**

Substitua TODO o conteúdo de `/root/rodrigo/hope_saude/apps/api/src/prisma.service.ts` por:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // SQLite stopgap: WAL permite leituras concorrentes durante escrita;
    // busy_timeout evita SQLITE_BUSY imediato sob concorrência. Remover ao migrar p/ Postgres.
    await this.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
    await this.$executeRawUnsafe('PRAGMA busy_timeout=5000;');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Em `/root/rodrigo/hope_saude/apps/api/src/main.ts`, adicione `app.enableShutdownHooks();` logo após `app.useGlobalFilters(new PrismaExceptionFilter());` e antes do bloco do Swagger:

```typescript
  // Traduz erros do Prisma (P2025, P2002, P2003, ...) em respostas HTTP adequadas
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Garante onModuleDestroy (PrismaService.$disconnect) em SIGTERM/SIGINT (Swarm)
  app.enableShutdownHooks();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest prisma.service.spec --no-coverage 2>&1 | tail -10
```
Expected: PASS (2 testes).

Confirme que o WAL realmente aplica num banco real (verificação de integração, não mock):

```bash
cd /root/rodrigo/hope_saude/apps/api && DATABASE_URL='file:./wal-check.db' node -e "
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  await p.\$connect();
  await p.\$executeRawUnsafe('PRAGMA journal_mode=WAL;');
  const r = await p.\$queryRawUnsafe('PRAGMA journal_mode;');
  console.log('journal_mode=', r[0].journal_mode);
  await p.\$disconnect();
})();" 2>&1 | tail -2; rm -f /root/rodrigo/hope_saude/apps/api/wal-check.db*
```
Expected: `journal_mode= wal`.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/prisma.service.ts apps/api/src/prisma.service.spec.ts apps/api/src/main.ts
git commit -m "feat(api): SQLite WAL + busy_timeout no PrismaService + shutdown hooks

Stopgap de concorrencia ate migrar p/ Postgres. enableShutdownHooks garante
\$disconnect limpo em SIGTERM do Swarm."
```

---

### Task 4: DATABASE_URL no schema + prisma migrate deploy no container

O `schema.prisma` tem `url = "file:./dev.db"` hardcoded — em produção o volume é `/app/prisma`, então a URL precisa vir de `env("DATABASE_URL")` (o `.env.example` já define `DATABASE_URL="file:./dev.db"`). Além disso o Dockerfile faz `CMD ["node","dist/main.js"]` sem aplicar migrations: a 1ª subida num volume vazio cria DB sem tabelas. Adicionamos `prisma:deploy` e um entrypoint que roda `migrate deploy` antes do CMD.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`
- Modify: `/root/rodrigo/hope_saude/apps/api/package.json`
- Create: `/root/rodrigo/hope_saude/apps/api/docker-entrypoint.sh`
- Modify: `/root/rodrigo/hope_saude/apps/api/Dockerfile`

- [ ] **Step 1: Write the failing test (migrate deploy precisa de env e o schema ainda é hardcoded)**

```bash
cd /root/rodrigo/hope_saude/apps/api && grep -n 'url' prisma/schema.prisma | head -1
```
Expected (estado atual): `url      = "file:./dev.db"` — hardcoded. O "vermelho": `prisma migrate deploy` ignora `DATABASE_URL` e sempre mira `dev.db`.

```bash
cd /root/rodrigo/hope_saude/apps/api && rm -f migdeploy.db*; DATABASE_URL='file:./migdeploy.db' npx prisma migrate deploy 2>&1 | grep -i "dev.db\|migdeploy\|following migration" | head -3
```
Expected: o output NÃO menciona `migdeploy.db` (o schema hardcoded aplica em `dev.db`), provando que a URL não é parametrizada. Limpe: `rm -f /root/rodrigo/hope_saude/apps/api/migdeploy.db*`.

- [ ] **Step 2: (incluído no Step 1)** — a verificação de falha é o grep acima retornando a linha hardcoded.

- [ ] **Step 3: Write minimal implementation**

Em `/root/rodrigo/hope_saude/apps/api/prisma/schema.prisma`, troque o datasource:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Em `/root/rodrigo/hope_saude/apps/api/package.json`, adicione ao bloco `"scripts"` (após `typecheck`):

```json
    "prisma:deploy": "prisma migrate deploy"
```

Crie `/root/rodrigo/hope_saude/apps/api/docker-entrypoint.sh`:

```bash
#!/bin/sh
set -e

# Aplica migrations pendentes antes de subir a API (idempotente).
echo "[entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

echo "[entrypoint] iniciando API..."
exec node dist/main.js
```

Em `/root/rodrigo/hope_saude/apps/api/Dockerfile`, no estágio `runtime`, troque o `CMD` final. Substitua estas linhas:

```dockerfile
USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

por:

```dockerfile
# Entrypoint aplica migrations antes do CMD
COPY --from=builder /workspace/apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER app
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

E garanta que o entrypoint exista no builder antes do COPY: ele já vem em `COPY apps/api ./apps/api` (estágio builder copia o diretório inteiro), então o arquivo estará em `/workspace/apps/api/docker-entrypoint.sh`. Nenhuma linha extra necessária no builder.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && rm -f migdeploy.db*; DATABASE_URL='file:./migdeploy.db' npx prisma migrate deploy 2>&1 | tail -4
```
Expected: aplica a migration `20260408141426_add_email_outbox_and_auth_tokens` e cria `migdeploy.db` (a URL agora é respeitada). Confirme e limpe:

```bash
cd /root/rodrigo/hope_saude/apps/api && test -f migdeploy.db && echo "DB criado via DATABASE_URL OK"; rm -f migdeploy.db*
```
Expected: `DB criado via DATABASE_URL OK`.

```bash
cd /root/rodrigo/hope_saude/apps/api && sh -n docker-entrypoint.sh && echo "entrypoint shell-syntax OK"
```
Expected: `entrypoint shell-syntax OK`.

```bash
cd /root/rodrigo/hope_saude/apps/api && DATABASE_URL='file:./dev.db' npx prisma generate >/dev/null 2>&1 && echo "generate ainda funciona OK"
```
Expected: `generate ainda funciona OK` (o resto do código continua compilando com a URL via env).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/prisma/schema.prisma apps/api/package.json apps/api/docker-entrypoint.sh apps/api/Dockerfile
git commit -m "feat(api): DATABASE_URL via env + migrate deploy no entrypoint do container

Schema deixa de hardcodar dev.db; container aplica migrations pendentes antes do CMD,
evitando subir contra volume vazio sem tabelas."
```

---

### Task 5: Backup do SQLite (Litestream) — stopgap até Postgres

O volume `/opt/hope_saude/data` (bind no Swarm) hoje não tem backup. Como stopgap, adicionamos um serviço Litestream que replica o `dev.db` continuamente para um destino off-host (S3/MinIO via env). É config-only; a verificação é validar o YAML e a sintaxe da config.

**Files:**
- Create: `/root/rodrigo/hope_saude/litestream.yml`
- Modify: `/root/rodrigo/hope_saude/docker-compose.prod.yml`

- [ ] **Step 1: Write the failing test (não há backup hoje)**

```bash
cd /root/rodrigo/hope_saude && grep -c "litestream" docker-compose.prod.yml; test -f litestream.yml && echo "config existe" || echo "SEM config de backup"
```
Expected: `0` e `SEM config de backup` — o "vermelho": perda do volume = perda total de dados.

- [ ] **Step 2: (incluído no Step 1).**

- [ ] **Step 3: Write minimal implementation**

Crie `/root/rodrigo/hope_saude/litestream.yml` (destino e credenciais vêm de env do container, NUNCA commitados):

```yaml
# Litestream — replicação contínua do SQLite (stopgap até PostgreSQL).
# Variáveis (LITESTREAM_REPLICA_URL, LITESTREAM_ACCESS_KEY_ID,
# LITESTREAM_SECRET_ACCESS_KEY) vêm de /opt/hope_saude/api.env no VPS.
dbs:
  - path: /data/dev.db
    replicas:
      - url: ${LITESTREAM_REPLICA_URL}
        access-key-id: ${LITESTREAM_ACCESS_KEY_ID}
        secret-access-key: ${LITESTREAM_SECRET_ACCESS_KEY}
        retention: 168h
        snapshot-interval: 1h
```

Em `/root/rodrigo/hope_saude/docker-compose.prod.yml`, adicione o serviço `litestream` ANTES da chave `networks:` no final. Ele compartilha o mesmo volume de dados da API:

```yaml
  litestream:
    image: litestream/litestream:0.3
    command: ["replicate", "-config", "/etc/litestream.yml"]
    env_file:
      - /opt/hope_saude/api.env
    volumes:
      - /opt/hope_saude/data:/data:ro
      - /opt/hope_saude/litestream.yml:/etc/litestream.yml:ro
    networks:
      - traefik-public
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude && python3 -c "import yaml; yaml.safe_load(open('docker-compose.prod.yml')); yaml.safe_load(open('litestream.yml')); print('YAML OK')"
```
Expected: `YAML OK`.

```bash
cd /root/rodrigo/hope_saude && grep -c "litestream" docker-compose.prod.yml
```
Expected: `>= 3` (serviço, image, volume da config).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add litestream.yml docker-compose.prod.yml
git commit -m "ops: backup continuo do SQLite via Litestream (stopgap ate Postgres)

Replica /data/dev.db off-host com retencao de 7d. Credenciais via env, nunca commitadas."
```

---

### Task 6: Remover dependência órfã `stripe`

`grep -rln stripe apps/api/src apps/web/src` retorna ZERO usos — pagamento é Asaas (`asaas.service.ts` via `fetch`). `stripe@^12.0.0` está em `apps/api/package.json` (deps) e no `package-lock.json`. Removemos e confirmamos zero regressão.

**Files:**
- Modify: `/root/rodrigo/hope_saude/apps/api/package.json`
- Modify: `/root/rodrigo/hope_saude/package-lock.json`

- [ ] **Step 1: Write the failing test (stripe está presente mas não usado)**

```bash
cd /root/rodrigo/hope_saude && grep -c '"stripe"' apps/api/package.json; grep -rln "stripe" apps/api/src apps/web/src 2>/dev/null | wc -l
```
Expected: `1` (declarada) e `0` (usos) — o "vermelho": dependência fantasma aumentando superfície de supply-chain.

- [ ] **Step 2: (incluído no Step 1).**

- [ ] **Step 3: Write minimal implementation**

Em `/root/rodrigo/hope_saude/apps/api/package.json`, remova a linha do `stripe` em `dependencies`. A última linha de `dependencies` antes da remoção é `"stripe": "^12.0.0"`; remova-a e ajuste a vírgula da linha anterior (`"rxjs": "^7.8.1"` passa a ser a última, sem vírgula final):

```json
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
```

Atualize o lockfile (sem instalar nada novo globalmente; só reconcilia):

```bash
cd /root/rodrigo/hope_saude && npm install --package-lock-only
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude && grep -c '"stripe"' apps/api/package.json; grep -c '"node_modules/stripe"' package-lock.json
```
Expected: `0` e `0` — fora de ambos.

```bash
cd /root/rodrigo/hope_saude/apps/api && DATABASE_URL='file:./test.db' JWT_SECRET='ci-test-secret-not-for-production' DATA_ENCRYPTION_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' npx jest 2>&1 | tail -4
```
Expected: PASS — 241 testes / 42 suítes verdes (zero regressão).

```bash
cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit -p tsconfig.json; echo "tsc exit=$?"
```
Expected: `tsc exit=0`.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/package.json package-lock.json
git commit -m "chore(api): remover dependencia orfa stripe (pagamento e Asaas)

Zero usos em src; reduz superficie de supply-chain."
```

---

### Task 7: Corrigir README (versões, contagens, módulos)

O `README.md` diz "NestJS 10" (real: 11, ver `@nestjs/core ^11.1.18`), "170 testes / 98 web" (real: 241/183), lista Pino e Swagger como "Próximas sprints" embora já estejam em `main.ts`, e não documenta os módulos `availability/`, `notifications/`, `clinical-scale/`. Também falta o pré-requisito de infra para `test:e2e` (Task 1).

**Files:**
- Modify: `/root/rodrigo/hope_saude/README.md`

- [ ] **Step 1: Write the failing test (apontar as imprecisões)**

```bash
cd /root/rodrigo/hope_saude && grep -n "NestJS 10" README.md; grep -n "170 testes\|98 testes" README.md; grep -n "Swagger.*Próximas\|Pino logger estruturado" README.md
```
Expected: linhas com "NestJS 10", "170 testes", "98 testes" e Swagger/Pino em "Próximas sprints" — todas erradas.

- [ ] **Step 2: (incluído no Step 1).**

- [ ] **Step 3: Write minimal implementation**

Aplique as correções (cada uma é um Edit pontual):

1. Linha 8 — `**`apps/api`** — NestJS 10 + Prisma 5` → `NestJS 11 + Prisma 5`.

2. Seção `## Testes` (linhas ~207-208): substitua as contagens fixas por comando reprodutível:

```markdown
## Testes

Rode e conte localmente (números mudam a cada sprint):

```bash
cd apps/api && npx jest        # unit da API
cd apps/web && npx jest        # unit do web
cd apps/api && npm run test:e2e  # e2e (REQUER Mailpit em :1025/:8025 e DB migrado)
```

Os e2e (`apps/api/test/*.e2e-spec.ts`) dependem de Mailpit e SMTP — suba via
`docker compose up mailpit` antes. Eles NÃO rodam no `npx jest` padrão (só unit).

Cobertura: `npx jest --coverage`.
```

3. Em `## Tooling` (linha ~180), troque a linha do GitHub Actions para refletir typecheck:

```markdown
- **GitHub Actions** (`.github/workflows/ci.yml`) — lint + typecheck + test + audit em PRs
```

4. No Roadmap "Concluído" (após `- ✅ GitHub Actions CI`), adicione:

```markdown
- ✅ Logging estruturado (nestjs-pino) no bootstrap
- ✅ Swagger / OpenAPI em `/api/docs` (`@nestjs/swagger`)
- ✅ Módulos `availability` (slots/agenda), `notifications` (EmailOutbox + MailProvider) e `clinical-scale` (PHQ9/GAD7/AUDIT/MoCA)
```

5. Em "Próximas sprints", remova as linhas já concluídas:

```markdown
- ⏳ Sentry / Pino logger estruturado
- ⏳ Swagger (`@nestjs/swagger`) — DTOs já compatíveis
```
(apague ambas; Pino e Swagger já estão em Concluído).

6. Na seção de arquitetura da API (bloco de árvore `src/`), adicione após a linha `└── common/` ... (antes do fechamento do bloco), descreva os módulos:

```markdown
├── availability/      # Disponibilidade semanal do médico + cálculo de slots
├── notifications/     # EmailOutbox + MailProvider (Postmark/SMTP por env)
├── clinical-scale/    # Escalas clínicas (PHQ9, GAD7, AUDIT, MoCA)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude && grep -c "NestJS 10" README.md; grep -c "170 testes\|98 testes" README.md
```
Expected: `0` e `0`.

```bash
cd /root/rodrigo/hope_saude && grep -c "availability\|notifications\|clinical-scale\|nestjs-pino\|test:e2e" README.md
```
Expected: `>= 4` — módulos, Pino e e2e documentados.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add README.md
git commit -m "docs: corrigir README — NestJS 11, contagens via comando, Pino/Swagger concluidos, modulos novos"
```

---

### Task 8: Corrigir SQUAD_LOG (UTF-8) e citar LiveKit/Asaas

`file SQUAD_LOG.md` reporta `ISO-8859 text`: o arquivo tem mojibake (`Integra��o`, `verifica��o`, `peri�dica`). Convertemos para UTF-8 e corrigimos o texto (vídeo é LiveKit, não socket.io WebRTC puro; pagamento é Asaas — já citado, manter).

**Files:**
- Modify: `/root/rodrigo/hope_saude/SQUAD_LOG.md`

- [ ] **Step 1: Write the failing test (encoding errado)**

```bash
cd /root/rodrigo/hope_saude && file SQUAD_LOG.md; grep -c $'\357\277\275' SQUAD_LOG.md 2>/dev/null || true
```
Expected: `ISO-8859 text` — o "vermelho": acentos quebrados ao renderizar no GitHub/UTF-8.

- [ ] **Step 2: (incluído no Step 1).**

- [ ] **Step 3: Write minimal implementation**

Converta o arquivo de ISO-8859-1 (Latin-1) para UTF-8:

```bash
cd /root/rodrigo/hope_saude && iconv -f ISO-8859-1 -t UTF-8 SQUAD_LOG.md -o SQUAD_LOG.utf8.md && mv SQUAD_LOG.utf8.md SQUAD_LOG.md
```

Em seguida corrija a descrição do vídeo (era "socket.io e NestJS WebSockets" — o stack real é LiveKit). Localize a linha de videochamada e troque para refletir LiveKit:

```markdown
* **[Feature] Sistema de videochamada (100% TDD)** via LiveKit (token server-side `livekit-server-sdk`) e NestJS, integrado ao Next.js (`@livekit/components-react`).
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude && file SQUAD_LOG.md
```
Expected: `UTF-8 Unicode text` (ou `ASCII text` se não houver mais bytes altos — também aceitável após correção).

```bash
cd /root/rodrigo/hope_saude && grep -c "Integração\|verificação\|periódica\|LiveKit" SQUAD_LOG.md
```
Expected: `>= 1` — acentos corretos e LiveKit citado.

```bash
cd /root/rodrigo/hope_saude && grep -c $'\357\277\275' SQUAD_LOG.md || echo 0
```
Expected: `0` — nenhum caractere de substituição (mojibake) restante.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add SQUAD_LOG.md
git commit -m "docs: SQUAD_LOG em UTF-8 (corrige mojibake) e descricao de video via LiveKit"
```

---

### Task 9: Corrigir path errado no plano features-bundle

`docs/superpowers/plans/2026-04-09-features-bundle.md` tem 29 ocorrências de `/root/hope_saude` (path inexistente — o repo está em `/root/rodrigo/hope_saude`). Corrigimos com `sed` e validamos contra o disco real.

**Files:**
- Modify: `/root/rodrigo/hope_saude/docs/superpowers/plans/2026-04-09-features-bundle.md`

- [ ] **Step 1: Write the failing test (path errado presente)**

```bash
cd /root/rodrigo/hope_saude && grep -c "/root/hope_saude" docs/superpowers/plans/2026-04-09-features-bundle.md
```
Expected: `29` — o "vermelho": comandos do plano antigo apontam para diretório inexistente.

- [ ] **Step 2: (incluído no Step 1).**

- [ ] **Step 3: Write minimal implementation**

```bash
cd /root/rodrigo/hope_saude && sed -i 's|/root/hope_saude|/root/rodrigo/hope_saude|g' docs/superpowers/plans/2026-04-09-features-bundle.md
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude && grep -c "/root/hope_saude\b" docs/superpowers/plans/2026-04-09-features-bundle.md
```
Expected: `0` — nenhum path errado restante (o `\b` impede falso-positivo com `/root/rodrigo/hope_saude`). Note: como todas as ocorrências viraram `/root/rodrigo/hope_saude`, este grep do prefixo isolado retorna 0.

```bash
cd /root/rodrigo/hope_saude && grep -c "/root/rodrigo/hope_saude" docs/superpowers/plans/2026-04-09-features-bundle.md
```
Expected: `29` — todas convertidas para o path correto.

Reconcilie ações Create/Modify do plano antigo com o que já existe no repo (sanity check — não edita, só relata divergências para revisão humana):

```bash
cd /root/rodrigo/hope_saude && for f in \
  apps/api/src/clinical-scale/clinical-scale.service.ts \
  apps/api/src/clinical-scale/clinical-scale.controller.ts \
  apps/web/src/lib/query/query-keys.ts \
  apps/api/prisma/schema.prisma ; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 && echo "EXISTE (Modify ok): $f" || echo "FALTA (deveria ser Create): $f"
done
```
Expected: arquivos `clinical-scale.*`, `query-keys.ts` e `schema.prisma` listados como EXISTE (confirmando que o plano antigo os trata como Modify corretamente).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add docs/superpowers/plans/2026-04-09-features-bundle.md
git commit -m "docs: corrigir path /root/hope_saude -> /root/rodrigo/hope_saude no plano features-bundle"
```

---

## Self-Review

Cobertura dos gaps (todos os 8 itens do escopo):

1. **Separar e2e dos unit no Jest** — Task 1: `jest-e2e.json` dedicado + `testPathIgnorePatterns ['/test/']` no `jest.config.js` (rootDir `src`) + script `test:e2e`; pré-requisito de infra (Mailpit/SMTP) documentado no README (Task 7). Verificação: `npx jest --listTests | grep -c e2e-spec` = 0 (unit) / 2 (e2e). CI volta verde.
2. **Typecheck no CI** — Task 2: step `Typecheck API` (`tsc --noEmit`) no job api e `Build web` (`next build`) no job web; YAML validado.
3. **SQLite WAL** — Task 3 (TDD): PRAGMA `journal_mode=WAL` + `busy_timeout=5000` no `onModuleInit` via `$executeRawUnsafe`, `enableShutdownHooks` no `main.ts`; teste unit + verificação de integração (`journal_mode=wal`).
4. **Deploy** — Task 4: `prisma:deploy` no package.json, `schema.prisma` com `env("DATABASE_URL")`, `docker-entrypoint.sh` rodando `migrate deploy` antes do `node dist/main.js`, `ENTRYPOINT` no Dockerfile.
5. **Backup SQLite stopgap** — Task 5: serviço `litestream` no `docker-compose.prod.yml` + `litestream.yml` (replica off-host, retenção 7d, credenciais via env).
6. **Remover stripe** — Task 6: fora de `package.json` e `package-lock.json`; suíte 241/42 verde + `tsc` ok = zero regressão.
7. **Corrigir README** — Task 7: NestJS 10→11, contagens via comando (não fixas), Pino/Swagger movidos para Concluído, módulos `availability`/`notifications`/`clinical-scale` documentados, pré-requisito e2e.
8. **Corrigir SQUAD_LOG + path do plano** — Task 8: `iconv` ISO-8859→UTF-8, mojibake removido, vídeo descrito como LiveKit. Task 9: `sed` corrigindo as 29 ocorrências de `/root/hope_saude`→`/root/rodrigo/hope_saude` + reconciliação Create/Modify via `git ls-files`.

Fidelidade ao código real (verificado por leitura):
- `PrismaService` usa `OnModuleInit/OnModuleDestroy`, `$connect`/`$disconnect` (assinatura preservada; `$executeRawUnsafe` é método real do PrismaClient).
- `main.ts` tem o ponto exato (após `useGlobalFilters`) para `enableShutdownHooks()`.
- `schema.prisma` confirmado com `provider="sqlite"`, `url="file:./dev.db"`; `.env.example` já tem `DATABASE_URL`.
- Migration `20260408141426_add_email_outbox_and_auth_tokens` existe (alvo do `migrate deploy`).
- Dockerfile multi-stage: builder copia `apps/api` inteiro (entrypoint disponível em `/workspace/apps/api/`); runtime tem `CMD ["node","dist/main.js"]` a ser trocado por `ENTRYPOINT`.
- stripe: ZERO usos em `apps/api/src` e `apps/web/src` (grep confirmado); presente em deps + lockfile.
- README diz "NestJS 10" e "170/98 testes" (real: 11 e 241/183); Pino/Swagger em "Próximas sprints" apesar de já estarem em `main.ts`.
- SQUAD_LOG: `file` reporta `ISO-8859 text` com mojibake real (`Integra��o`).
- Plano features-bundle: 29 ocorrências de `/root/hope_saude` confirmadas via `grep -c`.

Ausência de placeholders: todos os passos de código mostram o conteúdo completo (config Jest, PrismaService, entrypoint, litestream.yml, blocos de README). Nenhum "TODO"/"implementar depois"/"similar à Task N". Passos de config sem teste unitário (CI, Litestream, Dockerfile) têm verificação concreta por comando (`--listTests`, `python3 yaml.safe_load`, `sh -n`, `iconv`+`file`, `git ls-files`). Tasks ordenadas por dependência e severidade: CI verde (1) e typecheck (2) primeiro, depois hardening de runtime/deploy (3-5), higiene de deps (6) e documentação (7-9).

### Pré-requisitos de execução
- `iconv` (Task 8) e `python3` com PyYAML (Tasks 2/5) disponíveis no ambiente. Se PyYAML faltar, validar YAML com `npx js-yaml` ou inspeção manual.
- Litestream (Task 5) só roda em produção (precisa de bucket S3/MinIO + credenciais via `/opt/hope_saude/api.env`); o plano valida apenas a config localmente.
