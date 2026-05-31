# Auth: Cookie HttpOnly + Refresh Token + Helper de Decode (Médio Prazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar a sessão da plataforma de "JWT em localStorage + Bearer" para "access token em cookie HttpOnly+Secure+SameSite=strict com refresh token rotacionado e hashed", mantendo compatibilidade com Bearer durante a transição, e eliminar os 7 `atob` espalhados consolidando o decode do JWT num único helper tipado no front.

**Architecture:** No backend, o `JwtStrategy` passa a extrair o JWT também de um cookie `access_token` (além do header Bearer); o login/registro setam `access_token` (curto) e `refresh_token` (longo) como cookies HttpOnly via `res.cookie`, e o refresh token é persistido hashed (sha256) numa nova tabela `RefreshToken`; uma rota `POST /auth/refresh` valida o cookie, rotaciona o token (revoga o antigo, emite novo par) e re-seta os cookies; CORS já roda com `credentials: true` e origin via whitelist. No frontend, o `api-client` passa `credentials: 'include'` (cookies viajam automaticamente), o `QueryClient` ganha handlers globais de `QueryCache`/`MutationCache` que em 401 limpam estado e redirecionam para `/login`, e os 7 decodes `atob` viram chamadas a um `lib/auth-token.ts` (`decodeToken`/`getUserId`/`getRole`/`isExpired`) tipado que também checa `exp`.

**Tech Stack:** NestJS 11, `@nestjs/jwt`, `passport-jwt` (extrator de cookie), `cookie-parser`, Prisma 5 (SQLite), Jest + ts-jest + supertest (API); Next.js 15 App Router, React 19, TanStack Query, Jest + jest-environment-jsdom + @testing-library (Web). Idioma do código e mensagens: pt-BR.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/api/prisma/schema.prisma` (model `RefreshToken`) | Persistir refresh tokens hashed, com revogação e expiração |
| Create | `apps/api/src/auth/cookie.util.ts` | Centralizar nomes e opções dos cookies de sessão (DRY) |
| Create | `apps/api/src/auth/cookie-extractor.ts` | Extrator de JWT a partir do cookie `access_token` p/ passport |
| Modify | `apps/api/src/auth/jwt.strategy.ts` | Extrair JWT de cookie OU header Bearer (compat) |
| Modify | `apps/api/src/auth/auth.service.ts` | Emitir/rotacionar refresh token hashed + montar par de tokens |
| Modify | `apps/api/src/auth/auth.controller.ts` | Setar cookies no login/registro e expor `POST /auth/refresh` |
| Modify | `apps/api/src/main.ts` | Registrar `cookie-parser` antes dos pipes |
| Create | `apps/api/test/auth-cookie.e2e-spec.ts` | E2E: cookie setado no login, refresh rotaciona, 401 sem cookie |
| Create | `apps/api/src/auth/cookie.util.spec.ts` | Unit: opções de cookie por ambiente |
| Modify | `apps/web/src/lib/api-client.ts` | `credentials: 'include'` em todo fetch |
| Create | `apps/web/src/lib/auth-token.ts` | Helper único: `decodeToken`/`getUserId`/`getRole`/`isExpired` |
| Create | `apps/web/src/lib/__tests__/auth-token.test.ts` | Unit do helper de decode |
| Modify | `apps/web/src/lib/query/query-provider.tsx` | Handlers globais 401 → limpar estado + redirect `/login` |
| Create | `apps/web/src/lib/__tests__/query-auth-handler.test.ts` | Unit do handler logout-on-401 |
| Modify | `apps/web/src/lib/post-auth-redirect.ts` | Usar `getRole` do helper |
| Modify | `apps/web/src/components/Navbar.tsx` | Usar helper (substitui `atob`) |
| Modify | `apps/web/src/app/page.tsx` | Usar helper (substitui `atob`) |
| Modify | `apps/web/src/app/profile/page.tsx` | Usar helper (substitui `atob`) |
| Modify | `apps/web/src/app/dashboard/patient/doctors/page.tsx` | Usar helper (substitui `atob`) |
| Modify | `apps/web/src/app/doctors/[userId]/page.tsx` | Usar helper (substitui `atob`) |
| Modify | `apps/web/src/components/LiveKitVideoCall.tsx` | Usar helper (substitui `atob`) |

---

## Tasks

### Task 1 — Instalar `cookie-parser` e registrar no `main.ts`

**Files:**
- Modify: `apps/api/package.json` (via npm install)
- Modify: `apps/api/src/main.ts`

Sem dependência prévia. `cookie-parser` é pré-requisito para `req.cookies` no extrator e para escrita de cookies em testes. Não há teste vermelho aqui (é wiring de boot); a validação é o build TypeScript e a suíte e2e existente continuar verde.

- [ ] **Step 1 — Instalar a dependência (com autorização: é dep local do projeto, não global).**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npm install cookie-parser@^1.4.7 && npm install --save-dev @types/cookie-parser@^1.4.7
  ```
- [ ] **Step 2 — Registrar o middleware no boot.** Editar `apps/api/src/main.ts`. Adicionar o import no topo (após o import de `helmet`):
  ```typescript
  import cookieParser from 'cookie-parser';
  ```
  E registrar logo após `app.use(helmet());`:
  ```typescript
  // Parser de cookies — necessário para ler access_token/refresh_token do cookie
  app.use(cookieParser());
  ```
- [ ] **Step 3 — Verificar que o build TypeScript e a suíte de auth existente continuam verdes.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit && npx jest test/auth-rbac.e2e-spec.ts --no-coverage
  ```
  Saída esperada: `tsc` sem erros; Jest `Tests: 2 passed`.

  > Se o import default `import cookieParser from 'cookie-parser'` falhar no `tsc` por `esModuleInterop`, usar `import * as cookieParser from 'cookie-parser';` (o projeto usa esse padrão para `bcryptjs`/`supertest`). Validar com o mesmo comando.
- [ ] **Step 4 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/package.json apps/api/package-lock.json apps/api/src/main.ts && git commit -m "feat(api): registra cookie-parser no boot para sessão por cookie"
  ```

---

### Task 2 — `cookie.util.ts`: opções e nomes de cookie centralizados (TDD)

**Files:**
- Create: `apps/api/src/auth/cookie.util.ts`
- Test: `apps/api/src/auth/cookie.util.spec.ts`

Centraliza nomes (`access_token`, `refresh_token`) e opções (`httpOnly`, `secure`, `sameSite`, `maxAge`, `path`) num só lugar (DRY). `secure` depende de `NODE_ENV === 'production'` para não quebrar dev em http.

- [ ] **Step 1 — Escrever o teste vermelho.** Criar `apps/api/src/auth/cookie.util.spec.ts`:
  ```typescript
  import {
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    accessCookieOptions,
    refreshCookieOptions,
  } from './cookie.util';

  describe('cookie.util', () => {
    it('expõe os nomes dos cookies de sessão', () => {
      expect(ACCESS_TOKEN_COOKIE).toBe('access_token');
      expect(REFRESH_TOKEN_COOKIE).toBe('refresh_token');
    });

    it('access cookie é httpOnly + sameSite strict + path /', () => {
      const opts = accessCookieOptions('production');
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('strict');
      expect(opts.path).toBe('/');
      expect(opts.secure).toBe(true);
      expect(opts.maxAge).toBe(60 * 60 * 1000);
    });

    it('refresh cookie é httpOnly e restrito ao path /auth', () => {
      const opts = refreshCookieOptions('production');
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe('strict');
      expect(opts.path).toBe('/auth');
      expect(opts.secure).toBe(true);
      expect(opts.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('secure é false fora de produção (dev em http)', () => {
      expect(accessCookieOptions('development').secure).toBe(false);
      expect(refreshCookieOptions('test').secure).toBe(false);
    });
  });
  ```
- [ ] **Step 2 — Rodar o teste e confirmar que falha (módulo inexistente).**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/cookie.util.spec.ts --no-coverage
  ```
  Saída esperada: falha com `Cannot find module './cookie.util'`.
- [ ] **Step 3 — Escrever a implementação mínima.** Criar `apps/api/src/auth/cookie.util.ts`:
  ```typescript
  import type { CookieOptions } from 'express';

  export const ACCESS_TOKEN_COOKIE = 'access_token';
  export const REFRESH_TOKEN_COOKIE = 'refresh_token';

  const ACCESS_MAX_AGE_MS = 60 * 60 * 1000; // 1h
  const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

  function baseOptions(nodeEnv: string | undefined): Pick<
    CookieOptions,
    'httpOnly' | 'secure' | 'sameSite'
  > {
    return {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'strict',
    };
  }

  /** Cookie do access token: visível em toda a API. */
  export function accessCookieOptions(nodeEnv: string | undefined): CookieOptions {
    return { ...baseOptions(nodeEnv), path: '/', maxAge: ACCESS_MAX_AGE_MS };
  }

  /** Cookie do refresh token: só viaja para rotas /auth (reduz superfície). */
  export function refreshCookieOptions(nodeEnv: string | undefined): CookieOptions {
    return { ...baseOptions(nodeEnv), path: '/auth', maxAge: REFRESH_MAX_AGE_MS };
  }
  ```
- [ ] **Step 4 — Rodar o teste e confirmar verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/cookie.util.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 4 passed`.
- [ ] **Step 5 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/auth/cookie.util.ts apps/api/src/auth/cookie.util.spec.ts && git commit -m "feat(api): cookie.util centraliza nomes e opções dos cookies de sessão"
  ```

---

### Task 3 — Extrator de JWT por cookie no `JwtStrategy` (compat com Bearer, TDD)

**Files:**
- Create: `apps/api/src/auth/cookie-extractor.ts`
- Test: `apps/api/src/auth/cookie-extractor.spec.ts`
- Modify: `apps/api/src/auth/jwt.strategy.ts`

O extrator lê `req.cookies[access_token]`. A estratégia combina `ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()])`, mantendo o Bearer durante a transição.

- [ ] **Step 1 — Escrever o teste vermelho do extrator.** Criar `apps/api/src/auth/cookie-extractor.spec.ts`:
  ```typescript
  import type { Request } from 'express';
  import { cookieTokenExtractor } from './cookie-extractor';

  describe('cookieTokenExtractor', () => {
    it('retorna o token quando o cookie access_token existe', () => {
      const req = { cookies: { access_token: 'jwt.value.here' } } as unknown as Request;
      expect(cookieTokenExtractor(req)).toBe('jwt.value.here');
    });

    it('retorna null quando não há cookies', () => {
      const req = {} as unknown as Request;
      expect(cookieTokenExtractor(req)).toBeNull();
    });

    it('retorna null quando o cookie access_token está ausente', () => {
      const req = { cookies: { outro: 'x' } } as unknown as Request;
      expect(cookieTokenExtractor(req)).toBeNull();
    });
  });
  ```
- [ ] **Step 2 — Rodar e confirmar falha.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/cookie-extractor.spec.ts --no-coverage
  ```
  Saída esperada: `Cannot find module './cookie-extractor'`.
- [ ] **Step 3 — Implementar o extrator.** Criar `apps/api/src/auth/cookie-extractor.ts`:
  ```typescript
  import type { Request } from 'express';
  import { ACCESS_TOKEN_COOKIE } from './cookie.util';

  /** Extrai o JWT do cookie HttpOnly `access_token`. Retorna null se ausente. */
  export function cookieTokenExtractor(req: Request): string | null {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[ACCESS_TOKEN_COOKIE];
    return typeof token === 'string' && token.length > 0 ? token : null;
  }
  ```
- [ ] **Step 4 — Rodar e confirmar verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/cookie-extractor.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 3 passed`.
- [ ] **Step 5 — Ligar o extrator na estratégia.** Editar `apps/api/src/auth/jwt.strategy.ts`. Trocar o import `import { ExtractJwt, Strategy } from 'passport-jwt';` por:
  ```typescript
  import { ExtractJwt, Strategy } from 'passport-jwt';
  import { cookieTokenExtractor } from './cookie-extractor';
  ```
  E trocar a linha `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),` por:
  ```typescript
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieTokenExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
  ```
- [ ] **Step 6 — Verificar que a suíte de auth existente segue verde (Bearer não quebrou).**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/cookie-extractor.spec.ts test/auth-rbac.e2e-spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 5 passed` (3 do extrator + 2 do RBAC).
- [ ] **Step 7 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/auth/cookie-extractor.ts apps/api/src/auth/cookie-extractor.spec.ts apps/api/src/auth/jwt.strategy.ts && git commit -m "feat(api): JwtStrategy extrai token de cookie ou Bearer (compat)"
  ```

---

### Task 4 — Tabela `RefreshToken` no schema Prisma

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/migrations/...` (gerada por `prisma migrate`)

Espelha o padrão de `PasswordResetToken` (token hashed, `expiresAt`, `revokedAt`, `@@index`). Não há teste unitário de schema; a validação é `prisma generate` + `migrate` rodarem e o e2e da Task 6 usar a tabela.

- [ ] **Step 1 — Adicionar o model.** Editar `apps/api/prisma/schema.prisma`, ao lado de `PasswordResetToken`:
  ```prisma
  model RefreshToken {
    id        String    @id @default(uuid())
    userId    Int
    tokenHash String    @unique
    expiresAt DateTime
    revokedAt DateTime?
    createdAt DateTime  @default(now())

    @@index([userId])
    @@map("refresh_tokens")
  }
  ```
- [ ] **Step 2 — Gerar migration e client (SQLite dev).**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add_refresh_token
  ```
  Saída esperada: migration `add_refresh_token` criada e aplicada; `Generated Prisma Client`.
- [ ] **Step 3 — Confirmar que o tipo está disponível e o build passa.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && node -e "const {PrismaClient}=require('@prisma/client'); console.log(typeof new PrismaClient().refreshToken)" && npx tsc --noEmit
  ```
  Saída esperada: `object` e `tsc` sem erros.
- [ ] **Step 4 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/prisma/schema.prisma apps/api/prisma/migrations && git commit -m "feat(api): model RefreshToken (hashed) para sessão por refresh"
  ```

---

### Task 5 — `AuthService`: emitir e rotacionar refresh token hashed (TDD)

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.types.ts`
- Test: `apps/api/src/auth/auth.service.refresh.spec.ts`

Adiciona `issueTokens(user)` (retorna `{ accessToken, refreshToken }`, persistindo o hash do refresh) e `rotateRefreshToken(rawToken)` (valida hash + expiração + não-revogado, revoga o antigo, emite novo par). Reusa `createHash` (já importado) e `jwtService.sign`.

- [ ] **Step 1 — Adicionar o tipo de retorno.** Editar `apps/api/src/auth/auth.types.ts`, ao final:
  ```typescript
  /** Par de tokens emitido no login/refresh (access curto + refresh longo). */
  export interface TokenPair {
    accessToken: string;
    refreshToken: string;
  }
  ```
- [ ] **Step 2 — Escrever o teste vermelho.** Criar `apps/api/src/auth/auth.service.refresh.spec.ts`:
  ```typescript
  import { Test } from '@nestjs/testing';
  import { JwtService } from '@nestjs/jwt';
  import { ConfigService } from '@nestjs/config';
  import { createHash } from 'node:crypto';
  import { AuthService } from './auth.service';
  import { PrismaService } from '../prisma.service';
  import { NotificationsService } from '../notifications/notifications.service';

  describe('AuthService refresh tokens', () => {
    let service: AuthService;
    let prisma: { refreshToken: Record<string, jest.Mock> };

    beforeEach(async () => {
      prisma = {
        refreshToken: {
          create: jest.fn().mockResolvedValue({}),
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const moduleRef = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: prisma },
          { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') } },
          { provide: NotificationsService, useValue: {} },
          { provide: ConfigService, useValue: { get: jest.fn() } },
        ],
      }).compile();
      service = moduleRef.get(AuthService);
    });

    it('issueTokens persiste o hash do refresh (nunca o token cru)', async () => {
      const pair = await service.issueTokens({ id: 7, email: 'a@b.com', role: 'PATIENT' });
      expect(pair.accessToken).toBe('signed.jwt.token');
      expect(typeof pair.refreshToken).toBe('string');
      expect(pair.refreshToken.length).toBeGreaterThan(0);

      const stored = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(stored.userId).toBe(7);
      expect(stored.tokenHash).toBe(
        createHash('sha256').update(pair.refreshToken).digest('hex'),
      );
      expect(stored.tokenHash).not.toBe(pair.refreshToken);
    });

    it('rotateRefreshToken revoga o antigo e emite novo par', async () => {
      const raw = 'raw-refresh-token';
      const tokenHash = createHash('sha256').update(raw).digest('hex');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 7,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      });

      const pair = await service.rotateRefreshToken(raw, { id: 7, email: 'a@b.com', role: 'PATIENT' });

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(pair.accessToken).toBe('signed.jwt.token');
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('rotateRefreshToken rejeita token revogado', async () => {
      const raw = 'raw';
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-2',
        userId: 7,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      });
      await expect(
        service.rotateRefreshToken(raw, { id: 7, email: 'a@b.com', role: 'PATIENT' }),
      ).rejects.toThrow();
    });

    it('rotateRefreshToken rejeita token expirado', async () => {
      const raw = 'raw';
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-3',
        userId: 7,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });
      await expect(
        service.rotateRefreshToken(raw, { id: 7, email: 'a@b.com', role: 'PATIENT' }),
      ).rejects.toThrow();
    });

    it('rotateRefreshToken rejeita token inexistente', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(
        service.rotateRefreshToken('nope', { id: 7, email: 'a@b.com', role: 'PATIENT' }),
      ).rejects.toThrow();
    });
  });
  ```
- [ ] **Step 3 — Rodar e confirmar falha.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.refresh.spec.ts --no-coverage
  ```
  Saída esperada: falha — `service.issueTokens is not a function`.
- [ ] **Step 4 — Implementar os métodos.** Editar `apps/api/src/auth/auth.service.ts`. Trocar o import de `@nestjs/common`:
  ```typescript
  import { Injectable, UnauthorizedException } from '@nestjs/common';
  ```
  Trocar o bloco de import de tipos por:
  ```typescript
  import type {
    AuthTokenResponse,
    JwtSigningPayload,
    NewUserInput,
    PublicUser,
    TokenPair,
    UserRole,
  } from './auth.types';
  ```
  Adicionar, após o método `login(...)`:
  ```typescript
    /** Emite access (curto) + refresh (longo). O refresh é persistido apenas como hash. */
    async issueTokens(user: JwtSigningPayload): Promise<TokenPair> {
      const accessToken = this.jwtService.sign({
        email: user.email,
        sub: user.id,
        role: user.role,
      });

      const refreshToken = randomBytes(48).toString('hex');
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await this.prisma.refreshToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      return { accessToken, refreshToken };
    }

    /** Valida o refresh cru, revoga-o e emite um novo par (rotação). */
    async rotateRefreshToken(rawToken: string, user: JwtSigningPayload): Promise<TokenPair> {
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

      if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      return this.issueTokens(user);
    }
  ```
- [ ] **Step 5 — Rodar e confirmar verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/auth.service.refresh.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 5 passed`.
- [ ] **Step 6 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.types.ts apps/api/src/auth/auth.service.refresh.spec.ts && git commit -m "feat(api): AuthService issueTokens/rotateRefreshToken com refresh hashed"
  ```

---

### Task 6 — Controller seta cookies no login/registro e expõe `POST /auth/refresh` (TDD e2e)

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`
- Test: `apps/api/test/auth-cookie.e2e-spec.ts`

O login/registro continuam retornando `access_token` no body (compat com o front atual) **e** setam os cookies. `/auth/refresh` lê o cookie `refresh_token`, rotaciona e re-seta os cookies. Usa `@Res({ passthrough: true })` para escrever cookies sem perder o retorno JSON do Nest.

- [ ] **Step 1 — Escrever o e2e vermelho.** Criar `apps/api/test/auth-cookie.e2e-spec.ts`:
  ```typescript
  import { Test, TestingModule } from '@nestjs/testing';
  import { INestApplication } from '@nestjs/common';
  import * as request from 'supertest';
  import * as cookieParser from 'cookie-parser';
  import { AppModule } from '../src/app.module';
  import { PrismaService } from '../src/prisma.service';

  describe('Auth Cookie + Refresh (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    const email = `cookie-${Date.now()}@hope.test`;

    beforeAll(async () => {
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-cookie';
      process.env.MAIL_DRIVER = process.env.MAIL_DRIVER || 'smtp';
      process.env.MAIL_FROM = process.env.MAIL_FROM || 'Hope <no-reply@hope.test>';
      process.env.SMTP_HOST = process.env.SMTP_HOST || 'localhost';
      process.env.SMTP_PORT = process.env.SMTP_PORT || '1025';
      process.env.MAIL_APP_URL = process.env.MAIL_APP_URL || 'http://localhost:3001';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.use(cookieParser());
      await app.init();
      prisma = app.get(PrismaService);
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email } });
      await app.close();
    });

    function cookieValue(setCookie: string[] | undefined, name: string): string | undefined {
      const header = (setCookie ?? []).find((c) => c.startsWith(`${name}=`));
      return header?.split(';')[0].split('=')[1];
    }

    it('register seta cookies HttpOnly access_token e refresh_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Cookie User', email, password: 'senha1234', role: 'PATIENT' })
        .expect(201);

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const access = setCookie.find((c) => c.startsWith('access_token='));
      const refresh = setCookie.find((c) => c.startsWith('refresh_token='));
      expect(access).toContain('HttpOnly');
      expect(access).toContain('SameSite=Strict');
      expect(refresh).toContain('HttpOnly');
      expect(refresh).toContain('Path=/auth');
      expect(res.body.access_token).toBeDefined();
    });

    it('refresh rotaciona o token e re-seta os cookies', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'senha1234' })
        .expect(201);

      const loginCookies = login.headers['set-cookie'] as unknown as string[];
      const oldRefresh = cookieValue(loginCookies, 'refresh_token');

      const refreshed = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${oldRefresh}`)
        .expect(201);

      const newCookies = refreshed.headers['set-cookie'] as unknown as string[];
      const newRefresh = cookieValue(newCookies, 'refresh_token');
      expect(newRefresh).toBeDefined();
      expect(newRefresh).not.toBe(oldRefresh);
      expect(refreshed.body.access_token).toBeDefined();

      // o refresh antigo agora é inválido (rotação)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${oldRefresh}`)
        .expect(401);
    });

    it('refresh sem cookie retorna 401', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });
  });
  ```
- [ ] **Step 2 — Rodar e confirmar falha.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest test/auth-cookie.e2e-spec.ts --no-coverage
  ```
  Saída esperada: falha — `/auth/refresh` retorna 404 e `set-cookie` ausente.
- [ ] **Step 3 — Implementar no controller.** Editar `apps/api/src/auth/auth.controller.ts`. Atualizar o import de `@nestjs/common` para incluir `Res`:
  ```typescript
  import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    Request,
    Res,
    UnauthorizedException,
    NotFoundException,
    HttpCode,
    HttpStatus,
  } from '@nestjs/common';
  ```
  Adicionar imports (após o import de `RequestEmailVerificationDto`):
  ```typescript
  import type { Response, Request as ExpressRequest } from 'express';
  import {
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    accessCookieOptions,
    refreshCookieOptions,
  } from './cookie.util';
  import type { JwtSigningPayload } from './auth.types';
  ```
  Adicionar um helper privado e refatorar `register`/`login`, e criar `refresh`. Substituir os métodos `register` e `login` por:
  ```typescript
    private setSessionCookies(
      res: Response,
      tokens: { accessToken: string; refreshToken: string },
    ): void {
      const env = process.env.NODE_ENV;
      res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, accessCookieOptions(env));
      res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshCookieOptions(env));
    }

    @ApiOperation({ summary: 'Cadastra e já loga o usuário, retornando access_token' })
    @Throttle({ auth: { limit: 10, ttl: 60_000 } })
    @Post('register')
    async register(
      @Body() createUserDto: RegisterDto,
      @Res({ passthrough: true }) res: Response,
    ) {
      const result = await this.authService.registerAndLogin(createUserDto);
      const user = await this.authService.findUserByEmail(createUserDto.email);
      const tokens = await this.authService.issueTokens({
        id: user!.id,
        email: user!.email,
        role: user!.role as JwtSigningPayload['role'],
      });
      this.setSessionCookies(res, tokens);
      return result;
    }

    @ApiOperation({ summary: 'Login com e-mail/senha — retorna JWT' })
    @Throttle({ auth: { limit: 10, ttl: 60_000 } })
    @Post('login')
    async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
      const user = await this.authService.validateUser(body.email, body.password);
      if (!user) {
        throw new UnauthorizedException('Credenciais inválidas');
      }
      const result = await this.authService.login({
        id: user.id,
        email: user.email,
        role: user.role,
      });
      const tokens = await this.authService.issueTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });
      this.setSessionCookies(res, tokens);
      return result;
    }

    @ApiOperation({ summary: 'Rotaciona o refresh token e re-emite o par de cookies' })
    @Throttle({ auth: { limit: 30, ttl: 60_000 } })
    @Post('refresh')
    async refresh(
      @Request() req: ExpressRequest & { cookies?: Record<string, string> },
      @Res({ passthrough: true }) res: Response,
    ) {
      const raw = req.cookies?.[REFRESH_TOKEN_COOKIE];
      if (!raw) {
        throw new UnauthorizedException('Refresh token ausente');
      }
      const stored = await this.authService.findUserByRefreshToken(raw);
      if (!stored) {
        throw new UnauthorizedException('Refresh token inválido');
      }
      const tokens = await this.authService.rotateRefreshToken(raw, {
        id: stored.id,
        email: stored.email,
        role: stored.role as JwtSigningPayload['role'],
      });
      this.setSessionCookies(res, tokens);
      return { access_token: tokens.accessToken };
    }
  ```
- [ ] **Step 4 — Adicionar `findUserByRefreshToken` no service.** Editar `apps/api/src/auth/auth.service.ts`, após `rotateRefreshToken`:
  ```typescript
    /** Resolve o usuário dono de um refresh token válido (sem rotacionar). */
    async findUserByRefreshToken(rawToken: string): Promise<PublicUser | null> {
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
        return null;
      }
      return this.getPublicUserById(stored.userId);
    }
  ```
- [ ] **Step 5 — Rodar e confirmar verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest test/auth-cookie.e2e-spec.ts src/auth/auth.service.refresh.spec.ts --no-coverage
  ```
  Saída esperada: `Tests: 8 passed` (3 e2e + 5 unit do service).
- [ ] **Step 6 — Rodar a suíte de auth completa para garantir não-regressão.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest test/auth-rbac.e2e-spec.ts test/auth-cookie.e2e-spec.ts src/auth --no-coverage
  ```
  Saída esperada: todos verdes (RBAC + cookie e2e + units de auth).
- [ ] **Step 7 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.service.ts apps/api/test/auth-cookie.e2e-spec.ts && git commit -m "feat(api): login/register setam cookies e rota /auth/refresh rotaciona sessão"
  ```

---

### Task 7 — `api-client` envia cookies (`credentials: 'include'`)

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

Garante que os cookies HttpOnly viajem em toda requisição. Mantém o header Bearer durante a transição (lê localStorage se existir). Sem teste novo dedicado — a validação é o type-check e a suíte web não regredir.

- [ ] **Step 1 — Adicionar `credentials: 'include'` ao fetch.** Editar `apps/web/src/lib/api-client.ts`. Trocar o bloco do `fetch`:
  ```typescript
    const response = await fetch(url, {
      ...rest,
      credentials: 'include',
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });
  ```
- [ ] **Step 2 — Verificar type-check e suíte web (não regrediu).**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx tsc --noEmit && npm run test:unit -- --silent
  ```
  Saída esperada: `tsc` sem erros; suíte web `183 passed` (estado atual mantido).
- [ ] **Step 3 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/web/src/lib/api-client.ts && git commit -m "feat(web): api-client envia cookies de sessão com credentials include"
  ```

---

### Task 8 — Helper único `lib/auth-token.ts` (TDD)

**Files:**
- Create: `apps/web/src/lib/auth-token.ts`
- Test: `apps/web/src/lib/__tests__/auth-token.test.ts`

Consolida os 7 `atob`. Decode tolerante (retorna `null` em token malformado), tipado, com checagem de `exp`. Segue o padrão de `makeFakeJwtPayload` já usado em `post-auth-redirect.test.ts`.

- [ ] **Step 1 — Escrever o teste vermelho.** Criar `apps/web/src/lib/__tests__/auth-token.test.ts`:
  ```typescript
  import { decodeToken, getRole, getUserId, isExpired } from '../auth-token';

  function makeJwt(payload: Record<string, unknown>): string {
    return `header.${btoa(JSON.stringify(payload))}.sig`;
  }

  describe('auth-token', () => {
    it('decodeToken extrai o payload tipado', () => {
      const token = makeJwt({ sub: 9, role: 'DOCTOR', email: 'd@hope.test', exp: 9999999999 });
      const decoded = decodeToken(token);
      expect(decoded).toEqual({ sub: 9, role: 'DOCTOR', email: 'd@hope.test', exp: 9999999999 });
    });

    it('decodeToken retorna null para token malformado', () => {
      expect(decodeToken('not-a-jwt')).toBeNull();
      expect(decodeToken('a.@@@.c')).toBeNull();
      expect(decodeToken('')).toBeNull();
    });

    it('getRole e getUserId leem os campos do payload', () => {
      const token = makeJwt({ sub: 42, role: 'PATIENT' });
      expect(getRole(token)).toBe('PATIENT');
      expect(getUserId(token)).toBe(42);
    });

    it('getRole/getUserId retornam null em token inválido', () => {
      expect(getRole('lixo')).toBeNull();
      expect(getUserId('lixo')).toBeNull();
    });

    it('isExpired true quando exp já passou', () => {
      const past = Math.floor(Date.now() / 1000) - 60;
      expect(isExpired(makeJwt({ sub: 1, role: 'PATIENT', exp: past }))).toBe(true);
    });

    it('isExpired false quando exp está no futuro', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      expect(isExpired(makeJwt({ sub: 1, role: 'PATIENT', exp: future }))).toBe(false);
    });

    it('isExpired true para token sem exp ou malformado (trata como expirado)', () => {
      expect(isExpired(makeJwt({ sub: 1, role: 'PATIENT' }))).toBe(true);
      expect(isExpired('lixo')).toBe(true);
    });
  });
  ```
- [ ] **Step 2 — Rodar e confirmar falha.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npm run test:unit -- src/lib/__tests__/auth-token.test.ts
  ```
  Saída esperada: falha — `Cannot find module '../auth-token'`.
- [ ] **Step 3 — Implementar o helper.** Criar `apps/web/src/lib/auth-token.ts`:
  ```typescript
  export type JwtRole = 'DOCTOR' | 'PATIENT';

  export interface DecodedToken {
    sub?: number;
    role?: JwtRole;
    email?: string;
    exp?: number;
  }

  /** Decodifica o payload do JWT. Retorna null se o token for malformado. */
  export function decodeToken(token: string | null | undefined): DecodedToken | null {
    if (!token) return null;
    const part = token.split('.')[1];
    if (!part) return null;
    try {
      return JSON.parse(atob(part)) as DecodedToken;
    } catch {
      return null;
    }
  }

  /** Papel do usuário (DOCTOR/PATIENT) ou null. */
  export function getRole(token: string | null | undefined): JwtRole | null {
    return decodeToken(token)?.role ?? null;
  }

  /** ID numérico do usuário (claim `sub`) ou null. */
  export function getUserId(token: string | null | undefined): number | null {
    const sub = decodeToken(token)?.sub;
    return typeof sub === 'number' ? sub : null;
  }

  /** True se o token está expirado, sem `exp`, ou malformado (fail-safe). */
  export function isExpired(token: string | null | undefined): boolean {
    const exp = decodeToken(token)?.exp;
    if (typeof exp !== 'number') return true;
    return exp * 1000 <= Date.now();
  }
  ```
- [ ] **Step 4 — Rodar e confirmar verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npm run test:unit -- src/lib/__tests__/auth-token.test.ts
  ```
  Saída esperada: `Tests: 7 passed`.
- [ ] **Step 5 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/web/src/lib/auth-token.ts apps/web/src/lib/__tests__/auth-token.test.ts && git commit -m "feat(web): auth-token helper tipado (decode/role/userId/isExpired)"
  ```

---

### Task 9 — Substituir os 7 `atob` pelo helper

**Files:**
- Modify: `apps/web/src/lib/post-auth-redirect.ts`
- Modify: `apps/web/src/components/Navbar.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`
- Modify: `apps/web/src/app/dashboard/patient/doctors/page.tsx`
- Modify: `apps/web/src/app/doctors/[userId]/page.tsx`
- Modify: `apps/web/src/components/LiveKitVideoCall.tsx`

DRY: cada `JSON.parse(atob(...))` vira chamada ao helper. `profile/page.tsx` ganha checagem de `isExpired` (token expirado → `/login`). Os testes existentes de `post-auth-redirect` continuam válidos (assinatura inalterada).

- [ ] **Step 1 — `post-auth-redirect.ts`.** Editar `apps/web/src/lib/post-auth-redirect.ts`. Substituir o corpo de `getPostAuthRedirectPath`:
  ```typescript
  import { getRole } from './auth-token';

  /**
   * Decide para onde enviar o usuário após login ou cadastro com sessão (SRP, testável sem DOM).
   */
  export function getPostAuthRedirectPath(accessToken: string): string {
    return getRole(accessToken) === 'DOCTOR' ? '/dashboard/doctor' : '/';
  }

  /** Persiste o token e navega para o destino pós-autenticação (browser apenas). */
  export function persistSessionAndRedirect(accessToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', accessToken);
    window.location.href = getPostAuthRedirectPath(accessToken);
  }
  ```
- [ ] **Step 2 — `Navbar.tsx`.** Editar `apps/web/src/components/Navbar.tsx`. Adicionar import após `import { LogOut } from 'lucide-react';`:
  ```typescript
  import { getRole } from '@/lib/auth-token';
  ```
  Substituir o corpo de `syncAuth`:
  ```typescript
      const syncAuth = () => {
        const token = localStorage.getItem('token');
        const role = getRole(token);
        if (token && role) {
          setIsLoggedIn(true);
          setUserRole(role);
        } else {
          setIsLoggedIn(false);
          setUserRole(null);
        }
      };
  ```
- [ ] **Step 3 — `app/page.tsx`.** Editar `apps/web/src/app/page.tsx`. Adicionar import após `import Link from 'next/link';`:
  ```typescript
  import { getRole } from '@/lib/auth-token';
  ```
  Substituir o `useEffect`:
  ```typescript
    useEffect(() => {
      const token = localStorage.getItem('token');
      const role = getRole(token);
      if (token && role) {
        setIsLoggedIn(true);
        setUserRole(role);
      }
    }, []);
  ```
- [ ] **Step 4 — `profile/page.tsx`.** Editar `apps/web/src/app/profile/page.tsx`. Adicionar import após `import { useDoctorsList } from '@/lib/query/use-doctors';`:
  ```typescript
  import { getUserId, getRole, isExpired } from '@/lib/auth-token';
  ```
  Substituir o `useEffect` que decodifica o token:
  ```typescript
    // 1. Extrai userId do JWT local (não é uma chamada ao servidor)
    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token || isExpired(token)) {
        router.replace('/login');
        return;
      }
      const uid = getUserId(token);
      const role = getRole(token);
      if (!uid || !role) {
        router.replace('/login');
        return;
      }
      setUserId(uid);
      setTokenReady(true);
    }, [router]);
  ```
- [ ] **Step 5 — `dashboard/patient/doctors/page.tsx`.** Editar `apps/web/src/app/dashboard/patient/doctors/page.tsx`. Adicionar import após `import type { PublicDoctor } from '@/lib/doctors-api';`:
  ```typescript
  import { getRole } from '@/lib/auth-token';
  ```
  Substituir o `useEffect` de guarda:
  ```typescript
    // Guarda de auth — só PATIENT
    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }
      const role = getRole(token);
      if (!role) {
        router.replace('/login');
        return;
      }
      if (role !== 'PATIENT') {
        router.replace('/');
        return;
      }
      setAuthorized(true);
    }, [router]);
  ```
- [ ] **Step 6 — `doctors/[userId]/page.tsx`.** Editar `apps/web/src/app/doctors/[userId]/page.tsx`. Adicionar import após `import { useDoctorDetail } from '@/lib/query/use-doctors';`:
  ```typescript
  import { getRole } from '@/lib/auth-token';
  ```
  Substituir o `useEffect` de guarda:
  ```typescript
    // Guarda de auth client-side (só PATIENT pode acessar esta página)
    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }
      const role = getRole(token);
      if (!role) {
        router.replace('/login');
        return;
      }
      if (role !== 'PATIENT') {
        router.replace('/');
        return;
      }
      setAuthorized(true);
    }, [router]);
  ```
- [ ] **Step 7 — `LiveKitVideoCall.tsx`.** Editar `apps/web/src/components/LiveKitVideoCall.tsx`. Adicionar import após `import { useState, useEffect } from 'react';`:
  ```typescript
  import { getRole } from '@/lib/auth-token';
  ```
  Substituir o `useEffect` que lê o token:
  ```typescript
    useEffect(() => {
      setUserRole(getRole(localStorage.getItem('token')));
    }, []);
  ```
- [ ] **Step 8 — Confirmar que nenhum `atob` de JWT sobrou.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && grep -rn "atob(" src --include=*.ts --include=*.tsx
  ```
  Saída esperada: nenhuma linha (exit 1 / vazio).
- [ ] **Step 9 — Type-check e suíte web verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx tsc --noEmit && npm run test:unit -- --silent
  ```
  Saída esperada: `tsc` sem erros; suíte web continua verde (inclui `post-auth-redirect.test.ts` e `auth-token.test.ts`).
- [ ] **Step 10 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/web/src/lib/post-auth-redirect.ts apps/web/src/components/Navbar.tsx apps/web/src/app/page.tsx apps/web/src/app/profile/page.tsx apps/web/src/app/dashboard/patient/doctors/page.tsx apps/web/src/app/doctors/[userId]/page.tsx apps/web/src/components/LiveKitVideoCall.tsx && git commit -m "refactor(web): consolida 7 decodes atob de JWT no helper auth-token"
  ```

---

### Task 10 — Handler global logout-on-401 no QueryClient (TDD)

**Files:**
- Create: `apps/web/src/lib/auth-redirect.ts`
- Test: `apps/web/src/lib/__tests__/query-auth-handler.test.ts`
- Modify: `apps/web/src/lib/query/query-provider.tsx`

Extrai a lógica de "401 → limpar token + ir para /login" para uma função pura testável (`handleAuthError`), e a liga ao `QueryCache`/`MutationCache` do `QueryClient`. O erro lançado pelo `api-client` carrega `status` (vide `api-client.ts`).

- [ ] **Step 1 — Escrever o teste vermelho.** Criar `apps/web/src/lib/__tests__/query-auth-handler.test.ts`:
  ```typescript
  import { handleAuthError } from '../auth-redirect';

  describe('handleAuthError', () => {
    const origHref = window.location.href;

    beforeEach(() => {
      localStorage.setItem('token', 'algum.token.aqui');
      Object.defineProperty(window, 'location', {
        value: { href: origHref },
        writable: true,
      });
    });

    it('em 401 limpa o token e redireciona para /login', () => {
      handleAuthError({ status: 401 });
      expect(localStorage.getItem('token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('ignora erros que não são 401', () => {
      handleAuthError({ status: 500 });
      expect(localStorage.getItem('token')).toBe('algum.token.aqui');
      expect(window.location.href).toBe(origHref);
    });

    it('ignora erro sem status', () => {
      handleAuthError(new Error('rede caiu'));
      expect(localStorage.getItem('token')).toBe('algum.token.aqui');
    });

    it('não redireciona em loop se já estiver em /login', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'http://localhost/login', pathname: '/login' },
        writable: true,
      });
      handleAuthError({ status: 401 });
      expect(window.location.href).toBe('http://localhost/login');
    });
  });
  ```
- [ ] **Step 2 — Rodar e confirmar falha.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npm run test:unit -- src/lib/__tests__/query-auth-handler.test.ts
  ```
  Saída esperada: falha — `Cannot find module '../auth-redirect'`.
- [ ] **Step 3 — Implementar a função pura.** Criar `apps/web/src/lib/auth-redirect.ts`:
  ```typescript
  /** Status 401 → encerra a sessão local e manda para /login (sem loop na própria /login). */
  export function handleAuthError(error: unknown): void {
    const status = (error as { status?: number } | null)?.status;
    if (status !== 401) return;
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/login') return;
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  ```
- [ ] **Step 4 — Rodar e confirmar verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npm run test:unit -- src/lib/__tests__/query-auth-handler.test.ts
  ```
  Saída esperada: `Tests: 4 passed`.
- [ ] **Step 5 — Ligar ao QueryClient.** Editar `apps/web/src/lib/query/query-provider.tsx`. Substituir o conteúdo por:
  ```tsx
  'use client';

  import { useState, type ReactNode } from 'react';
  import {
    QueryClient,
    QueryClientProvider,
    QueryCache,
    MutationCache,
  } from '@tanstack/react-query';
  import { handleAuthError } from '@/lib/auth-redirect';

  /**
   * Provider global do TanStack Query.
   * QueryClient é criado uma única vez via useState para sobreviver a HMR
   * e nunca recriar entre renders no mesmo client.
   */
  export function QueryProvider({ children }: { children: ReactNode }) {
    const [client] = useState(
      () =>
        new QueryClient({
          queryCache: new QueryCache({ onError: handleAuthError }),
          mutationCache: new MutationCache({ onError: handleAuthError }),
          defaultOptions: {
            queries: {
              staleTime: 30_000,
              gcTime: 5 * 60_000,
              refetchOnWindowFocus: false,
              retry: 1,
            },
            mutations: {
              retry: 0,
            },
          },
        }),
    );

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  ```
- [ ] **Step 6 — Type-check e suíte web verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx tsc --noEmit && npm run test:unit -- --silent
  ```
  Saída esperada: `tsc` sem erros; toda a suíte web verde.
- [ ] **Step 7 — Commit.**
  ```bash
  cd /root/rodrigo/hope_saude && git add apps/web/src/lib/auth-redirect.ts apps/web/src/lib/__tests__/query-auth-handler.test.ts apps/web/src/lib/query/query-provider.tsx && git commit -m "feat(web): logout-on-401 global no QueryCache/MutationCache"
  ```

---

### Task 11 — Validação final integrada

**Files:** (nenhum novo — verificação)

- [ ] **Step 1 — Suíte completa da API verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
  ```
  Saída esperada: todas as suítes passam (241 testes anteriores + novos de cookie/refresh/extrator). Nenhuma regressão.
- [ ] **Step 2 — Type-check + suíte completa do Web verde.**
  ```bash
  cd /root/rodrigo/hope_saude/apps/web && npx tsc --noEmit && npm run test:unit
  ```
  Saída esperada: `tsc` sem erros; suíte web verde (183 anteriores + `auth-token` + `query-auth-handler`).
- [ ] **Step 3 — Confirmar ausência de `any` introduzido e de `atob` residual.**
  ```bash
  cd /root/rodrigo/hope_saude && grep -rn ": any\|as any" apps/web/src/lib/auth-token.ts apps/web/src/lib/auth-redirect.ts apps/api/src/auth/cookie.util.ts apps/api/src/auth/cookie-extractor.ts; grep -rn "atob(" apps/web/src --include=*.ts --include=*.tsx
  ```
  Saída esperada: nenhuma linha em ambos os greps (zero `any`, zero `atob`).
- [ ] **Step 4 — Commit final (se algum ajuste de lint/format foi necessário).**
  ```bash
  cd /root/rodrigo/hope_saude && git status --short
  ```
  Se houver mudanças pendentes legítimas, commitar com `git add <paths> && git commit -m "chore(auth): ajustes finais da migração cookie+refresh"`. Caso contrário, nada a fazer.

---

## Self-Review

**Cobertura dos gaps da auditoria:**

- **Backend — JWT em cookie HttpOnly+Secure+SameSite=strict:** Task 2 (`cookie.util` com `httpOnly/secure/sameSite='strict'`), Task 6 (`res.cookie` no login/registro). `secure` é gated por `NODE_ENV === 'production'` para não quebrar dev em http. ✅
- **Backend — extrator de cookie no `jwt.strategy` (cookie-parser):** Task 1 (instala/registra `cookie-parser`), Task 3 (`cookieTokenExtractor` + `ExtractJwt.fromExtractors`). ✅
- **Backend — compat com Bearer durante transição:** Task 3 mantém `ExtractJwt.fromAuthHeaderAsBearerToken()` na lista de extratores; Task 6 mantém `access_token` no body do login/registro; Task 7 mantém o header `Authorization` no `api-client`. ✅
- **Backend — refresh token (rota `/auth/refresh`, longa duração, rotacionado, hashed):** Task 4 (model `RefreshToken` com `tokenHash @unique`, `revokedAt`), Task 5 (`issueTokens`/`rotateRefreshToken` — persiste sha256, revoga o antigo, valida expiração/revogação), Task 6 (rota `POST /auth/refresh` lendo o cookie). ✅
- **Backend — CORS com `credentials: true` restrito a origins explícitas:** já existente em `main.ts` (`enableCors({ origin: parseCorsOrigins(...), credentials: true })`); o plano não regride isso e os cookies dependem dele. Coberto/preservado. ✅
- **Frontend — `credentials: 'include'`:** Task 7. ✅
- **Frontend — handler global de 401 (QueryCache/MutationCache) que limpa estado e redireciona /login:** Task 10 (`handleAuthError` puro + `QueryCache`/`MutationCache` no provider, com guarda anti-loop em `/login`). ✅
- **Frontend — consolidar os 7 `atob` num único `lib/auth-token.ts` tipado com `decodeToken/getUserId/getRole/isExpired` + checar `exp`:** Task 8 (helper + testes), Task 9 (substitui os 7 locais: `page.tsx`, `profile/page.tsx`, `Navbar.tsx`, `dashboard/patient/doctors/page.tsx`, `doctors/[userId]/page.tsx`, `LiveKitVideoCall.tsx`, `post-auth-redirect.ts`), com `isExpired` aplicado no guard de `profile/page.tsx`. Step de verificação garante zero `atob` residual. ✅
- **Testes backend (cookie setado, refresh rotaciona, 401 sem cookie):** Task 6 e2e (`auth-cookie.e2e-spec.ts`) cobre os três casos + invalidação do refresh antigo. ✅
- **Testes web (helper, logout-on-401):** Task 8 (`auth-token.test.ts`) e Task 10 (`query-auth-handler.test.ts`). ✅

**Convenções do projeto:** TDD red→green em todas as Tasks com lógica (2, 3, 5, 6, 8, 10); ZERO `any` em produção (helpers tipados; o único cast é `user!` após `findUserByEmail`, com `!` justificado por já ter sido criado no mesmo request — verificado no Step 3 da validação); sem `forwardRef`; `AuthenticatedRequest`/shape `{ userId, email, role }` preservado (a estratégia continua retornando `{ userId, email, role }`); comandos de teste no formato `cd /root/rodrigo/hope_saude/apps/api && npx jest <arquivo> --no-coverage` (API) e `npm run test:unit` (Web); path correto `/root/rodrigo/hope_saude` em todos os comandos. ✅

**Ausência de placeholders:** Todos os passos de código mostram o bloco real e completo. Todos os símbolos referenciados são definidos numa Task anterior (`ACCESS_TOKEN_COOKIE`, `accessCookieOptions`, `cookieTokenExtractor`, `TokenPair`, `issueTokens`, `rotateRefreshToken`, `findUserByRefreshToken`, `decodeToken/getRole/getUserId/isExpired`, `handleAuthError`) ou já existem no repo (`AuthService.login/validateUser/findUserByEmail/getPublicUserById`, `JwtService.sign`, `randomBytes/createHash`, `parseCorsOrigins`). Sem "TODO"/"implementar depois"/"similar à Task N". ✅
