# Hope Saude — Features Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 features: (A) Dashboard de metricas do paciente, (B) Atestados/declaracoes medicas em PDF, (C) Swagger completo, (D) Reagendamento/cancelamento, (E) Historico de pagamentos e recibos.

**Architecture:** Each feature follows the existing NestJS module pattern (Controller + Service + DTO + spec files) with TDD. Frontend uses Next.js App Router `'use client'` pages + TanStack Query hooks. All new endpoints follow existing RBAC/JWT patterns.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite), Next.js 15, React 19, TanStack Query 5, Tailwind CSS 3, PDFKit (new), Recharts (new), class-validator, Jest.

---

## Feature A: Dashboard de Metricas do Paciente

### Escopo
Endpoint que retorna escalas clinicas completadas de um paciente agrupadas por tipo, com score e data. Frontend exibe graficos de evolucao longitudinal (linha do tempo) usando Recharts.

### File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/src/clinical-scale/clinical-scale.service.ts` | Add `getEvolution()` method |
| Modify | `apps/api/src/clinical-scale/clinical-scale.service.spec.ts` | Tests for `getEvolution()` |
| Modify | `apps/api/src/clinical-scale/clinical-scale.controller.ts` | Add `GET /clinical-scales/patient/:patientId/evolution` |
| Modify | `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts` | Controller tests |
| Create | `apps/web/src/lib/query/use-clinical-scales.ts` | TanStack Query hook |
| Modify | `apps/web/src/lib/query/query-keys.ts` | Add `clinicalScales` keys |
| Create | `apps/web/src/components/clinical-scales/ScaleEvolutionChart.tsx` | Recharts line chart component |
| Create | `apps/web/src/app/dashboard/patient/escalas/page.tsx` | Patient scales dashboard page |

---

### Task A1: Instalar Recharts no frontend

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar recharts**

```bash
cd /root/rodrigo/hope_saude/apps/web && npm install recharts
```

- [ ] **Step 2: Verificar instalacao**

```bash
cd /root/rodrigo/hope_saude/apps/web && node -e "require('recharts'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add recharts for clinical scale charts"
```

---

### Task A2: Endpoint de evolucao das escalas — Service (TDD)

**Files:**
- Modify: `apps/api/src/clinical-scale/clinical-scale.service.spec.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.service.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/clinical-scale/clinical-scale.service.spec.ts`, inside the existing `describe('ClinicalScaleService')`:

```typescript
describe('getEvolution', () => {
  it('deve retornar escalas COMPLETED agrupadas por tipo', async () => {
    const patientId = 2;
    const doctorId = 1;

    const scales = [
      {
        id: 1,
        patientId,
        doctorId,
        type: 'PHQ9',
        status: 'COMPLETED',
        totalScore: 12,
        severity: 'moderada',
        completedAt: new Date('2026-03-01'),
        createdAt: new Date('2026-02-28'),
      },
      {
        id: 2,
        patientId,
        doctorId,
        type: 'PHQ9',
        status: 'COMPLETED',
        totalScore: 8,
        severity: 'leve',
        completedAt: new Date('2026-04-01'),
        createdAt: new Date('2026-03-30'),
      },
      {
        id: 3,
        patientId,
        doctorId,
        type: 'GAD7',
        status: 'COMPLETED',
        totalScore: 15,
        severity: 'grave',
        completedAt: new Date('2026-03-15'),
        createdAt: new Date('2026-03-14'),
      },
    ];

    mockPrisma.clinicalScale.findMany.mockResolvedValue(scales);

    const result = await service.getEvolution(patientId, doctorId);

    expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith({
      where: { patientId, doctorId, status: 'COMPLETED' },
      orderBy: { completedAt: 'asc' },
      select: {
        id: true,
        type: true,
        totalScore: true,
        severity: true,
        completedAt: true,
      },
    });

    expect(result).toEqual({
      PHQ9: [
        { id: 1, type: 'PHQ9', totalScore: 12, severity: 'moderada', completedAt: new Date('2026-03-01') },
        { id: 2, type: 'PHQ9', totalScore: 8, severity: 'leve', completedAt: new Date('2026-04-01') },
      ],
      GAD7: [
        { id: 3, type: 'GAD7', totalScore: 15, severity: 'grave', completedAt: new Date('2026-03-15') },
      ],
    });
  });

  it('deve retornar objeto vazio se nao houver escalas completadas', async () => {
    mockPrisma.clinicalScale.findMany.mockResolvedValue([]);

    const result = await service.getEvolution(2, 1);

    expect(result).toEqual({});
  });
});
```

Note: the existing spec already has `mockPrisma` with `clinicalScale` mock. Add `findMany: jest.fn()` to the `clinicalScale` mock object if not already present.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.service.spec --no-coverage -t "getEvolution"
```
Expected: FAIL — `service.getEvolution is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `apps/api/src/clinical-scale/clinical-scale.service.ts`, inside the `ClinicalScaleService` class:

```typescript
/** Retorna escalas completadas agrupadas por tipo para graficos de evolucao. */
async getEvolution(patientId: number, doctorId: number) {
  const scales = await this.prisma.clinicalScale.findMany({
    where: { patientId, doctorId, status: 'COMPLETED' },
    orderBy: { completedAt: 'asc' },
    select: {
      id: true,
      type: true,
      totalScore: true,
      severity: true,
      completedAt: true,
    },
  });

  const grouped: Record<string, typeof scales> = {};
  for (const scale of scales) {
    if (!grouped[scale.type]) grouped[scale.type] = [];
    grouped[scale.type].push(scale);
  }
  return grouped;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.service.spec --no-coverage -t "getEvolution"
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/clinical-scale/clinical-scale.service.ts apps/api/src/clinical-scale/clinical-scale.service.spec.ts
git commit -m "feat(api): ClinicalScaleService.getEvolution — escalas agrupadas por tipo"
```

---

### Task A3: Endpoint de evolucao — Controller (TDD)

**Files:**
- Modify: `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.controller.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts`:

```typescript
describe('getEvolution', () => {
  it('deve chamar service.getEvolution para medico', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } } as any;
    const mockResult = { PHQ9: [{ id: 1, totalScore: 12 }] };
    mockService.getEvolution = jest.fn().mockResolvedValue(mockResult);

    const result = await controller.getEvolution(req, '2');

    expect(mockService.getEvolution).toHaveBeenCalledWith(2, 1);
    expect(result).toEqual(mockResult);
  });

  it('deve rejeitar acesso de paciente a evolucao de outro paciente', async () => {
    const req = { user: { userId: 3, role: 'PATIENT' } } as any;

    await expect(controller.getEvolution(req, '2')).rejects.toThrow(ForbiddenException);
  });

  it('deve permitir paciente ver sua propria evolucao', async () => {
    const req = { user: { userId: 2, role: 'PATIENT' } } as any;
    mockService.getEvolution = jest.fn().mockResolvedValue({});

    await controller.getEvolution(req, '2');

    expect(mockService.getEvolution).toHaveBeenCalledWith(2, undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.controller.spec --no-coverage -t "getEvolution"
```
Expected: FAIL — `controller.getEvolution is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `apps/api/src/clinical-scale/clinical-scale.controller.ts`, inside the class, in the authenticated section (before the public endpoints):

```typescript
@ApiBearerAuth('JWT')
@ApiOperation({ summary: 'Evolucao longitudinal das escalas de um paciente (agrupadas por tipo)' })
@UseGuards(AuthGuard('jwt'))
@Get('patient/:patientId/evolution')
async getEvolution(
  @Request() req: AuthenticatedRequest,
  @Param('patientId') patientIdParam: string,
) {
  const patientId = parseInt(patientIdParam, 10);
  if (req.user.role === 'PATIENT' && req.user.userId !== patientId) {
    throw new ForbiddenException('Voce so pode ver suas proprias escalas.');
  }
  const doctorId = req.user.role === 'DOCTOR' ? req.user.userId : undefined;
  return this.service.getEvolution(patientId, doctorId);
}
```

**IMPORTANT:** This route MUST be placed BEFORE the existing `@Get(':id')` route in the controller, otherwise `:id` will match `patient` as a parameter.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.controller.spec --no-coverage -t "getEvolution"
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/clinical-scale/clinical-scale.controller.ts apps/api/src/clinical-scale/clinical-scale.controller.spec.ts
git commit -m "feat(api): GET /clinical-scales/patient/:id/evolution"
```

---

### Task A4: Query keys e hook para evolucao

**Files:**
- Modify: `apps/web/src/lib/query/query-keys.ts`
- Create: `apps/web/src/lib/query/use-clinical-scales.ts`

- [ ] **Step 1: Adicionar query keys**

In `apps/web/src/lib/query/query-keys.ts`, add inside the `queryKeys` object, after `prescriptions`:

```typescript
clinicalScales: {
  evolution: (patientId: number) => ['clinical-scales', 'evolution', patientId] as const,
},
```

- [ ] **Step 2: Criar hook**

Create `apps/web/src/lib/query/use-clinical-scales.ts`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api-client';
import { queryKeys } from './query-keys';

export interface ScaleDataPoint {
  id: number;
  type: string;
  totalScore: number;
  severity: string;
  completedAt: string;
}

export type ScaleEvolutionData = Record<string, ScaleDataPoint[]>;

export function useScaleEvolution(patientId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.clinicalScales.evolution(patientId!),
    queryFn: () => api.get<ScaleEvolutionData>(`/clinical-scales/patient/${patientId}/evolution`),
    enabled: patientId !== undefined,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/query/query-keys.ts apps/web/src/lib/query/use-clinical-scales.ts
git commit -m "feat(web): useScaleEvolution hook + query keys"
```

---

### Task A5: Componente ScaleEvolutionChart

**Files:**
- Create: `apps/web/src/components/clinical-scales/ScaleEvolutionChart.tsx`

- [ ] **Step 1: Criar componente**

Create `apps/web/src/components/clinical-scales/ScaleEvolutionChart.tsx`:

```tsx
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ScaleDataPoint } from '../../lib/query/use-clinical-scales';

interface Props {
  scaleType: string;
  dataPoints: ScaleDataPoint[];
}

const SCALE_CONFIG: Record<string, { label: string; maxScore: number; color: string }> = {
  PHQ9: { label: 'PHQ-9 (Depressao)', maxScore: 27, color: '#0284c7' },
  GAD7: { label: 'GAD-7 (Ansiedade)', maxScore: 21, color: '#059669' },
  AUDIT: { label: 'AUDIT (Alcool)', maxScore: 40, color: '#d97706' },
  MOCA: { label: 'MoCA (Cognitivo)', maxScore: 30, color: '#7c3aed' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function ScaleEvolutionChart({ scaleType, dataPoints }: Props) {
  const config = SCALE_CONFIG[scaleType] ?? {
    label: scaleType,
    maxScore: Math.max(...dataPoints.map((d) => d.totalScore), 30),
    color: '#64748b',
  };

  const chartData = dataPoints.map((dp) => ({
    date: formatDate(dp.completedAt),
    score: dp.totalScore,
    severity: dp.severity,
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-400">
        Nenhuma escala {config.label} completada ainda.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-700">{config.label}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, config.maxScore]} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number, _name: string, props: { payload: { severity: string } }) => [
              `${value} — ${props.payload.severity}`,
              'Score',
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke={config.color}
            strokeWidth={2}
            dot={{ r: 5, fill: config.color }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-400">
        {dataPoints.length} avaliacao(oes) — ultimo score: {dataPoints[dataPoints.length - 1].totalScore} ({dataPoints[dataPoints.length - 1].severity})
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/clinical-scales/ScaleEvolutionChart.tsx
git commit -m "feat(web): ScaleEvolutionChart component with Recharts"
```

---

### Task A6: Pagina do dashboard de escalas do paciente

**Files:**
- Create: `apps/web/src/app/dashboard/patient/escalas/page.tsx`

- [ ] **Step 1: Criar pagina**

Create `apps/web/src/app/dashboard/patient/escalas/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useScaleEvolution } from '../../../../lib/query/use-clinical-scales';
import { ScaleEvolutionChart } from '../../../../components/clinical-scales/ScaleEvolutionChart';

function getUserIdFromToken(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const token = localStorage.getItem('token');
  if (!token) return undefined;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    return undefined;
  }
}

export default function EscalasPage() {
  const [userId, setUserId] = useState<number | undefined>(undefined);

  useEffect(() => {
    setUserId(getUserIdFromToken());
  }, []);

  const { data, isLoading, error } = useScaleEvolution(userId);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Carregando escalas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-red-500">Erro ao carregar escalas.</p>
      </div>
    );
  }

  const scaleTypes = data ? Object.keys(data) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Minhas Escalas Clinicas</h1>
      <p className="mb-8 text-slate-500">
        Acompanhe a evolucao dos seus scores ao longo do tempo.
      </p>

      {scaleTypes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          Nenhuma escala completada ainda. Seu medico pode aplicar escalas durante as consultas.
        </div>
      ) : (
        <div className="grid gap-6">
          {scaleTypes.map((type) => (
            <ScaleEvolutionChart key={type} scaleType={type} dataPoints={data![type]} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar link na Navbar**

In `apps/web/src/components/Navbar.tsx`, find the patient navigation links section and add a link to `/dashboard/patient/escalas` with text "Escalas". Follow the same pattern as the existing patient nav links (e.g., the "Medicos" link that points to `/dashboard/patient/doctors`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/patient/escalas/page.tsx apps/web/src/components/Navbar.tsx
git commit -m "feat(web): pagina de evolucao de escalas do paciente"
```

---

## Feature B: Atestados e Declaracoes Medicas (PDF)

### Escopo
Novo modulo `certificate` que permite o medico gerar atestados/declaracoes em PDF com assinatura digital (Lacuna PKI). O PDF e gerado server-side com PDFKit e retornado como stream.

### File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/certificate/certificate.module.ts` | NestJS module |
| Create | `apps/api/src/certificate/certificate.service.ts` | Business logic |
| Create | `apps/api/src/certificate/certificate.service.spec.ts` | Unit tests |
| Create | `apps/api/src/certificate/certificate.controller.ts` | HTTP endpoints |
| Create | `apps/api/src/certificate/certificate.controller.spec.ts` | Controller tests |
| Create | `apps/api/src/certificate/dto/create-certificate.dto.ts` | Validation DTO |
| Create | `apps/api/src/certificate/pdf/certificate-pdf.generator.ts` | PDFKit generator |
| Create | `apps/api/src/certificate/pdf/certificate-pdf.generator.spec.ts` | PDF generator tests |
| Modify | `apps/api/prisma/schema.prisma` | Add `Certificate` model |
| Modify | `apps/api/src/app.module.ts` | Import `CertificateModule` |
| Modify | `apps/api/src/main.ts` | Add Swagger tag |

---

### Task B1: Instalar PDFKit

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Instalar pdfkit e tipos**

```bash
cd /root/rodrigo/hope_saude/apps/api && npm install pdfkit && npm install -D @types/pdfkit
```

- [ ] **Step 2: Verificar**

```bash
cd /root/rodrigo/hope_saude/apps/api && node -e "require('pdfkit'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json
git commit -m "chore(api): add pdfkit for certificate PDF generation"
```

---

### Task B2: Prisma schema — Certificate model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Adicionar model**

Add at the end of `apps/api/prisma/schema.prisma`, before the `EmailOutbox` model:

```prisma
/// Atestados e declaracoes medicas emitidos pelo medico.
model Certificate {
  id            Int      @id @default(autoincrement())
  patientId     Int
  doctorId      Int
  appointmentId Int?
  type          String   // ATESTADO | DECLARACAO
  content       String   // Texto do documento
  daysOff       Int?     // Dias de afastamento (apenas atestado)
  cid           String?  // CID-10 (opcional, com consentimento do paciente)
  status        String   @default("DRAFT") // DRAFT | SIGNED
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Assinatura digital
  signature     String?
  signatureDate DateTime?
  signedHash    String?

  @@index([patientId, createdAt])
  @@index([doctorId, patientId])
}
```

Also add the relations on the `User` model. Add these two lines inside the `User` model:

```prisma
patientCertificates Certificate[] @relation("PatientCertificates")
doctorCertificates  Certificate[] @relation("DoctorCertificates")
```

And update the `Certificate` model to use relation annotations:

```prisma
patient       User     @relation("PatientCertificates", fields: [patientId], references: [id])
doctor        User     @relation("DoctorCertificates", fields: [doctorId], references: [id])
```

- [ ] **Step 2: Rodar migration**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add-certificate-model
```
Expected: migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(api): Prisma Certificate model for atestados/declaracoes"
```

---

### Task B3: CertificateService (TDD)

**Files:**
- Create: `apps/api/src/certificate/certificate.service.spec.ts`
- Create: `apps/api/src/certificate/certificate.service.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/certificate/certificate.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CertificateService } from './certificate.service';
import { PrismaService } from '../prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CertificateService', () => {
  let service: CertificateService;

  const mockPrisma = {
    certificate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'SignatureProvider', useValue: { sign: jest.fn() } },
      ],
    }).compile();

    service = module.get<CertificateService>(CertificateService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar um atestado quando medico tem relacao com paciente', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.certificate.create.mockResolvedValue({
        id: 1,
        doctorId: 1,
        patientId: 2,
        type: 'ATESTADO',
        content: 'Atesto que o paciente...',
        daysOff: 3,
        status: 'DRAFT',
      });

      const result = await service.create({
        doctorId: 1,
        patientId: 2,
        type: 'ATESTADO',
        content: 'Atesto que o paciente...',
        daysOff: 3,
      });

      expect(result.id).toBe(1);
      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.certificate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          doctorId: 1,
          patientId: 2,
          type: 'ATESTADO',
          content: 'Atesto que o paciente...',
          daysOff: 3,
          status: 'DRAFT',
        }),
      });
    });

    it('deve rejeitar se medico nao tem relacao com paciente', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          doctorId: 1,
          patientId: 99,
          type: 'ATESTADO',
          content: 'Texto',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByPatient', () => {
    it('deve listar certificados do paciente filtrado por medico', async () => {
      const certs = [{ id: 1 }, { id: 2 }];
      mockPrisma.certificate.findMany.mockResolvedValue(certs);

      const result = await service.findAllByPatient(2, 1);

      expect(mockPrisma.certificate.findMany).toHaveBeenCalledWith({
        where: { patientId: 2, doctorId: 1 },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('deve retornar NotFoundException se nao encontrar', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(null);

      await expect(service.findOne(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('deve rejeitar se medico nao e dono', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue({ id: 1, doctorId: 99 });

      await expect(service.findOne(1, 1)).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.service.spec --no-coverage
```
Expected: FAIL — Cannot find module `./certificate.service`

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/certificate/certificate.service.ts`:

```typescript
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { SignatureProvider } from '../common/signature-provider.interface';

@Injectable()
export class CertificateService {
  constructor(
    private prisma: PrismaService,
    @Inject('SignatureProvider') private signatureProvider: SignatureProvider,
  ) {}

  async create(data: {
    doctorId: number;
    patientId: number;
    type: string;
    content: string;
    appointmentId?: number;
    daysOff?: number;
    cid?: string;
  }) {
    const hasRelation = await this.prisma.appointment.findFirst({
      where: { doctorId: data.doctorId, patientId: data.patientId },
    });
    if (!hasRelation) {
      throw new ForbiddenException(
        'Voce nao possui consultas previas com este paciente.',
      );
    }

    return this.prisma.certificate.create({
      data: {
        doctorId: data.doctorId,
        patientId: data.patientId,
        type: data.type,
        content: data.content,
        appointmentId: data.appointmentId,
        daysOff: data.daysOff,
        cid: data.cid,
        status: 'DRAFT',
      },
    });
  }

  async findAllByPatient(patientId: number, doctorId?: number) {
    const where: { patientId: number; doctorId?: number } = { patientId };
    if (doctorId !== undefined) where.doctorId = doctorId;
    return this.prisma.certificate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(doctorId: number, certificateId: number) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
    });
    if (!cert) throw new NotFoundException('Certificado nao encontrado.');
    if (cert.doctorId !== doctorId) {
      throw new ForbiddenException('Voce nao tem permissao para acessar este certificado.');
    }
    return cert;
  }

  async sign(doctorId: number, certificateId: number, authData?: unknown) {
    const cert = await this.findOne(doctorId, certificateId);
    if (cert.status === 'SIGNED') return cert;

    const contentToSign = JSON.stringify({
      content: cert.content,
      type: cert.type,
      patientId: cert.patientId,
      doctorId: cert.doctorId,
      date: cert.createdAt,
    });

    const result = await this.signatureProvider.sign(contentToSign, authData);

    return this.prisma.certificate.update({
      where: { id: certificateId },
      data: {
        status: 'SIGNED',
        signature: result.signature,
        signatureDate: result.signatureDate,
        signedHash: result.hash,
      },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.service.spec --no-coverage
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/certificate/
git commit -m "feat(api): CertificateService — CRUD + assinatura de atestados"
```

---

### Task B4: PDF Generator (TDD)

**Files:**
- Create: `apps/api/src/certificate/pdf/certificate-pdf.generator.spec.ts`
- Create: `apps/api/src/certificate/pdf/certificate-pdf.generator.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/certificate/pdf/certificate-pdf.generator.spec.ts`:

```typescript
import { generateCertificatePdf } from './certificate-pdf.generator';

describe('generateCertificatePdf', () => {
  it('deve retornar um Buffer de PDF valido', async () => {
    const buffer = await generateCertificatePdf({
      type: 'ATESTADO',
      doctorName: 'Dr. Joao Silva',
      doctorCrm: 'CRM/SP 123456',
      patientName: 'Maria Souza',
      content: 'Atesto para os devidos fins que o paciente esteve em consulta.',
      daysOff: 3,
      date: new Date('2026-04-09'),
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    // PDF magic bytes
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('deve gerar PDF de declaracao sem daysOff', async () => {
    const buffer = await generateCertificatePdf({
      type: 'DECLARACAO',
      doctorName: 'Dr. Joao Silva',
      doctorCrm: 'CRM/SP 123456',
      patientName: 'Maria Souza',
      content: 'Declaro que o paciente compareceu a consulta.',
      date: new Date('2026-04-09'),
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate-pdf.generator.spec --no-coverage
```
Expected: FAIL — Cannot find module

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/certificate/pdf/certificate-pdf.generator.ts`:

```typescript
import PDFDocument from 'pdfkit';

export interface CertificatePdfInput {
  type: 'ATESTADO' | 'DECLARACAO';
  doctorName: string;
  doctorCrm: string;
  patientName: string;
  content: string;
  daysOff?: number;
  cid?: string;
  date: Date;
  signed?: boolean;
}

export function generateCertificatePdf(input: CertificatePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const title = input.type === 'ATESTADO' ? 'ATESTADO MEDICO' : 'DECLARACAO MEDICA';
    const formattedDate = input.date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Header
    doc.fontSize(10).text('Hope Saude — Plataforma de Telemedicina', { align: 'center' });
    doc.moveDown(2);

    // Title
    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown(2);

    // Body
    doc.fontSize(12).text(input.content, { align: 'justify', lineGap: 6 });
    doc.moveDown(1);

    if (input.type === 'ATESTADO' && input.daysOff) {
      doc.text(
        `Periodo de afastamento: ${input.daysOff} dia(s) a partir de ${formattedDate}.`,
        { lineGap: 6 },
      );
      doc.moveDown(0.5);
    }

    if (input.cid) {
      doc.text(`CID-10: ${input.cid}`, { lineGap: 6 });
      doc.moveDown(0.5);
    }

    // Date
    doc.moveDown(2);
    doc.text(formattedDate, { align: 'right' });

    // Signature block
    doc.moveDown(3);
    doc.text('_________________________________', { align: 'center' });
    doc.text(input.doctorName, { align: 'center' });
    doc.text(input.doctorCrm, { align: 'center' });

    if (input.signed) {
      doc.moveDown(1);
      doc.fontSize(9).text('Documento assinado digitalmente.', { align: 'center' });
    }

    doc.end();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate-pdf.generator.spec --no-coverage
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/certificate/pdf/
git commit -m "feat(api): generateCertificatePdf — PDF generator with PDFKit"
```

---

### Task B5: DTO + Controller + Module (TDD)

**Files:**
- Create: `apps/api/src/certificate/dto/create-certificate.dto.ts`
- Create: `apps/api/src/certificate/certificate.controller.ts`
- Create: `apps/api/src/certificate/certificate.controller.spec.ts`
- Create: `apps/api/src/certificate/certificate.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Criar DTO**

Create `apps/api/src/certificate/dto/create-certificate.dto.ts`:

```typescript
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCertificateDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  patientId!: number;

  @ApiProperty({ enum: ['ATESTADO', 'DECLARACAO'] })
  @IsEnum(['ATESTADO', 'DECLARACAO'], { message: 'Tipo deve ser ATESTADO ou DECLARACAO' })
  type!: 'ATESTADO' | 'DECLARACAO';

  @ApiProperty({ example: 'Atesto que o paciente esteve em consulta medica.' })
  @IsString()
  @IsNotEmpty({ message: 'O conteudo e obrigatorio' })
  content!: string;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @IsInt()
  appointmentId?: number;

  @ApiProperty({ required: false, example: 3 })
  @IsOptional()
  @IsInt()
  daysOff?: number;

  @ApiProperty({ required: false, example: 'F32.1' })
  @IsOptional()
  @IsString()
  cid?: string;
}
```

- [ ] **Step 2: Write controller failing test**

Create `apps/api/src/certificate/certificate.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { ForbiddenException } from '@nestjs/common';

describe('CertificateController', () => {
  let controller: CertificateController;

  const mockService = {
    create: jest.fn(),
    findAllByPatient: jest.fn(),
    findOne: jest.fn(),
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificateController],
      providers: [{ provide: CertificateService, useValue: mockService }],
    }).compile();

    controller = module.get<CertificateController>(CertificateController);
    jest.clearAllMocks();
  });

  it('deve criar certificado como medico', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } } as any;
    const body = { patientId: 2, type: 'ATESTADO' as const, content: 'Texto' };
    mockService.create.mockResolvedValue({ id: 1 });

    const result = await controller.create(req, body);

    expect(mockService.create).toHaveBeenCalledWith({ doctorId: 1, ...body });
    expect(result.id).toBe(1);
  });

  it('deve rejeitar paciente criando certificado', async () => {
    const req = { user: { userId: 2, role: 'PATIENT' } } as any;
    const body = { patientId: 2, type: 'ATESTADO' as const, content: 'Texto' };

    await expect(controller.create(req, body)).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.controller.spec --no-coverage
```
Expected: FAIL — Cannot find module

- [ ] **Step 4: Write Controller**

Create `apps/api/src/certificate/certificate.controller.ts`:

```typescript
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { CertificateService } from './certificate.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { generateCertificatePdf } from './pdf/certificate-pdf.generator';
import { PrismaService } from '../prisma.service';
import type { Response } from 'express';

@ApiTags('certificate')
@ApiBearerAuth('JWT')
@Controller('certificates')
@UseGuards(AuthGuard('jwt'))
export class CertificateController {
  constructor(
    private readonly service: CertificateService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Medico cria atestado ou declaracao' })
  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateCertificateDto,
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas medicos podem emitir certificados.');
    }
    return this.service.create({ doctorId: req.user.userId, ...body });
  }

  @ApiOperation({ summary: 'Lista certificados de um paciente' })
  @Get('patient/:patientId')
  async listByPatient(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientIdParam: string,
  ) {
    const patientId = parseInt(patientIdParam, 10);
    if (req.user.role === 'PATIENT' && req.user.userId !== patientId) {
      throw new ForbiddenException('Voce so pode ver seus proprios certificados.');
    }
    const doctorId = req.user.role === 'DOCTOR' ? req.user.userId : undefined;
    return this.service.findAllByPatient(patientId, doctorId);
  }

  @ApiOperation({ summary: 'Download do certificado em PDF' })
  @Get(':id/pdf')
  async downloadPdf(
    @Request() req: AuthenticatedRequest,
    @Param('id') idParam: string,
    @Res() res: Response,
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas medicos podem gerar PDF.');
    }
    const cert = await this.service.findOne(req.user.userId, parseInt(idParam, 10));

    const doctor = await this.prisma.user.findUnique({
      where: { id: cert.doctorId },
      include: { doctorProfile: true },
    });
    const patient = await this.prisma.user.findUnique({
      where: { id: cert.patientId },
    });

    const buffer = await generateCertificatePdf({
      type: cert.type as 'ATESTADO' | 'DECLARACAO',
      doctorName: doctor?.name ?? 'Medico',
      doctorCrm: doctor?.doctorProfile?.crm ? `CRM ${doctor.doctorProfile.crm}` : '',
      patientName: patient?.name ?? 'Paciente',
      content: cert.content,
      daysOff: cert.daysOff ?? undefined,
      cid: cert.cid ?? undefined,
      date: cert.createdAt,
      signed: cert.status === 'SIGNED',
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificado-${cert.id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @ApiOperation({ summary: 'Assina digitalmente o certificado' })
  @Post(':id/sign')
  async sign(@Request() req: AuthenticatedRequest, @Param('id') idParam: string) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas medicos podem assinar certificados.');
    }
    return this.service.sign(req.user.userId, parseInt(idParam, 10));
  }
}
```

- [ ] **Step 5: Run controller tests**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.controller.spec --no-coverage
```
Expected: PASS (2 tests)

- [ ] **Step 6: Create Module and register in AppModule**

Create `apps/api/src/certificate/certificate.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { PrismaService } from '../prisma.service';
import { LacunaProvider } from '../common/lacuna.provider';

@Module({
  controllers: [CertificateController],
  providers: [
    CertificateService,
    PrismaService,
    ConfigService,
    {
      provide: 'SignatureProvider',
      useClass: LacunaProvider,
    },
  ],
  exports: [CertificateService],
})
export class CertificateModule {}
```

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { CertificateModule } from './certificate/certificate.module';
```

And add `CertificateModule` to the `imports` array.

In `apps/api/src/main.ts`, add in the Swagger tags (after the `prescription` tag):

```typescript
.addTag('certificate', 'Atestados e declaracoes')
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/certificate/ apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat(api): CertificateModule — CRUD, PDF download, assinatura digital"
```

---

## Feature C: Swagger Completo

### Escopo
O Swagger ja esta configurado em `main.ts` e disponivel em `/api/docs`. O que falta e:
1. Adicionar `@ApiProperty` nos body parameters que usam tipos inline (sem DTO formal)
2. Adicionar DTOs faltantes para os controllers que usam `@Body() body: { ... }` inline
3. Adicionar `@ApiResponse` decorators nos endpoints existentes

### File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/src/clinical-scale/dto/create-scale.dto.ts` | DTO for scale creation |
| Create | `apps/api/src/clinical-scale/dto/submit-answers.dto.ts` | DTO for answers submission |
| Modify | `apps/api/src/clinical-scale/clinical-scale.controller.ts` | Use DTOs instead of inline types |
| Modify | `apps/api/src/appointment/appointment.controller.ts` | Add ApiResponse decorators |
| Modify | `apps/api/src/medical-record/medical-record.controller.ts` | Add ApiResponse decorators |
| Modify | `apps/api/src/prescription/prescription.controller.ts` | Add ApiProperty to inline body types |

---

### Task C1: DTOs para ClinicalScale

**Files:**
- Create: `apps/api/src/clinical-scale/dto/create-scale.dto.ts`
- Create: `apps/api/src/clinical-scale/dto/submit-answers.dto.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.controller.ts`

- [ ] **Step 1: Criar CreateScaleDto**

Create `apps/api/src/clinical-scale/dto/create-scale.dto.ts`:

```typescript
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScaleDto {
  @ApiProperty({ example: 2, description: 'ID do paciente' })
  @IsInt()
  patientId!: number;

  @ApiProperty({ enum: ['PHQ9', 'GAD7', 'AUDIT', 'MOCA'], example: 'PHQ9' })
  @IsEnum(['PHQ9', 'GAD7', 'AUDIT', 'MOCA'], { message: 'Tipo deve ser PHQ9, GAD7, AUDIT ou MOCA' })
  type!: string;

  @ApiProperty({ required: false, example: 'Paciente relata piora recente' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 2: Criar SubmitAnswersDto**

Create `apps/api/src/clinical-scale/dto/submit-answers.dto.ts`:

```typescript
import { IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitAnswersDto {
  @ApiProperty({ type: [Number], example: [0, 1, 2, 3, 0, 1, 2, 1, 0], description: 'Array de respostas numericas' })
  @IsArray()
  @IsInt({ each: true })
  answers!: number[];
}
```

- [ ] **Step 3: Atualizar controller para usar DTOs**

In `apps/api/src/clinical-scale/clinical-scale.controller.ts`:

Replace the `create` method body parameter:
```typescript
// Before:
@Body() body: { patientId: number; type: ScaleType; notes?: string },

// After:
@Body() body: CreateScaleDto,
```

Replace the `submitAnswers` method body parameter:
```typescript
// Before:
@Body() body: { answers: number[] }

// After:
@Body() body: SubmitAnswersDto
```

Add imports at the top:
```typescript
import { CreateScaleDto } from './dto/create-scale.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
```

- [ ] **Step 4: Run existing tests to verify no regression**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale --no-coverage
```
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/clinical-scale/
git commit -m "feat(api): DTOs formais para ClinicalScale — melhora Swagger docs"
```

---

### Task C2: ApiResponse decorators nos controllers existentes

**Files:**
- Modify: `apps/api/src/appointment/appointment.controller.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`

- [ ] **Step 1: Appointment controller**

In `apps/api/src/appointment/appointment.controller.ts`, add:

```typescript
import { ApiResponse } from '@nestjs/swagger';
```

Add decorators to the `getMyAppointments` method:

```typescript
@ApiOperation({ summary: 'Lista consultas do usuario logado (auto-detecta role)' })
@ApiResponse({ status: 200, description: 'Lista de consultas' })
@ApiResponse({ status: 401, description: 'Token JWT invalido ou ausente' })
```

- [ ] **Step 2: Auth controller — adicionar ApiResponse nos endpoints**

In `apps/api/src/auth/auth.controller.ts`, add `@ApiResponse` decorators to the main endpoints:

For `register`:
```typescript
@ApiResponse({ status: 201, description: 'Usuario registrado com sucesso' })
@ApiResponse({ status: 409, description: 'Email ja cadastrado' })
```

For `login`:
```typescript
@ApiResponse({ status: 200, description: 'Login bem-sucedido, retorna access_token' })
@ApiResponse({ status: 401, description: 'Credenciais invalidas' })
```

For `me`:
```typescript
@ApiResponse({ status: 200, description: 'Dados do usuario logado' })
```

- [ ] **Step 3: Run all tests to verify no regression**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
```
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/appointment/appointment.controller.ts apps/api/src/auth/auth.controller.ts
git commit -m "docs(api): ApiResponse decorators em AppointmentController e AuthController"
```

---

## Feature D: Reagendamento e Cancelamento pelo Paciente

### Escopo
Adicionar endpoints para: (1) paciente cancelar consulta CONFIRMED (ate 24h antes), (2) medico cancelar consulta, (3) paciente solicitar reagendamento (cancela + cria nova pendencia). Adicionar campo `cancelledAt` e `cancellationReason` no Appointment.

### File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/prisma/schema.prisma` | Add cancel fields to Appointment |
| Modify | `apps/api/src/appointment/appointment.service.ts` | Add cancel/reschedule methods |
| Modify | `apps/api/src/appointment/appointment.service.spec.ts` | Tests |
| Modify | `apps/api/src/appointment/appointment.controller.ts` | New endpoints |
| Modify | `apps/api/src/appointment/appointment.controller.spec.ts` | Controller tests |
| Create | `apps/api/src/appointment/dto/cancel-appointment.dto.ts` | DTO |
| Modify | `apps/web/src/lib/query/query-keys.ts` | Add appointment detail key |
| Create | `apps/web/src/lib/query/use-cancel-appointment.ts` | Mutation hook |

---

### Task D1: Schema migration — cancel fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao model Appointment**

In `apps/api/prisma/schema.prisma`, add to the `Appointment` model (after `updatedAt`):

```prisma
cancelledAt        DateTime?
cancellationReason String?
cancelledBy        String?   // PATIENT | DOCTOR
```

- [ ] **Step 2: Rodar migration**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add-appointment-cancellation-fields
```
Expected: Migration applied

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(api): Prisma — campos de cancelamento em Appointment"
```

---

### Task D2: AppointmentService — cancel (TDD)

**Files:**
- Modify: `apps/api/src/appointment/appointment.service.spec.ts`
- Modify: `apps/api/src/appointment/appointment.service.ts`

- [ ] **Step 1: Write the failing tests**

Create or add to `apps/api/src/appointment/appointment.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentService } from './appointment.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('AppointmentService', () => {
  let service: AppointmentService;

  const mockPrisma = {
    appointment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pendingCheckout: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    jest.clearAllMocks();
  });

  describe('cancel', () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // +48h

    it('deve cancelar consulta confirmada quando paciente cancela com mais de 24h de antecedencia', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 2,
        doctorId: 3,
        status: 'CONFIRMED',
        date: futureDate,
      });
      mockPrisma.appointment.update.mockResolvedValue({
        id: 1,
        status: 'CANCELLED',
        cancelledBy: 'PATIENT',
      });

      const result = await service.cancel(1, 2, 'PATIENT', 'Imprevisto pessoal');

      expect(mockPrisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          cancellationReason: 'Imprevisto pessoal',
          cancelledBy: 'PATIENT',
        },
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('deve rejeitar cancelamento de paciente com menos de 24h', async () => {
      const soonDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // +12h
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 2,
        doctorId: 3,
        status: 'CONFIRMED',
        date: soonDate,
      });

      await expect(
        service.cancel(1, 2, 'PATIENT', 'Motivo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve permitir medico cancelar mesmo com menos de 24h', async () => {
      const soonDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2h
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 2,
        doctorId: 3,
        status: 'CONFIRMED',
        date: soonDate,
      });
      mockPrisma.appointment.update.mockResolvedValue({ id: 1, status: 'CANCELLED' });

      const result = await service.cancel(1, 3, 'DOCTOR', 'Emergencia');

      expect(result.status).toBe('CANCELLED');
    });

    it('deve rejeitar se consulta nao pertence ao usuario', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 2,
        doctorId: 3,
        status: 'CONFIRMED',
        date: futureDate,
      });

      await expect(
        service.cancel(1, 999, 'PATIENT', 'Motivo'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve rejeitar se consulta ja esta cancelada', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 1,
        patientId: 2,
        doctorId: 3,
        status: 'CANCELLED',
        date: futureDate,
      });

      await expect(
        service.cancel(1, 2, 'PATIENT', 'Motivo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve retornar NotFoundException se consulta nao existe', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.cancel(999, 2, 'PATIENT', 'Motivo'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest appointment.service.spec --no-coverage -t "cancel"
```
Expected: FAIL — `service.cancel is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `apps/api/src/appointment/appointment.service.ts`:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
```

(Replace the existing `import { Injectable } from '@nestjs/common';`)

Add method inside the class:

```typescript
private static readonly MIN_CANCEL_HOURS_PATIENT = 24;

async cancel(
  appointmentId: number,
  userId: number,
  role: 'PATIENT' | 'DOCTOR',
  reason?: string,
) {
  const appointment = await this.prisma.appointment.findUnique({
    where: { id: appointmentId },
  });
  if (!appointment) {
    throw new NotFoundException('Consulta nao encontrada.');
  }

  const isOwner =
    (role === 'PATIENT' && appointment.patientId === userId) ||
    (role === 'DOCTOR' && appointment.doctorId === userId);
  if (!isOwner) {
    throw new ForbiddenException('Voce nao tem permissao para cancelar esta consulta.');
  }

  if (appointment.status === 'CANCELLED') {
    throw new BadRequestException('Esta consulta ja foi cancelada.');
  }
  if (appointment.status === 'COMPLETED') {
    throw new BadRequestException('Nao e possivel cancelar uma consulta ja realizada.');
  }

  // Paciente so pode cancelar com 24h+ de antecedencia
  if (role === 'PATIENT') {
    const hoursUntil = (appointment.date.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < AppointmentService.MIN_CANCEL_HOURS_PATIENT) {
      throw new BadRequestException(
        `Cancelamento pelo paciente permitido apenas com ${AppointmentService.MIN_CANCEL_HOURS_PATIENT}h+ de antecedencia.`,
      );
    }
  }

  return this.prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason,
      cancelledBy: role,
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest appointment.service.spec --no-coverage -t "cancel"
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/appointment/appointment.service.ts apps/api/src/appointment/appointment.service.spec.ts
git commit -m "feat(api): AppointmentService.cancel — cancelamento com regra de 24h"
```

---

### Task D3: Controller endpoints — cancel (TDD)

**Files:**
- Create: `apps/api/src/appointment/dto/cancel-appointment.dto.ts`
- Modify: `apps/api/src/appointment/appointment.controller.spec.ts`
- Modify: `apps/api/src/appointment/appointment.controller.ts`

- [ ] **Step 1: Criar DTO**

Create `apps/api/src/appointment/dto/cancel-appointment.dto.ts`:

```typescript
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelAppointmentDto {
  @ApiProperty({ required: false, example: 'Imprevisto pessoal' })
  @IsOptional()
  @IsString()
  reason?: string;
}
```

- [ ] **Step 2: Write controller failing test**

Create `apps/api/src/appointment/appointment.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';

describe('AppointmentController', () => {
  let controller: AppointmentController;

  const mockService = {
    getDoctorAppointments: jest.fn(),
    getPatientAppointments: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [{ provide: AppointmentService, useValue: mockService }],
    }).compile();

    controller = module.get<AppointmentController>(AppointmentController);
    jest.clearAllMocks();
  });

  describe('cancelAppointment', () => {
    it('deve chamar service.cancel com role do usuario', async () => {
      const req = { user: { userId: 2, role: 'PATIENT' } } as any;
      mockService.cancel.mockResolvedValue({ id: 1, status: 'CANCELLED' });

      const result = await controller.cancelAppointment(req, '1', { reason: 'Motivo' });

      expect(mockService.cancel).toHaveBeenCalledWith(1, 2, 'PATIENT', 'Motivo');
      expect(result.status).toBe('CANCELLED');
    });

    it('deve funcionar para medico tambem', async () => {
      const req = { user: { userId: 3, role: 'DOCTOR' } } as any;
      mockService.cancel.mockResolvedValue({ id: 1, status: 'CANCELLED' });

      await controller.cancelAppointment(req, '1', { reason: 'Emergencia' });

      expect(mockService.cancel).toHaveBeenCalledWith(1, 3, 'DOCTOR', 'Emergencia');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest appointment.controller.spec --no-coverage
```
Expected: FAIL — `controller.cancelAppointment is not a function`

- [ ] **Step 4: Write controller endpoint**

Replace `apps/api/src/appointment/appointment.controller.ts` content:

```typescript
import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';

@ApiTags('appointment')
@ApiBearerAuth('JWT')
@Controller('appointments')
@UseGuards(AuthGuard('jwt'))
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) {}

  @ApiOperation({ summary: 'Lista consultas do usuario logado (auto-detecta role)' })
  @ApiResponse({ status: 200, description: 'Lista de consultas' })
  @Get('me')
  async getMyAppointments(@Request() req: AuthenticatedRequest) {
    if (req.user.role === 'DOCTOR') {
      return this.appointmentService.getDoctorAppointments(req.user.userId);
    }
    return this.appointmentService.getPatientAppointments(req.user.userId);
  }

  @ApiOperation({ summary: 'Cancela uma consulta (paciente: 24h+ antes; medico: sem restricao)' })
  @ApiResponse({ status: 200, description: 'Consulta cancelada' })
  @ApiResponse({ status: 400, description: 'Cancelamento fora do prazo ou consulta ja cancelada' })
  @ApiResponse({ status: 403, description: 'Sem permissao para cancelar' })
  @ApiResponse({ status: 404, description: 'Consulta nao encontrada' })
  @Post(':id/cancel')
  async cancelAppointment(
    @Request() req: AuthenticatedRequest,
    @Param('id') idParam: string,
    @Body() body: CancelAppointmentDto,
  ) {
    return this.appointmentService.cancel(
      parseInt(idParam, 10),
      req.user.userId,
      req.user.role as 'PATIENT' | 'DOCTOR',
      body.reason,
    );
  }
}
```

- [ ] **Step 5: Run all appointment tests**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest appointment --no-coverage
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/appointment/
git commit -m "feat(api): POST /appointments/:id/cancel — cancelamento com regras de prazo"
```

---

### Task D4: Frontend — botao de cancelamento

**Files:**
- Create: `apps/web/src/lib/query/use-cancel-appointment.ts`

- [ ] **Step 1: Criar mutation hook**

Create `apps/web/src/lib/query/use-cancel-appointment.ts`:

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api-client';
import { queryKeys } from './query-keys';

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, reason }: { appointmentId: number; reason?: string }) =>
      api.post(`/appointments/${appointmentId}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.appointments.me });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/query/use-cancel-appointment.ts
git commit -m "feat(web): useCancelAppointment mutation hook"
```

---

## Feature E: Historico de Pagamentos e Recibos

### Escopo
Endpoint que retorna o historico de pagamentos (appointments confirmados/completados com price e paymentId). Frontend exibe lista de transacoes. Recibo PDF reutiliza o PDFKit instalado na Feature B.

### File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/src/payment/payment.service.ts` | Add `getPaymentHistory()` |
| Create | `apps/api/src/payment/payment.service.spec.ts` | Service tests |
| Modify | `apps/api/src/payment/payment.controller.ts` | Add history + receipt endpoints |
| Create | `apps/api/src/payment/payment.controller.spec.ts` | Controller tests |
| Create | `apps/api/src/payment/pdf/receipt-pdf.generator.ts` | Receipt PDF generator |
| Create | `apps/api/src/payment/pdf/receipt-pdf.generator.spec.ts` | PDF tests |
| Create | `apps/web/src/lib/query/use-payment-history.ts` | TanStack Query hook |
| Create | `apps/web/src/app/dashboard/patient/pagamentos/page.tsx` | Payment history page |

---

### Task E1: PaymentService — getPaymentHistory (TDD)

**Files:**
- Create: `apps/api/src/payment/payment.service.spec.ts`
- Modify: `apps/api/src/payment/payment.service.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/payment/payment.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { AsaasService } from './asaas.service';
import { AppointmentService } from '../appointment/appointment.service';
import { PatientProfileRepository } from '../profile/data/patient-profile.repository';
import { DoctorProfileRepository } from '../profile/data/doctor-profile.repository';
import { PrismaService } from '../prisma.service';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockPrisma = {
    appointment: {
      findMany: jest.fn(),
    },
  };

  const mockAsaas = {};
  const mockAppointmentService = {};
  const mockPatientRepo = {};
  const mockDoctorRepo = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: AsaasService, useValue: mockAsaas },
        { provide: AppointmentService, useValue: mockAppointmentService },
        { provide: PatientProfileRepository, useValue: mockPatientRepo },
        { provide: DoctorProfileRepository, useValue: mockDoctorRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  describe('getPaymentHistory', () => {
    it('deve retornar historico de pagamentos do paciente', async () => {
      const appointments = [
        {
          id: 1,
          date: new Date('2026-03-01'),
          status: 'COMPLETED',
          price: 200,
          paymentId: 'pay_123',
          durationMinutes: 60,
          doctor: { name: 'Dr. Joao' },
        },
        {
          id: 2,
          date: new Date('2026-04-01'),
          status: 'CONFIRMED',
          price: 150,
          paymentId: 'pay_456',
          durationMinutes: 30,
          doctor: { name: 'Dr. Maria' },
        },
      ];
      mockPrisma.appointment.findMany.mockResolvedValue(appointments);

      const result = await service.getPaymentHistory(5);

      expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          patientId: 5,
          paymentId: { not: null },
        },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          status: true,
          price: true,
          paymentId: true,
          durationMinutes: true,
          doctor: { select: { name: true } },
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].paymentId).toBe('pay_123');
    });

    it('deve retornar lista vazia se paciente nao tem pagamentos', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getPaymentHistory(99);

      expect(result).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.service.spec --no-coverage -t "getPaymentHistory"
```
Expected: FAIL — either test module build fails or `service.getPaymentHistory is not a function`

- [ ] **Step 3: Write minimal implementation**

Add to `apps/api/src/payment/payment.service.ts`:

First, add `PrismaService` to the constructor. Add import:
```typescript
import { PrismaService } from '../prisma.service';
```

Add to constructor:
```typescript
constructor(
  private asaasService: AsaasService,
  private appointmentService: AppointmentService,
  private patientProfileRepo: PatientProfileRepository,
  private doctorProfileRepo: DoctorProfileRepository,
  private prisma: PrismaService,
) {}
```

Add method:

```typescript
async getPaymentHistory(patientId: number) {
  return this.prisma.appointment.findMany({
    where: {
      patientId,
      paymentId: { not: null },
    },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      date: true,
      status: true,
      price: true,
      paymentId: true,
      durationMinutes: true,
      doctor: { select: { name: true } },
    },
  });
}
```

Also register `PrismaService` in `apps/api/src/payment/payment.module.ts` if not already present.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.service.spec --no-coverage -t "getPaymentHistory"
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payment/
git commit -m "feat(api): PaymentService.getPaymentHistory — historico de pagamentos"
```

---

### Task E2: Receipt PDF generator (TDD)

**Files:**
- Create: `apps/api/src/payment/pdf/receipt-pdf.generator.spec.ts`
- Create: `apps/api/src/payment/pdf/receipt-pdf.generator.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/payment/pdf/receipt-pdf.generator.spec.ts`:

```typescript
import { generateReceiptPdf } from './receipt-pdf.generator';

describe('generateReceiptPdf', () => {
  it('deve retornar um Buffer de PDF valido', async () => {
    const buffer = await generateReceiptPdf({
      patientName: 'Maria Souza',
      doctorName: 'Dr. Joao Silva',
      date: new Date('2026-04-01'),
      price: 200,
      durationMinutes: 60,
      paymentId: 'pay_123',
      appointmentId: 1,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest receipt-pdf.generator.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `apps/api/src/payment/pdf/receipt-pdf.generator.ts`:

```typescript
import PDFDocument from 'pdfkit';

export interface ReceiptPdfInput {
  patientName: string;
  doctorName: string;
  date: Date;
  price: number;
  durationMinutes: number;
  paymentId: string;
  appointmentId: number;
}

export function generateReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const formattedDate = input.date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const formattedPrice = input.price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    // Header
    doc.fontSize(10).text('Hope Saude — Plataforma de Telemedicina', { align: 'center' });
    doc.moveDown(2);

    // Title
    doc.fontSize(18).text('RECIBO DE PAGAMENTO', { align: 'center' });
    doc.moveDown(2);

    // Details
    doc.fontSize(12);
    doc.text(`Paciente: ${input.patientName}`);
    doc.moveDown(0.5);
    doc.text(`Medico: ${input.doctorName}`);
    doc.moveDown(0.5);
    doc.text(`Data da consulta: ${formattedDate}`);
    doc.moveDown(0.5);
    doc.text(`Duracao: ${input.durationMinutes} minutos`);
    doc.moveDown(0.5);
    doc.text(`Valor: ${formattedPrice}`);
    doc.moveDown(0.5);
    doc.text(`ID do pagamento: ${input.paymentId}`);
    doc.moveDown(0.5);
    doc.text(`Consulta #${input.appointmentId}`);

    // Footer
    doc.moveDown(3);
    doc.fontSize(9).text(
      `Documento gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}.`,
      { align: 'center' },
    );

    doc.end();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest receipt-pdf.generator.spec --no-coverage
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payment/pdf/
git commit -m "feat(api): generateReceiptPdf — recibo de pagamento em PDF"
```

---

### Task E3: Payment Controller — history + receipt (TDD)

**Files:**
- Create: `apps/api/src/payment/payment.controller.spec.ts`
- Modify: `apps/api/src/payment/payment.controller.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/payment/payment.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ForbiddenException } from '@nestjs/common';

describe('PaymentController', () => {
  let controller: PaymentController;

  const mockService = {
    processCheckout: jest.fn(),
    getPixQrData: jest.fn(),
    confirmPayment: jest.fn(),
    getPaymentHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: PaymentService, useValue: mockService },
        { provide: 'PrismaService', useValue: {} },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    jest.clearAllMocks();
  });

  describe('getPaymentHistory', () => {
    it('deve retornar historico para paciente', async () => {
      const req = { user: { userId: 2, role: 'PATIENT' } } as any;
      const history = [{ id: 1, price: 200 }];
      mockService.getPaymentHistory.mockResolvedValue(history);

      const result = await controller.getPaymentHistory(req);

      expect(mockService.getPaymentHistory).toHaveBeenCalledWith(2);
      expect(result).toEqual(history);
    });

    it('deve rejeitar medico acessando historico de pagamentos', async () => {
      const req = { user: { userId: 1, role: 'DOCTOR' } } as any;

      await expect(controller.getPaymentHistory(req)).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.controller.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 3: Add endpoints to existing PaymentController**

In `apps/api/src/payment/payment.controller.ts`, add these new methods (keep existing endpoints). Add required imports:

```typescript
import { ForbiddenException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { generateReceiptPdf } from './pdf/receipt-pdf.generator';
```

Add method:

```typescript
@ApiOperation({ summary: 'Historico de pagamentos do paciente' })
@ApiResponse({ status: 200, description: 'Lista de pagamentos' })
@Get('history')
async getPaymentHistory(@Request() req: AuthenticatedRequest) {
  if (req.user.role !== 'PATIENT') {
    throw new ForbiddenException('Apenas pacientes acessam o historico de pagamentos.');
  }
  return this.paymentService.getPaymentHistory(req.user.userId);
}

@ApiOperation({ summary: 'Download de recibo em PDF' })
@Get('history/:appointmentId/receipt')
async downloadReceipt(
  @Request() req: AuthenticatedRequest,
  @Param('appointmentId') appointmentIdParam: string,
  @Res() res: Response,
) {
  if (req.user.role !== 'PATIENT') {
    throw new ForbiddenException('Apenas pacientes podem baixar recibos.');
  }
  const history = await this.paymentService.getPaymentHistory(req.user.userId);
  const appointment = history.find(
    (h: { id: number }) => h.id === parseInt(appointmentIdParam, 10),
  );
  if (!appointment) {
    throw new NotFoundException('Pagamento nao encontrado.');
  }

  const buffer = await generateReceiptPdf({
    patientName: req.user.name ?? 'Paciente',
    doctorName: (appointment as any).doctor?.name ?? 'Medico',
    date: new Date(appointment.date),
    price: appointment.price,
    durationMinutes: appointment.durationMinutes,
    paymentId: appointment.paymentId!,
    appointmentId: appointment.id,
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="recibo-${appointment.id}.pdf"`,
    'Content-Length': buffer.length,
  });
  res.end(buffer);
}
```

Add the `NotFoundException` import if not present.

**IMPORTANT:** The `GET history` route must come BEFORE any `GET :paymentId` route to avoid path conflicts.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.controller.spec --no-coverage
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payment/
git commit -m "feat(api): GET /payments/history + receipt PDF download"
```

---

### Task E4: Frontend — hook + pagina de historico

**Files:**
- Create: `apps/web/src/lib/query/use-payment-history.ts`
- Modify: `apps/web/src/lib/query/query-keys.ts`
- Create: `apps/web/src/app/dashboard/patient/pagamentos/page.tsx`

- [ ] **Step 1: Adicionar query key**

In `apps/web/src/lib/query/query-keys.ts`, add inside the `queryKeys` object:

```typescript
payments: {
  history: ['payments', 'history'] as const,
},
```

- [ ] **Step 2: Criar hook**

Create `apps/web/src/lib/query/use-payment-history.ts`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api-client';
import { queryKeys } from './query-keys';

export interface PaymentHistoryItem {
  id: number;
  date: string;
  status: string;
  price: number;
  paymentId: string;
  durationMinutes: number;
  doctor: { name: string };
}

export function usePaymentHistory() {
  return useQuery({
    queryKey: queryKeys.payments.history,
    queryFn: () => api.get<PaymentHistoryItem[]>('/payments/history'),
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Criar pagina**

Create `apps/web/src/app/dashboard/patient/pagamentos/page.tsx`:

```tsx
'use client';

import { usePaymentHistory } from '../../../../lib/query/use-payment-history';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: 'Confirmada', color: 'text-sky-600 bg-sky-50' },
  COMPLETED: { label: 'Realizada', color: 'text-emerald-600 bg-emerald-50' },
  CANCELLED: { label: 'Cancelada', color: 'text-red-500 bg-red-50' },
};

export default function PagamentosPage() {
  const { data, isLoading, error } = usePaymentHistory();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-400">Carregando historico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-red-500">Erro ao carregar historico de pagamentos.</p>
      </div>
    );
  }

  const payments = data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Historico de Pagamentos</h1>
      <p className="mb-8 text-slate-500">Todas as suas transacoes na Hope Saude.</p>

      {payments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          Nenhum pagamento encontrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Medico</th>
                <th className="px-4 py-3">Duracao</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recibo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => {
                const status = STATUS_LABELS[p.status] ?? {
                  label: p.status,
                  color: 'text-slate-500 bg-slate-50',
                };
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">{p.doctor.name}</td>
                    <td className="px-4 py-3">{p.durationMinutes} min</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/payments/history/${p.id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:underline"
                      >
                        PDF
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Adicionar link na Navbar**

In `apps/web/src/components/Navbar.tsx`, add a patient nav link to `/dashboard/patient/pagamentos` with text "Pagamentos". Follow the existing pattern for patient links.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/query/ apps/web/src/app/dashboard/patient/pagamentos/ apps/web/src/components/Navbar.tsx
git commit -m "feat(web): pagina de historico de pagamentos com download de recibo"
```

---

## Checklist Final

Apos todas as tasks, rodar:

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage
```

Todos os testes devem passar. Se algum falhar, investigar e corrigir antes de prosseguir.

---

## Ordem de Execucao Recomendada

As features sao independentes entre si, exceto:
- **Feature E (recibos)** depende de **Feature B (PDFKit)** estar instalado (Task B1).

Ordem sugerida:
1. Feature C (Swagger) — rapida, melhora DX imediatamente
2. Feature D (Cancelamento) — alto impacto, sem dependencias externas
3. Feature B (Atestados/PDF) — instala PDFKit que Feature E usa
4. Feature A (Dashboard metricas) — instala Recharts, cria graficos
5. Feature E (Historico pagamentos) — reutiliza PDFKit da Feature B
