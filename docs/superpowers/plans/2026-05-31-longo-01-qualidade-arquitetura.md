# Qualidade & Arquitetura (Longo Prazo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar a base da API ao padrão de produção da telepsiquiatria — `strict: true`, ZERO `any` em produção, DTOs validados, RBAC unificado por guard reutilizável, exceções HTTP corretas e auditoria de assinatura — mantendo a suíte (241 testes / 42 suítes) verde a cada Task.

**Architecture:** Mudanças incrementais e TDD-first sobre o monorepo NestJS 11 + Prisma 5. Cada Task escreve o teste vermelho antes da implementação (red→green→refactor), commita pequeno e preserva os contratos públicos (`AuthenticatedRequest` com `req.user = { userId, email, role }`, DI token `'SignatureProvider'`, `PrismaExceptionFilter` mapeando P2025→404 / P2002→409 / P2003→400). Os endpoints clínicos passam a ter DTOs `class-validator`, a checagem de papel sai dos controllers para um par `@Roles + RolesGuard` + um guard de propriedade `OwnerOrDoctorGuard`, e `MedicalRecordService.sign()` grava auditoria de assinatura na mesma transação.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite, `url = "file:./dev.db"`), Jest (ts-jest, `isolatedModules`), class-validator, @nestjs/swagger, passport-jwt, TypeScript strict.

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `apps/api/tsconfig.json` | Ativar `"strict": true` (habilita `strictPropertyInitialization`, `strictFunctionTypes`, `useUnknownInCatchVariables`, `alwaysStrict`, `strict*` restantes) |
| Modify | `apps/api/src/auth/jwt.strategy.ts` | Tipar `validate(payload: JwtPayload)`; remover `any` |
| Create | `apps/api/src/auth/jwt-payload.ts` | Interface `JwtPayload` (claims do token) |
| Modify | `apps/api/src/common/signature.provider.ts` | `sign(content: string, authData: unknown)`; remover `any` |
| Modify | `apps/api/src/availability/weekly-availability.ts` | Remover `(item as any)` em `parseAvailabilityJson` |
| Modify | `apps/api/src/profile/data/patient-profile.repository.ts` | Tipar payload do upsert com `Prisma.PatientProfileUncheckedUpdateInput` / `...CreateInput`; remover `as any` |
| Modify | `apps/api/src/profile/profile.service.ts` | Tipar `createDoctorProfile`, `setupPatientProfile`, `upsertPatientProfile` com DTOs e `AuthenticatedUser`; remover `any` |
| Create | `apps/api/src/profile/dto/create-doctor-profile.dto.ts` | DTO de criação de perfil médico |
| Create | `apps/api/src/clinical-scale/dto/create-scale.dto.ts` | DTO validado de criação de escala |
| Create | `apps/api/src/clinical-scale/dto/submit-answers.dto.ts` | DTO validado de submissão de respostas |
| Create | `apps/api/src/medical-record/dto/amend-medical-record.dto.ts` | DTO validado de emenda (update) de prontuário |
| Create | `apps/api/src/medical-record/dto/sign-document.dto.ts` | DTO validado de assinatura (authData) — reusado por prescription |
| Modify | `apps/api/src/clinical-scale/clinical-scale.controller.ts` | Usar DTOs; aplicar `@Roles('DOCTOR') + RolesGuard` e `OwnerOrDoctorGuard` |
| Modify | `apps/api/src/medical-record/medical-record.controller.ts` | Usar DTOs; aplicar `@Roles('DOCTOR')` e `OwnerOrDoctorGuard` no GET |
| Modify | `apps/api/src/prescription/prescription.controller.ts` | Usar DTO de assinatura; aplicar `@Roles('DOCTOR')` e `OwnerOrDoctorGuard` no GET |
| Modify | `apps/api/src/profile/profile.controller.ts` | Aplicar `@Roles('DOCTOR') + RolesGuard` nos endpoints de médico |
| Create | `apps/api/src/auth/owner-or-doctor.guard.ts` | Guard reutilizável: DOCTOR passa; PATIENT só com `userId === :patientId` |
| Create | `apps/api/src/auth/owner-or-doctor.guard.spec.ts` | Testes do guard |
| Modify | `apps/api/src/auth/roles.guard.ts` | Remover `console.log`; tipar `getRequest<AuthenticatedRequest>()` |
| Modify | `apps/api/src/payment/payment.service.ts` | `throw new Error('Perfil...')` → `NotFoundException` |
| Modify | `apps/api/src/video/video.service.ts` | `throw new Error('LIVEKIT...')` mantido (invariante de bootstrap) — documentar; trocar erro de domínio se houver |
| Modify | `apps/api/prisma/schema.prisma` | Novo model `MedicalRecordSignatureAudit` |
| Create | `apps/api/prisma/migrations/<ts>_medical_record_signature_audit/migration.sql` | DDL da tabela de auditoria de assinatura |
| Modify | `apps/api/src/medical-record/medical-record.service.ts` | `sign()` grava `MedicalRecordSignatureAudit` (quem/quando/hash) na mesma transação |

---

## Tasks

> Ordem por dependência e severidade: (1) strict destrava o type-checking real → (2) remover `any` → (3) DTOs → (4) RBAC → (5) exceções → (6) auditoria de assinatura. Rodar a suíte do arquivo tocado a cada Task. Comando padrão de teste:
> `cd /root/rodrigo/hope_saude/apps/api && npx jest <arquivo> --no-coverage`

---

### Task 1 — Ativar `strict: true` no tsconfig (compila a suíte inteira)

Habilitar `strict` liga `strictPropertyInitialization` e `useUnknownInCatchVariables`, que podem quebrar a compilação. Como o Jest usa `ts-jest` com `isolatedModules`, o type-check completo só acontece no `tsc --noEmit`. Esta Task usa `tsc --noEmit` como o "teste" red→green.

**Files:**
- Modify: `apps/api/tsconfig.json`
- Test (verificação): `npx tsc --noEmit` (não há `.spec` — o type-check é o critério)

**Steps:**

- [ ] **Step 1: Escrever a verificação que falha (type-check sob strict).**
  Editar `apps/api/tsconfig.json` adicionando `"strict": true` logo após `"skipLibCheck": true`:
  ```json
  {
    "compilerOptions": {
      "module": "commonjs",
      "declaration": true,
      "removeComments": true,
      "emitDecoratorMetadata": true,
      "experimentalDecorators": true,
      "allowSyntheticDefaultImports": true,
      "target": "ES2021",
      "sourceMap": true,
      "outDir": "./dist",
      "baseUrl": "./",
      "incremental": true,
      "skipLibCheck": true,
      "strict": true,
      "strictNullChecks": true,
      "noImplicitAny": true,
      "strictBindCallApply": true,
      "forceConsistentCasingInFileNames": true,
      "noFallthroughCasesInSwitch": true,
      "types": ["jest", "node"],
      "jsx": "react-jsx"
    }
  }
  ```

- [ ] **Step 2: Rodar o type-check para ver os erros.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit
  ```
  Esperado: erros `TS2564` (`Property '...' has no initializer`) em classes com campos sem `!`/`?`/default, e possíveis `TS18046` (`'e' is of type 'unknown'`) em blocos `catch` que acessam `e.message`/`e.stack` sem narrowing. Anotar a lista de arquivos reportados.

- [ ] **Step 3: Corrigir os erros, um arquivo por vez (implementação mínima).**
  Padrões de correção (aplicar apenas onde o `tsc` reclamar):
  - `strictPropertyInitialization`: campos injetados por NestJS já usam `private`/`readonly` no constructor (não disparam). Para propriedades de classe declaradas sem inicializar (ex.: DTOs ou entidades), usar definite assignment `!` quando o framework garante o preenchimento (decorators), ou `?` quando opcional. Ex.: já existe `specialty!: string` em `setup-doctor.dto.ts`.
  - `useUnknownInCatchVariables`: onde houver `catch (err)` seguido de `err.stack`/`err.message`, trocar por narrowing. O `profile.service.ts:49` já faz `err instanceof Error ? err.stack : err` — manter. Onde não fizer, aplicar o mesmo padrão:
    ```ts
    } catch (e) {
      this.logger.warn('mensagem', e instanceof Error ? e.stack : String(e));
    }
    ```
  - Manter `console.log` fora de escopo aqui (tratado na Task 4).
  Fazer as edições mínimas necessárias até o `tsc` passar, **sem** introduzir `any`.

- [ ] **Step 4: Rodar type-check + suíte completa para confirmar verde.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit && npx jest --no-coverage
  ```
  Esperado: `tsc` sem saída (exit 0) e Jest `Tests: 241 passed` / `Test Suites: 42 passed`.

- [ ] **Step 5: Commit.**
  ```
  cd /root/rodrigo/hope_saude && git add apps/api/tsconfig.json $(git -C apps/api diff --name-only | sed 's#^#apps/api/#')
  git commit -m "refactor(api): ativar strict:true no tsconfig e sanar erros de inicializacao/catch"
  ```

---

### Task 2 — Eliminar `any` de produção (DTOs/tipos reais)

Tipar os pontos crus: `jwt.strategy.ts:22`, `signature.provider.ts:14`, `weekly-availability.ts` (`(item as any)`), `patient-profile.repository.ts:35,47,48` (`as any`), `profile.service.ts:29,38,57`.

**Files:**
- Create: `apps/api/src/auth/jwt-payload.ts`
- Create: `apps/api/src/profile/dto/create-doctor-profile.dto.ts`
- Modify: `apps/api/src/auth/jwt.strategy.ts`
- Modify: `apps/api/src/common/signature.provider.ts`
- Modify: `apps/api/src/availability/weekly-availability.ts`
- Modify: `apps/api/src/profile/data/patient-profile.repository.ts`
- Modify: `apps/api/src/profile/profile.service.ts`
- Test: `apps/api/src/auth/jwt.strategy.spec.ts` (já existe — estende), `apps/api/src/profile/profile.service.spec.ts` (verificar/estender)

**Steps:**

- [ ] **Step 1: Escrever os testes que falham.**
  Estender `apps/api/src/auth/jwt.strategy.spec.ts` com um caso que prova que `validate` aceita `JwtPayload` tipado e ignora claims extras:
  ```ts
  it('validate() aceita JwtPayload tipado e descarta claims extras', async () => {
    process.env = { ...OLD_ENV, JWT_SECRET: 'x' };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
      providers: [JwtStrategy],
    }).compile();
    const strategy = moduleRef.get(JwtStrategy);
    const result = await strategy.validate({
      sub: 7,
      email: 'doc@hope.com',
      role: 'PATIENT',
      iat: 1,
      exp: 2,
    });
    expect(result).toEqual({ userId: 7, email: 'doc@hope.com', role: 'PATIENT' });
  });
  ```
  Criar `apps/api/src/availability/weekly-availability.parse.spec.ts` provando que `parseAvailabilityJson` lê `id`/`date`/`recurrence` sem `any`:
  ```ts
  import { parseAvailabilityJson } from './weekly-availability';

  describe('parseAvailabilityJson (tipagem sem any)', () => {
    it('extrai id, date e recurrence de slots bem-formados', () => {
      const raw = JSON.stringify([
        { id: 5, date: '2026-06-01', start: '08:00', end: '09:00', recurrence: 'WEEKLY' },
      ]);
      const slots = parseAvailabilityJson(raw);
      expect(slots).toEqual([
        { id: 5, date: '2026-06-01', day: undefined, start: '08:00', end: '09:00', recurrence: 'WEEKLY' },
      ]);
    });

    it('ignora itens malformados', () => {
      const raw = JSON.stringify([{ foo: 'bar' }, 42, null]);
      expect(parseAvailabilityJson(raw)).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Rodar os testes para verificar que falham/passam vermelho.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/jwt.strategy.spec.ts src/availability/weekly-availability.parse.spec.ts --no-coverage
  ```
  Esperado: o teste de `weekly-availability.parse.spec.ts` passa (comportamento já existe) mas o objetivo é fixar o contrato antes do refactor; o de `jwt.strategy` passa também. Servem de rede de segurança — confirmar verde antes de mexer nos tipos. Em seguida `npx tsc --noEmit` ainda mostra os `any` (sem erro, pois `any` compila): o critério red real é grep de `any` (Step 4).

- [ ] **Step 3: Implementar os tipos (remover `any`).**
  Criar `apps/api/src/auth/jwt-payload.ts`:
  ```ts
  import type { UserRole } from './auth.types';

  /** Claims do JWT emitido por AuthService.login (passport-jwt entrega isto em validate). */
  export interface JwtPayload {
    sub: number;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
  }
  ```
  Editar `apps/api/src/auth/jwt.strategy.ts`:
  ```ts
  import { Injectable } from '@nestjs/common';
  import { ConfigService } from '@nestjs/config';
  import { PassportStrategy } from '@nestjs/passport';
  import { ExtractJwt, Strategy } from 'passport-jwt';
  import { JwtPayload } from './jwt-payload';
  import type { AuthenticatedUser } from './authenticated-request';

  @Injectable()
  export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
      const secret = configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error(
          'JWT_SECRET não está definido. Configure a variável de ambiente antes de iniciar a API.',
        );
      }
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        ignoreExpiration: false,
        secretOrKey: secret,
      });
    }

    async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
      return { userId: payload.sub, email: payload.email, role: payload.role };
    }
  }
  ```
  Editar `apps/api/src/common/signature.provider.ts` (linha 14): trocar `authData: any` por `authData: unknown`:
  ```ts
  export interface SignatureProvider {
    /**
     * Assina o conteúdo fornecido.
     * @param content O conteúdo a ser assinado.
     * @param authData Dados de autenticação necessários pelo provedor (ex: OAuth code).
     */
    sign(content: string, authData: unknown): Promise<SignatureResult>;
  }
  ```
  Editar `apps/api/src/availability/weekly-availability.ts` — substituir o bloco `out.push({...})` em `parseAvailabilityJson` (linhas 84-90) por leitura tipada via narrowing local:
  ```ts
        const obj = item as Record<string, unknown>;
        out.push({
          id: typeof obj.id === 'number' ? obj.id : undefined,
          date: typeof obj.date === 'string' ? obj.date : undefined,
          day: typeof obj.day === 'string' ? obj.day : undefined,
          start: (item as { start: string }).start,
          end: (item as { end: string }).end,
          recurrence:
            obj.recurrence === 'NONE' ||
            obj.recurrence === 'WEEKLY' ||
            obj.recurrence === 'DAILY' ||
            obj.recurrence === 'WEEKDAYS' ||
            obj.recurrence === 'BIWEEKLY'
              ? obj.recurrence
              : undefined,
        });
  ```
  Criar `apps/api/src/profile/dto/create-doctor-profile.dto.ts`:
  ```ts
  import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

  export class CreateDoctorProfileDto {
    @IsString()
    @IsNotEmpty({ message: 'A especialidade é obrigatória' })
    specialty!: string;

    @IsString()
    @IsNotEmpty({ message: 'O CRM é obrigatório' })
    crm!: string;

    @IsString()
    @IsOptional()
    availability?: string;

    @IsString()
    @IsOptional()
    bio?: string;
  }
  ```
  Editar `apps/api/src/profile/data/patient-profile.repository.ts` — importar `Prisma` e remover os `as any`:
  ```ts
  import { Injectable } from '@nestjs/common';
  import { Prisma } from '@prisma/client';
  import { PrismaService } from '../../prisma.service';
  import { CryptographyService } from '../../common/cryptography.service';
  ```
  Trocar `findByUserId` (linha 35) e `upsertByUserId` (linhas 41-49):
  ```ts
    async findByUserId(userId: number, options?: { include?: Prisma.PatientProfileInclude }) {
      const profile = await this.prisma.patientProfile.findUnique({
        where: { userId },
        ...(options?.include ? { include: options.include } : {}),
      });
      return this.decrypt(profile);
    }

    async upsertByUserId(userId: number, data: PatientProfileUpsertInput) {
      const payload: PatientProfileUpsertInput = {
        ...data,
        ...(data.cpf !== undefined ? { cpf: this.crypto.encryptNullable(data.cpf) } : {}),
      };
      const row = await this.prisma.patientProfile.upsert({
        where: { userId },
        update: payload satisfies Prisma.PatientProfileUncheckedUpdateInput,
        create: { ...payload, userId } satisfies Prisma.PatientProfileUncheckedCreateInput,
      });
      return this.decrypt(row);
    }
  ```
  Editar `apps/api/src/profile/profile.service.ts` — importar tipos e trocar as 3 assinaturas `any`:
  ```ts
  import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
  import type { AuthenticatedUser } from '../auth/authenticated-request';
  import type { PatientProfileUpsertInput } from './data/patient-profile.repository';
  ```
  ```ts
    async createDoctorProfile(userId: number, data: CreateDoctorProfileDto) {
      return this.prisma.doctorProfile.create({
        data: {
          ...data,
          userId,
        },
      });
    }

    async setupPatientProfile(user: AuthenticatedUser, data: SetupPatientDto) {
      const profile = await this.upsertPatientProfile(user.userId, data);

      const cpf = profile.cpf?.trim();
      const phone = profile.phone?.trim();
      if (cpf && phone && !profile.asaasCustomerId) {
        try {
          await this.paymentService.ensureAsaasCustomerId(
            user.userId,
            user.name ?? '',
            user.email ?? '',
            cpf,
          );
        } catch (err) {
          this.logger.warn(
            `Asaas: cliente antecipado não vinculado (user ${user.userId})`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }

      return this.getPatientProfile(user.userId);
    }

    async upsertPatientProfile(userId: number, data: PatientProfileUpsertInput) {
      // LGPD: CPF é encriptado em repouso via AES-256-GCM (DATA_ENCRYPTION_KEY).
      const payload: PatientProfileUpsertInput = {
        ...data,
        ...(data.cpf !== undefined ? { cpf: this.crypto.encryptNullable(data.cpf) } : {}),
      };
      const profile = await this.prisma.patientProfile.upsert({
        where: { userId },
        update: payload,
        create: { ...payload, userId },
      });

      return this.decryptPatientProfile(profile);
    }
  ```
  > Nota: `setupPatientProfile` passava `user.name`/`user.email` que em `AuthenticatedUser` são opcionais — o `?? ''` mantém o contrato de `ensureAsaasCustomerId(name: string, email: string, ...)`.

- [ ] **Step 4: Rodar testes + type-check + grep de `any`.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit && npx jest src/auth src/profile src/availability --no-coverage
  grep -rn ": any\|as any\| any>" src --include=*.ts | grep -v '.spec.ts'
  ```
  Esperado: `tsc` exit 0; suítes de auth/profile/availability verdes; o `grep` não retorna mais os pontos listados (`profile.service.ts`, `jwt.strategy.ts`, `signature.provider.ts`, `patient-profile.repository.ts`, `weekly-availability.ts`).

- [ ] **Step 5: Commit.**
  ```
  cd /root/rodrigo/hope_saude && git add apps/api/src/auth/jwt-payload.ts apps/api/src/auth/jwt.strategy.ts apps/api/src/auth/jwt.strategy.spec.ts apps/api/src/common/signature.provider.ts apps/api/src/availability/weekly-availability.ts apps/api/src/availability/weekly-availability.parse.spec.ts apps/api/src/profile/dto/create-doctor-profile.dto.ts apps/api/src/profile/data/patient-profile.repository.ts apps/api/src/profile/profile.service.ts
  git commit -m "refactor(api): eliminar any de producao com JwtPayload, DTOs e tipos Prisma"
  ```

---

### Task 3 — DTOs formais para endpoints clínicos inline (fecha o gap do ValidationPipe)

Hoje `clinical-scale.create`/`submitAnswers`, `medical-record.update` e os `sign()` recebem `@Body()` com objeto literal inline (não validado). Criar DTOs `class-validator` para que o `ValidationPipe` global rejeite payloads inválidos.

**Files:**
- Create: `apps/api/src/clinical-scale/dto/create-scale.dto.ts`
- Create: `apps/api/src/clinical-scale/dto/submit-answers.dto.ts`
- Create: `apps/api/src/medical-record/dto/amend-medical-record.dto.ts`
- Create: `apps/api/src/medical-record/dto/sign-document.dto.ts`
- Create: `apps/api/src/clinical-scale/dto/dto.spec.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.controller.ts`
- Modify: `apps/api/src/medical-record/medical-record.controller.ts`
- Modify: `apps/api/src/prescription/prescription.controller.ts`
- Test: `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts` (se existir; senão validação via dto.spec)

**Steps:**

- [ ] **Step 1: Escrever o teste que falha.**
  Criar `apps/api/src/clinical-scale/dto/dto.spec.ts` validando os DTOs com `class-validator` direto (mesmo padrão de testes unitários da casa):
  ```ts
  import 'reflect-metadata';
  import { plainToInstance } from 'class-transformer';
  import { validateSync } from 'class-validator';
  import { CreateScaleDto } from './create-scale.dto';
  import { SubmitAnswersDto } from './submit-answers.dto';

  describe('CreateScaleDto', () => {
    it('aceita payload válido', () => {
      const dto = plainToInstance(CreateScaleDto, {
        patientId: 2,
        type: 'PHQ9',
        notes: 'aplicar antes da consulta',
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejeita patientId não numérico e type vazio', () => {
      const dto = plainToInstance(CreateScaleDto, { patientId: 'x', type: '' });
      const errs = validateSync(dto);
      expect(errs.length).toBeGreaterThan(0);
    });
  });

  describe('SubmitAnswersDto', () => {
    it('aceita array de inteiros', () => {
      const dto = plainToInstance(SubmitAnswersDto, { answers: [0, 1, 2, 3] });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejeita answers que não é array de números', () => {
      const dto = plainToInstance(SubmitAnswersDto, { answers: 'nope' });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **Step 2: Rodar o teste para vê-lo falhar.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/clinical-scale/dto/dto.spec.ts --no-coverage
  ```
  Esperado: falha de compilação — `Cannot find module './create-scale.dto'` / `'./submit-answers.dto'`.

- [ ] **Step 3: Implementar os DTOs e fiá-los nos controllers.**
  Criar `apps/api/src/clinical-scale/dto/create-scale.dto.ts`:
  ```ts
  import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
  import type { ScaleType } from '../scales/scale-definitions';

  const SCALE_TYPES: ScaleType[] = ['PHQ9', 'GAD7', 'AUDIT', 'MOCA'];

  export class CreateScaleDto {
    @IsInt()
    patientId!: number;

    @IsIn(SCALE_TYPES)
    type!: ScaleType;

    @IsString()
    @IsOptional()
    notes?: string;
  }
  ```
  > Confirmar os literais aceitos lendo `apps/api/src/clinical-scale/scales/scale-definitions.ts` e ajustar `SCALE_TYPES` para casar exatamente com `ScaleType`.
  Criar `apps/api/src/clinical-scale/dto/submit-answers.dto.ts`:
  ```ts
  import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

  export class SubmitAnswersDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    answers!: number[];
  }
  ```
  Criar `apps/api/src/medical-record/dto/amend-medical-record.dto.ts`:
  ```ts
  import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

  export class AmendMedicalRecordDto {
    @IsString()
    @IsNotEmpty()
    content!: string;

    @IsString()
    @IsOptional()
    reason?: string;
  }
  ```
  Criar `apps/api/src/medical-record/dto/sign-document.dto.ts`:
  ```ts
  import { IsObject, IsOptional } from 'class-validator';

  /** Body opcional dos endpoints :id/sign — authData é repassado ao SignatureProvider. */
  export class SignDocumentDto {
    @IsObject()
    @IsOptional()
    authData?: Record<string, unknown>;
  }
  ```
  Editar `apps/api/src/clinical-scale/clinical-scale.controller.ts`: importar `CreateScaleDto` e `SubmitAnswersDto` e trocar os `@Body()` inline:
  ```ts
  import { CreateScaleDto } from './dto/create-scale.dto';
  import { SubmitAnswersDto } from './dto/submit-answers.dto';
  ```
  ```ts
    async create(@Request() req: AuthenticatedRequest, @Body() body: CreateScaleDto) {
      if (req.user.role !== 'DOCTOR') {
        throw new ForbiddenException('Apenas médicos podem criar escalas.');
      }
      return this.service.createScale({
        doctorId: req.user.userId,
        patientId: body.patientId,
        type: body.type,
        notes: body.notes,
      });
    }
  ```
  ```ts
    async submitAnswers(@Param('token') token: string, @Body() body: SubmitAnswersDto) {
      return this.service.submitAnswers(token, body.answers);
    }
  ```
  Editar `apps/api/src/medical-record/medical-record.controller.ts`: usar `AmendMedicalRecordDto` no `update` e `SignDocumentDto` no `sign`:
  ```ts
  import { AmendMedicalRecordDto } from './dto/amend-medical-record.dto';
  import { SignDocumentDto } from './dto/sign-document.dto';
  ```
  ```ts
    async update(
      @Request() req: AuthenticatedRequest,
      @Param('id') id: string,
      @Body() body: AmendMedicalRecordDto,
    ) {
      if (req.user.role !== 'DOCTOR') {
        throw new ForbiddenException('Apenas médicos podem atualizar prontuários');
      }
      return this.service.update(req.user.userId, parseInt(id, 10), body.content, body.reason);
    }

    async sign(
      @Request() req: AuthenticatedRequest,
      @Param('id') id: string,
      @Body() body?: SignDocumentDto,
    ) {
      if (req.user.role !== 'DOCTOR') {
        throw new ForbiddenException('Apenas médicos podem assinar prontuários');
      }
      return this.service.sign(req.user.userId, parseInt(id, 10), body?.authData);
    }
  ```
  Editar `apps/api/src/prescription/prescription.controller.ts`: usar `SignDocumentDto` no `sign`:
  ```ts
  import { SignDocumentDto } from '../medical-record/dto/sign-document.dto';
  ```
  ```ts
    async sign(
      @Request() req: AuthenticatedRequest,
      @Param('id') id: string,
      @Body() body?: SignDocumentDto,
    ) {
      if (req.user.role !== 'DOCTOR') {
        throw new ForbiddenException('Apenas médicos podem assinar receitas');
      }
      return this.service.sign(req.user.userId, parseInt(id, 10), body?.authData);
    }
  ```

- [ ] **Step 4: Rodar os testes para confirmar verde.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit && npx jest src/clinical-scale src/medical-record src/prescription --no-coverage
  ```
  Esperado: `tsc` exit 0; `dto.spec.ts` verde; specs de controller de medical-record/prescription continuam verdes (assinaturas compatíveis — os mocks passam `body` literal que satisfaz o DTO em runtime).

- [ ] **Step 5: Commit.**
  ```
  cd /root/rodrigo/hope_saude && git add apps/api/src/clinical-scale/dto apps/api/src/medical-record/dto apps/api/src/clinical-scale/clinical-scale.controller.ts apps/api/src/medical-record/medical-record.controller.ts apps/api/src/prescription/prescription.controller.ts
  git commit -m "feat(api): DTOs class-validator para endpoints clinicos (scale/amend/sign)"
  ```

---

### Task 4 — RBAC unificado: `@Roles + RolesGuard` e `OwnerOrDoctorGuard` reutilizável

Hoje há ~25 checagens inline de `req.user.role` espalhadas. Centralizar: (a) endpoints exclusivos de médico usam `@Roles('DOCTOR') + RolesGuard`; (b) endpoints `GET .../patient/:patientId` (médico vê tudo, paciente só o próprio) usam um `OwnerOrDoctorGuard`. Também limpar o `console.log` do `RolesGuard`.

**Files:**
- Create: `apps/api/src/auth/owner-or-doctor.guard.ts`
- Create: `apps/api/src/auth/owner-or-doctor.guard.spec.ts`
- Modify: `apps/api/src/auth/roles.guard.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.controller.ts`
- Modify: `apps/api/src/medical-record/medical-record.controller.ts`
- Modify: `apps/api/src/prescription/prescription.controller.ts`
- Modify: `apps/api/src/profile/profile.controller.ts`
- Test: `apps/api/src/auth/roles.guard.spec.ts` (já existe)

**Steps:**

- [ ] **Step 1: Escrever o teste que falha (guard novo).**
  Criar `apps/api/src/auth/owner-or-doctor.guard.spec.ts`:
  ```ts
  import { ForbiddenException, ExecutionContext } from '@nestjs/common';
  import { OwnerOrDoctorGuard } from './owner-or-doctor.guard';

  function ctx(role: string, userId: number, patientId: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role, userId }, params: { patientId } }),
      }),
    } as unknown as ExecutionContext;
  }

  describe('OwnerOrDoctorGuard', () => {
    const guard = new OwnerOrDoctorGuard();

    it('DOCTOR sempre passa', () => {
      expect(guard.canActivate(ctx('DOCTOR', 1, '999'))).toBe(true);
    });

    it('PATIENT passa quando :patientId é o próprio', () => {
      expect(guard.canActivate(ctx('PATIENT', 2, '2'))).toBe(true);
    });

    it('PATIENT é bloqueado em :patientId de outro', () => {
      expect(() => guard.canActivate(ctx('PATIENT', 2, '3'))).toThrow(ForbiddenException);
    });

    it('papel desconhecido é bloqueado', () => {
      expect(() => guard.canActivate(ctx('NURSE', 5, '5'))).toThrow(ForbiddenException);
    });
  });
  ```
  Estender `apps/api/src/auth/roles.guard.spec.ts` com um caso garantindo que o guard não emite log (regressão do `console.log`):
  ```ts
  it('não emite console.log ao avaliar', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['DOCTOR']);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'DOCTOR' } }) }),
    } as unknown as ExecutionContext;
    guard.canActivate(context);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  ```

- [ ] **Step 2: Rodar os testes para vê-los falhar.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/auth/owner-or-doctor.guard.spec.ts src/auth/roles.guard.spec.ts --no-coverage
  ```
  Esperado: `owner-or-doctor.guard.spec.ts` falha com `Cannot find module './owner-or-doctor.guard'`; o novo caso de `roles.guard.spec.ts` falha porque `console.log` é chamado.

- [ ] **Step 3: Implementar o guard e limpar o RolesGuard.**
  Criar `apps/api/src/auth/owner-or-doctor.guard.ts`:
  ```ts
  import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
  import type { AuthenticatedRequest } from './authenticated-request';

  /**
   * Autoriza GET por paciente: DOCTOR acessa qualquer paciente; PATIENT só
   * o próprio (req.params.patientId === req.user.userId). Substitui as
   * checagens inline duplicadas nos controllers clínicos.
   */
  @Injectable()
  export class OwnerOrDoctorGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const role = req.user?.role;
      if (role === 'DOCTOR') {
        return true;
      }
      if (role === 'PATIENT') {
        const target = parseInt(req.params.patientId, 10);
        if (req.user.userId === target) {
          return true;
        }
        throw new ForbiddenException('Você só pode acessar seus próprios dados.');
      }
      throw new ForbiddenException('Acesso negado.');
    }
  }
  ```
  Editar `apps/api/src/auth/roles.guard.ts` (remover `console.log`, tipar request):
  ```ts
  import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import type { AuthenticatedRequest } from './authenticated-request';

  @Injectable()
  export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
      const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!requiredRoles) {
        return true;
      }
      const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
      return requiredRoles.some((role) => user?.role === role);
    }
  }
  ```
  Editar `apps/api/src/clinical-scale/clinical-scale.controller.ts`: aplicar guards e remover as checagens inline. Imports:
  ```ts
  import { RolesGuard } from '../auth/roles.guard';
  import { Roles } from '../auth/roles.decorator';
  import { OwnerOrDoctorGuard } from '../auth/owner-or-doctor.guard';
  ```
  Endpoint `create` (médico-only):
  ```ts
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('DOCTOR')
    @Post()
    async create(@Request() req: AuthenticatedRequest, @Body() body: CreateScaleDto) {
      return this.service.createScale({
        doctorId: req.user.userId,
        patientId: body.patientId,
        type: body.type,
        notes: body.notes,
      });
    }
  ```
  Endpoint `listByPatient` (OwnerOrDoctor):
  ```ts
    @UseGuards(AuthGuard('jwt'), OwnerOrDoctorGuard)
    @Get('patient/:patientId')
    async listByPatient(
      @Request() req: AuthenticatedRequest,
      @Param('patientId') patientIdParam: string,
    ) {
      const patientId = parseInt(patientIdParam, 10);
      const doctorFilter = req.user.role === 'DOCTOR' ? req.user.userId : undefined;
      return this.service.findAllByPatient(patientId, doctorFilter);
    }
  ```
  Endpoint `findOne` (médico-only):
  ```ts
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('DOCTOR')
    @Get(':id')
    async findOne(@Request() req: AuthenticatedRequest, @Param('id') idParam: string) {
      return this.service.findOneForDoctor(req.user.userId, parseInt(idParam, 10));
    }
  ```
  Editar `apps/api/src/medical-record/medical-record.controller.ts`: o `@UseGuards(AuthGuard('jwt'))` fica no nível de classe. Anotar `create`/`update`/`sign` com `@UseGuards(RolesGuard) @Roles('DOCTOR')` e `findAllByPatient` com `@UseGuards(OwnerOrDoctorGuard)`, removendo os `if (req.user.role ...)`. Imports:
  ```ts
  import { UseGuards } from '@nestjs/common'; // já importado
  import { RolesGuard } from '../auth/roles.guard';
  import { Roles } from '../auth/roles.decorator';
  import { OwnerOrDoctorGuard } from '../auth/owner-or-doctor.guard';
  ```
  ```ts
    @Post()
    @UseGuards(RolesGuard)
    @Roles('DOCTOR')
    async create(@Request() req: AuthenticatedRequest, @Body() body: CreateMedicalRecordDto) {
      return this.service.create({ doctorId: req.user.userId, ...body });
    }

    @Get('patient/:patientId')
    @UseGuards(OwnerOrDoctorGuard)
    async findAllByPatient(
      @Request() req: AuthenticatedRequest,
      @Param('patientId') patientId: string,
      @Query('search') search?: string,
    ) {
      return this.service.findAllByPatient(
        req.user.role === 'DOCTOR' ? req.user.userId : undefined,
        parseInt(patientId, 10),
        search,
      );
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('DOCTOR')
    async update(
      @Request() req: AuthenticatedRequest,
      @Param('id') id: string,
      @Body() body: AmendMedicalRecordDto,
    ) {
      return this.service.update(req.user.userId, parseInt(id, 10), body.content, body.reason);
    }

    @Post(':id/sign')
    @UseGuards(RolesGuard)
    @Roles('DOCTOR')
    async sign(
      @Request() req: AuthenticatedRequest,
      @Param('id') id: string,
      @Body() body?: SignDocumentDto,
    ) {
      return this.service.sign(req.user.userId, parseInt(id, 10), body?.authData);
    }
  ```
  > Nota: o `create` referencia `CreateMedicalRecordDto`. Se ainda não existir, criar `apps/api/src/medical-record/dto/create-medical-record.dto.ts` espelhando o body atual (`patientId:number`, `appointmentId?:number`, `content:string`, `type?:string`, `template?:'FREE'|'SOAP'`) com `class-validator`, e adicionar à lista de Files. Caso o time prefira manter o `create` com o literal já existente nesta Task, manter a assinatura `@Body() body: {...}` inline original — o ponto desta Task é a remoção do `if` de RBAC, não o DTO do create (que pode ficar para a Task 3 estendida).
  Editar `apps/api/src/prescription/prescription.controller.ts` da mesma forma: `create`/`update`/`sign` com `@UseGuards(RolesGuard) @Roles('DOCTOR')`, `findAllByPatient` com `@UseGuards(OwnerOrDoctorGuard)`, removendo os `if`. Imports iguais aos acima.
  Editar `apps/api/src/profile/profile.controller.ts`: nos endpoints exclusivos de médico (ex.: criar/editar/excluir `consultationModel`, `updateAvailability`, `createDoctorProfile`) aplicar `@UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('DOCTOR')`. Ler o controller antes para casar os nomes exatos dos métodos e não duplicar `@UseGuards` já presentes.

- [ ] **Step 4: Atualizar os specs de controller afetados e rodar verde.**
  Os specs de `medical-record.controller.spec.ts` / `prescription.controller.spec.ts` testam os `if` inline (ex.: `controller.create(patientReq)` espera `ForbiddenException`). Com o RBAC movido para guards, esses casos deixam de fazer sentido no teste unitário do controller (o guard é exercido no e2e). Atualizar esses specs: remover os asserts de `ForbiddenException` que dependiam do `if` removido e manter os asserts de delegação ao service. O RBAC end-to-end fica coberto por `apps/api/test/auth-rbac.e2e-spec.ts`.
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit && npx jest src/auth src/medical-record src/prescription src/clinical-scale src/profile --no-coverage
  npx jest test/auth-rbac.e2e-spec.ts --no-coverage
  ```
  Esperado: todas verdes; `auth-rbac.e2e-spec.ts` continua passando (o RBAC agora vem dos guards, não dos `if`).

- [ ] **Step 5: Commit.**
  ```
  cd /root/rodrigo/hope_saude && git add apps/api/src/auth/owner-or-doctor.guard.ts apps/api/src/auth/owner-or-doctor.guard.spec.ts apps/api/src/auth/roles.guard.ts apps/api/src/auth/roles.guard.spec.ts apps/api/src/clinical-scale/clinical-scale.controller.ts apps/api/src/medical-record/medical-record.controller.ts apps/api/src/medical-record/medical-record.controller.spec.ts apps/api/src/prescription/prescription.controller.ts apps/api/src/prescription/prescription.controller.spec.ts apps/api/src/profile/profile.controller.ts
  git commit -m "refactor(api): RBAC unificado com RolesGuard + OwnerOrDoctorGuard (remove ifs inline e console.log)"
  ```

---

### Task 5 — Domínio → HttpException (reserva `Error` para invariantes de bootstrap)

`payment.service.ts:31` lança `new Error('Perfil de paciente não encontrado')` para um caso de domínio (vira 500 sem o filtro mapear). Trocar por `NotFoundException`. Em `video.service.ts:15` o `throw new Error('LIVEKIT...')` é invariante de bootstrap (config ausente) — manter, mas documentar a distinção.

**Files:**
- Modify: `apps/api/src/payment/payment.service.ts`
- Modify: `apps/api/src/video/video.service.ts` (comentário de invariante)
- Test: `apps/api/src/payment/payment.service.spec.ts` (já existe — estender)

**Steps:**

- [ ] **Step 1: Escrever o teste que falha.**
  Estender `apps/api/src/payment/payment.service.spec.ts` (ler o arquivo para reaproveitar os mocks já montados de `PatientProfileRepository`, `AsaasService`, etc.) com:
  ```ts
  import { NotFoundException } from '@nestjs/common';

  it('ensureAsaasCustomerId lança NotFoundException (não Error cru) quando perfil não existe', async () => {
    patientProfileRepo.findByUserId.mockResolvedValue(null);
    await expect(
      service.ensureAsaasCustomerId(1, 'Fulano', 'f@e.com', '12345678901'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  ```
  > Ajustar o nome do mock (`patientProfileRepo`) ao que o spec existente usa.

- [ ] **Step 2: Rodar o teste para vê-lo falhar.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/payment/payment.service.spec.ts --no-coverage
  ```
  Esperado: falha — o serviço lança `Error` genérico, não `NotFoundException` (`expect(...).rejects.toBeInstanceOf(NotFoundException)` falha).

- [ ] **Step 3: Implementar a troca.**
  Editar `apps/api/src/payment/payment.service.ts` (já importa `NotFoundException` na linha 1) — trocar linha 31:
  ```ts
      const profile = await this.patientProfileRepo.findByUserId(userId);
      if (!profile) {
        throw new NotFoundException('Perfil de paciente não encontrado');
      }
  ```
  Editar `apps/api/src/video/video.service.ts` — adicionar comentário acima do `throw` (invariante de bootstrap, intencionalmente `Error`):
  ```ts
      // Invariante de bootstrap: ausência de credenciais LiveKit é erro de
      // configuração do servidor (500), não condição de domínio — Error é correto.
      if (!apiKey || !apiSecret) {
        throw new Error('LIVEKIT_API_KEY e LIVEKIT_API_SECRET devem estar configurados');
      }
  ```

- [ ] **Step 4: Rodar os testes para confirmar verde.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit && npx jest src/payment src/video --no-coverage
  ```
  Esperado: `tsc` exit 0; suítes de payment e video verdes; o novo caso passa.

- [ ] **Step 5: Commit.**
  ```
  cd /root/rodrigo/hope_saude && git add apps/api/src/payment/payment.service.ts apps/api/src/payment/payment.service.spec.ts apps/api/src/video/video.service.ts
  git commit -m "refactor(api): erro de dominio em payment vira NotFoundException; documenta invariante do video"
  ```

---

### Task 6 — Auditoria de assinatura em `MedicalRecordService.sign()` (mesma transação)

Hoje `sign()` faz um `update` solto sem registrar quem/quando/hash em tabela de auditoria de assinatura (o `MedicalRecordAudit` só guarda versões de conteúdo no `update`). Adicionar model `MedicalRecordSignatureAudit` e gravá-lo na **mesma** `$transaction` do `update` de assinatura.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_medical_record_signature_audit/migration.sql`
- Modify: `apps/api/src/medical-record/medical-record.service.ts`
- Test: `apps/api/src/medical-record/medical-record.service.spec.ts` (já existe — estender)

**Steps:**

- [ ] **Step 1: Escrever o teste que falha.**
  Estender `apps/api/src/medical-record/medical-record.service.spec.ts`. Adicionar `medicalRecordSignatureAudit: { create: jest.fn() }` ao `mockPrisma` e um caso provando a gravação na transação:
  ```ts
  it('sign() grava MedicalRecordSignatureAudit (quem/quando/hash) na mesma transação', async () => {
    const doctorId = 1;
    const recordId = 1;
    mockPrisma.medicalRecord.findUnique.mockResolvedValue({
      id: recordId,
      doctorId,
      status: 'DRAFT',
      content: 'ENC(documento)',
    });
    mockSignatureProvider.sign.mockResolvedValue({
      signature: 'cms-sig',
      hash: 'sha256-hash',
      signatureDate: new Date('2026-05-31T12:00:00Z'),
    });
    mockPrisma.medicalRecord.update.mockResolvedValue({ id: recordId, status: 'SIGNED' });

    await service.sign(doctorId, recordId, { code: 'otp' });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.medicalRecordSignatureAudit.create).toHaveBeenCalledWith({
      data: {
        medicalRecordId: recordId,
        signedByUserId: doctorId,
        signedHash: 'sha256-hash',
        signatureDate: new Date('2026-05-31T12:00:00Z'),
      },
    });
    expect(mockPrisma.medicalRecord.update).toHaveBeenCalledWith({
      where: { id: recordId },
      data: expect.objectContaining({ status: 'SIGNED', signedHash: 'sha256-hash' }),
    });
  });
  ```
  > O `$transaction` mock já existe no spec (`mockImplementation((callback) => callback(mockPrisma))`).

- [ ] **Step 2: Rodar o teste para vê-lo falhar.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx jest src/medical-record/medical-record.service.spec.ts -t "MedicalRecordSignatureAudit" --no-coverage
  ```
  Esperado: falha — `mockPrisma.medicalRecordSignatureAudit` é `undefined` (model não existe) e `sign()` não chama `$transaction`.

- [ ] **Step 3: Implementar schema, migration e serviço.**
  Editar `apps/api/prisma/schema.prisma` — adicionar o model após `MedicalRecordAudit` (linha 129) e a relação inversa em `MedicalRecord` (após `audits` na linha 113):
  ```prisma
  model MedicalRecord {
    // ... campos existentes ...
    audits           MedicalRecordAudit[]
    signatureAudits  MedicalRecordSignatureAudit[]

    @@index([patientId, createdAt])
    @@index([doctorId, patientId])
  }

  model MedicalRecordSignatureAudit {
    id              Int           @id @default(autoincrement())
    medicalRecordId Int
    medicalRecord   MedicalRecord @relation(fields: [medicalRecordId], references: [id], onDelete: Cascade)
    signedByUserId  Int
    signedHash      String
    signatureDate   DateTime
    createdAt       DateTime      @default(now())

    @@index([medicalRecordId])
  }
  ```
  Gerar a migration (cria pasta com timestamp e atualiza o client). Como o provider é SQLite com `url = "file:./dev.db"`:
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name medical_record_signature_audit
  ```
  Isso escreve `prisma/migrations/<timestamp>_medical_record_signature_audit/migration.sql` (DDL `CREATE TABLE "MedicalRecordSignatureAudit" ...`) e regenera `@prisma/client`. Conferir o SQL gerado.
  Editar `apps/api/src/medical-record/medical-record.service.ts` — `sign()` (linhas 182-205) passa a usar `$transaction`:
  ```ts
    async sign(doctorId: number, recordId: number, authData?: unknown) {
      const record = await this.findOne(doctorId, recordId);

      if (record.status === 'SIGNED') {
        return record;
      }

      // record.content já está DECRIPTADO (findOne fez isso) — fluxo correto
      // para alimentar o provedor de assinatura digital.
      const result = await this.signatureProvider.sign(record.content, authData);

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.medicalRecordSignatureAudit.create({
          data: {
            medicalRecordId: recordId,
            signedByUserId: doctorId,
            signedHash: result.hash,
            signatureDate: result.signatureDate,
          },
        });

        return tx.medicalRecord.update({
          where: { id: recordId },
          data: {
            status: 'SIGNED',
            signature: result.signature,
            signatureDate: result.signatureDate,
            signedHash: result.hash,
            signerUserId: doctorId,
          },
        });
      });

      return this.decryptOne(updated);
    }
  ```
  > Avaliação para Prescription: o `Prescription.sign()` segue o mesmo padrão e merece auditoria equivalente. Fica registrado como follow-up — criar `PrescriptionSignatureAudit` espelhando este model numa Task futura (mesma estrutura: `prescriptionId`, `signedByUserId`, `signedHash`, `signatureDate`). Não implementar agora para manter o escopo desta Task fechado e a suíte verde.

- [ ] **Step 4: Rodar os testes para confirmar verde.**
  ```
  cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit && npx jest src/medical-record/medical-record.service.spec.ts --no-coverage
  npx jest --no-coverage
  ```
  Esperado: `tsc` exit 0; spec de medical-record verde (incl. o caso novo); suíte completa `Tests: 247+ passed` (241 originais + novos), `Test Suites` todas verdes.

- [ ] **Step 5: Commit.**
  ```
  cd /root/rodrigo/hope_saude && git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/medical-record/medical-record.service.ts apps/api/src/medical-record/medical-record.service.spec.ts
  git commit -m "feat(api): auditoria de assinatura (quem/quando/hash) gravada na transacao do sign()"
  ```

---

## Self-Review

**Cobertura dos gaps do escopo:**

1. **`strict: true` no tsconfig** — Task 1: adiciona `"strict": true`, usa `tsc --noEmit` como red→green, corrige `strictPropertyInitialization`/`useUnknownInCatchVariables` por arquivo, valida suíte completa verde.
2. **Eliminar `any` de produção** — Task 2: `jwt.strategy.ts:22` → `JwtPayload` (novo arquivo); `signature.provider.ts:14` → `unknown`; `patient-profile.repository.ts` (linhas 35/47/48) → `Prisma.PatientProfile*Input` via `satisfies`; `profile.service.ts:29/38/57` → `CreateDoctorProfileDto`/`AuthenticatedUser`/`PatientProfileUpsertInput`; `weekly-availability.ts` → narrowing local sem `(item as any)`. Step 4 inclui `grep` provando ausência dos pontos.
3. **DTOs formais (ValidationPipe)** — Task 3: `CreateScaleDto`, `SubmitAnswersDto`, `AmendMedicalRecordDto`, `SignDocumentDto` com `class-validator`, fiados nos controllers de clinical-scale/medical-record/prescription.
4. **RBAC unificado** — Task 4: `@Roles('DOCTOR') + RolesGuard` nos endpoints médico-only; `OwnerOrDoctorGuard` reutilizável extrai a regra PATIENT-só-o-próprio; remove os `if (req.user.role ...)` inline dos 4 controllers e o `console.log` do `RolesGuard`; e2e `auth-rbac` cobre o comportamento.
5. **Domínio → HttpException** — Task 5: `payment.service.ts:31` `Error` → `NotFoundException`; `video.service.ts:15` permanece `Error` por ser invariante de bootstrap (documentado), conforme a regra "reservar Error para invariantes".
6. **Auditoria na assinatura** — Task 6: model `MedicalRecordSignatureAudit` + migration; `sign()` grava quem/quando/hash na mesma `$transaction` do `update`; avaliação de auditoria para Prescription registrada como follow-up explícito.

**Ausência de placeholders:** todos os passos de código trazem blocos reais e completos (imports corretos, DI token `'SignatureProvider'`, shape de `req.user`, métodos reais do Prisma e do `CryptographyService`). Tipos referenciados (`JwtPayload`, `CreateDoctorProfileDto`, DTOs de scale/amend/sign, `OwnerOrDoctorGuard`, `MedicalRecordSignatureAudit`) são definidos dentro das Tasks. Comandos de teste usam o caminho correto `/root/rodrigo/hope_saude/apps/api` e o invocador padrão `npx jest <arquivo> --no-coverage`. Nenhum "TODO"/"implementar depois"/"similar à Task N" — as duas notas de follow-up (DTO de create de medical-record na Task 4; `PrescriptionSignatureAudit` na Task 6) são decisões de escopo conscientes, com a estrutura já descrita, não lacunas.

**Pontos que exigem atenção do executor (verificar in loco antes de editar):** (a) os literais exatos de `ScaleType` em `scales/scale-definitions.ts` para o `@IsIn` do `CreateScaleDto`; (b) nomes reais dos métodos/guards já presentes em `profile.controller.ts`; (c) nome do mock de repositório no `payment.service.spec.ts`. Cada um está sinalizado na Task correspondente.
