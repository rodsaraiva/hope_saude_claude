# Hope Saúde

Plataforma de telepsiquiatria — agendamento, pagamento, videochamada, prontuário e prescrição
eletrônica com assinatura digital.

Monorepo com:

- **`apps/api`** — NestJS 10 + Prisma 5 + SQLite (dev), JWT, LiveKit, Asaas
- **`apps/web`** — Next.js 15 (App Router) + React 19 + TanStack Query + Tailwind 3

## Princípios

Este projeto segue **TDD** (testes antes da implementação) e **SOLID**. Toda contribuição deve:

- Vir acompanhada de teste que falhe primeiro (red → green → refactor)
- Respeitar Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- Não introduzir `forwardRef` para resolver ciclos — extrair abstrações em vez disso
- Usar tipos fortes (TypeScript `strict: true`); zero `any` em código de produção

Detalhes em [`CLAUDE.md`](./CLAUDE.md).

## Pré-requisitos

- **Node.js 20+** (testado com 20.20.2)
- **npm 10+**

## Setup

```bash
git clone <repo-url> hope_saude
cd hope_saude
npm install
```

### Variáveis de ambiente

Copie o exemplo e preencha:

```bash
cp apps/api/.env.example apps/api/.env
```

Variáveis obrigatórias (sem elas a API recusa subir):

| Variável | Como gerar |
|---|---|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DATA_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

`DATA_ENCRYPTION_KEY` é usada para encriptar CPF em repouso (AES-256-GCM, LGPD).
**Nunca rotacionar sem antes re-encriptar todos os registros existentes.**

### Banco de dados

```bash
cd apps/api
npx prisma generate
npx prisma db push
```

Hoje o projeto usa SQLite para desenvolvimento (arquivo `apps/api/prisma/dev.db`).
A migração para PostgreSQL é uma tarefa futura — ver "Roadmap".

## Rodando localmente

Da raiz do repositório:

```bash
npm run dev
```

Sobe **api** em `http://localhost:3000` e **web** em `http://localhost:3001` em paralelo via
`concurrently`.

### Scripts úteis

| Script | O que faz |
|---|---|
| `npm run dev` | API + Web em modo dev (hot reload) |
| `npm run dev:api` | Só a API |
| `npm run dev:web` | Só o Web |
| `npm run lint` | ESLint em todo o monorepo |
| `npm run lint:fix` | ESLint com `--fix` |
| `npm run format` | Prettier em todo o monorepo |
| `npm run test` | Testes da API (Jest) |
| `cd apps/web && npx jest` | Testes do Web (Jest + Testing Library) |
| `cd apps/api && npx jest` | Testes da API isoladamente |

## Arquitetura

### API (`apps/api`)

```
src/
├── auth/              # Cadastro, login, JWT, RBAC
│   ├── auth.types.ts          # NewUserInput, PublicUser, JwtSigningPayload
│   └── authenticated-request.ts # AuthenticatedRequest aplicado em todos os controllers
├── profile/
│   ├── data/                  # Repositórios (DIP) — sem ciclos
│   │   ├── patient-profile.repository.ts  # Encripta CPF em repouso
│   │   ├── doctor-profile.repository.ts
│   │   └── profile-data.module.ts         # Raiz comum payment ↔ profile
│   └── profile.service.ts
├── payment/           # Asaas (PIX + cartão), checkout, cron
├── appointment/       # Consultas (CONFIRMED) e PendingCheckout
├── medical-record/    # Prontuários com assinatura digital
├── prescription/      # Receitas com assinatura digital
├── video/             # LiveKit token
├── health/            # GET /health (Terminus, ping ao banco)
└── common/
    ├── cryptography.service.ts   # AES-256-GCM (CPF), HMAC (sign/verify)
    ├── prisma-exception.filter.ts # P2025→404, P2002→409, P2003→400
    └── cors.util.ts
```

### Web (`apps/web`)

```
src/
├── app/                  # App Router (Next.js 15)
│   ├── login/            # ...page.tsx
│   ├── register/
│   ├── agenda/           # Médico — disponibilidade + atendimentos
│   ├── profile/          # Perfil próprio (paciente ou médico)
│   ├── doctors/[userId]/ # Detalhe público de médico + booking
│   ├── setup/{doctor,patient}/ # Onboarding pós-cadastro
│   ├── signature/callback/     # Callback OAuth Lacuna PKI
│   └── layout.tsx        # QueryProvider envolve a árvore
├── components/
│   ├── agenda/           # AgendaHeader, CalendarToolbar
│   ├── profile/          # ProfileSidebar
│   └── ...
├── lib/
│   ├── api-client.ts     # fetch wrapper com Bearer token
│   ├── query/            # TanStack Query (hooks reativos)
│   │   ├── query-provider.tsx
│   │   ├── query-keys.ts
│   │   ├── use-profile-me.ts
│   │   └── use-appointments-me.ts
│   └── doctor-dashboard-api.ts
└── hooks/
```

## Decisões importantes

### Segurança

- **JWT secret nunca hardcoded** — sempre via `JWT_SECRET` env, ConfigService valida na inicialização
- **ValidationPipe estrito** — `whitelist: true`, `forbidNonWhitelisted: true` (anti mass-assignment)
- **CORS com whitelist** via `CORS_ORIGINS` env
- **Rate limiting** em `/auth/login` e `/auth/register` (`@nestjs/throttler`)
- **Helmet** ativado no bootstrap
- **CPF encriptado em repouso** via AES-256-GCM (`PatientProfileRepository`)
- **RBAC granular** — `PrescriptionService.create` exige relação doctor↔patient prévia

### TypeScript / Qualidade

- **`strict: true`** no `tsconfig.json` da API (strictNullChecks, noImplicitAny, etc.)
- **Zero `any`** em `AuthService` e em todos os controllers (via `AuthenticatedRequest`)
- **PrismaExceptionFilter** global traduz erros do Prisma em respostas HTTP corretas

### Arquitetura (SOLID)

- **DIP**: `PaymentService` e `ProfileService` consomem repositórios (`PatientProfileRepository`,
  `DoctorProfileRepository`) através de `ProfileDataModule`. Zero `forwardRef`.
- **SRP**: páginas grandes do web sendo decompostas em componentes presentation puros
  (`AgendaHeader`, `CalendarToolbar`, `ProfileSidebar`)

### Banco

- **`@@index`** em colunas hot: `Appointment(doctorId, date)`, `(patientId, date)`,
  `MedicalRecord(patientId, createdAt)`, `Prescription(...)`, `PatientProfile(asaasCustomerId)`
- **`onDelete: Cascade`** em `MedicalRecordAudit → MedicalRecord` (evita órfãos)

## Tooling

- **Jest + Testing Library** (api e web independentes)
- **ESLint** + **Prettier** + **eslint-plugin-jsx-a11y** (root)
- **Husky** + **lint-staged** rodam `eslint --fix` + `prettier --write` no pre-commit
- **GitHub Actions** (`.github/workflows/ci.yml`) — lint + test + audit em PRs

## Deploy

### Dev local
```bash
docker compose up --build
```
(usa `docker-compose.yml`, sobe api + web com SQLite local)

### Produção (VPS Hostinger + Docker Swarm + Traefik)

```bash
docker stack deploy -c docker-compose.prod.yml hope_saude
```

Pré-requisitos no VPS:

1. `mkdir -p /opt/hope_saude/data`
2. Criar `/opt/hope_saude/api.env` com todas as variáveis (baseado em `.env.example`)
3. `docker network inspect traefik-public || docker network create --driver overlay traefik-public`
4. DNS apontando `api.hope.<dominio>` e `app.hope.<dominio>` para o VPS

Healthchecks via `GET /health` (Terminus): pinga o banco antes de o Swarm declarar o container saudável.

## Testes

- **API**: 170 testes em 30 suítes — `cd apps/api && npx jest`
- **Web**: 98 testes em 23 suítes — `cd apps/web && npx jest`

Cobertura: roda `npx jest --coverage`.

## Roadmap

**Concluído** (sprints 1-4 parcial)
- ✅ Hardening de segurança (JWT env, ValidationPipe, helmet, throttler, CORS whitelist)
- ✅ LGPD: CPF encriptado em repouso (AES-256-GCM)
- ✅ DIP: ciclo payment ↔ profile resolvido via repositórios
- ✅ TypeScript strict mode
- ✅ Filter global Prisma → HTTP
- ✅ Health check endpoint (`/health`)
- ✅ Docker (Dockerfile, compose dev + prod com Traefik)
- ✅ TanStack Query no web
- ✅ Decomposição inicial das páginas monolíticas
- ✅ Next.js 13 → 15, React 18 → 19
- ✅ GitHub Actions CI

**Próximas sprints**
- ⏳ Migração SQLite → PostgreSQL (já existe pgvector no VPS)
- ⏳ Encriptação de `MedicalRecord.content` e `Prescription.medications`
- ⏳ Continuar decomposição de páginas (`agenda` ainda 662 linhas, `profile` 602)
- ⏳ Migrar mais `fetch` solto para hooks de Query
- ⏳ Sentry / Pino logger estruturado
- ⏳ Swagger (`@nestjs/swagger`) — DTOs já compatíveis
- ⏳ Resolver vulns transitivas em devDeps

## Contribuindo

1. Crie um branch a partir de `main`
2. Escreva o teste **antes** da implementação (red)
3. Implemente até passar (green)
4. Refatore mantendo verde
5. Commit (husky vai rodar lint/format)
6. Abra um PR — CI roda lint + tests + audit

## Licença

Privado.
