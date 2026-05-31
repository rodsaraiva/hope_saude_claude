# Produto (Atestados, Métricas, Recibos), Busca e Limpeza de Repo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as features de produto de longo prazo (atestados/declarações em PDF com encriptação LGPD, dashboard de métricas, histórico de pagamentos/recibos), completar lacunas pontuais do Swagger, definir a estratégia de busca em prontuário encriptado e limpar o scaffolding AIOS do repositório de produto.

**Architecture:** Cada feature de API segue o padrão NestJS já existente (Controller + Service + DTO + specs) com TDD red→green→refactor. `Certificate` herda o mesmo modelo de segurança do `MedicalRecord`: `content` e `cid` encriptados em repouso via `CryptographyService` (AES-256-GCM) e assinatura digital via DI token `'SignatureProvider'` (`LacunaProvider`). O frontend usa páginas `'use client'` do Next.js 15 App Router + hooks TanStack Query. A limpeza move o scaffolding `squads/` para fora da árvore de produto e conserta o encoding do `SQUAD_LOG.md`.

**Tech Stack:** NestJS 11, Prisma 5 (SQLite), Next.js 15, React 19, TanStack Query 5, Tailwind CSS 3, PDFKit (novo), Recharts (novo), class-validator, @nestjs/swagger, Jest (ts-jest, isolatedModules).

---

## Contexto e correções sobre o plano anterior

Este plano **reaproveita e corrige** `docs/superpowers/plans/2026-04-09-features-bundle.md`. As correções obrigatórias frente àquele plano são:

1. **Path errado** — o plano antigo usava `/root/hope_saude/...` (inexistente). Aqui **tudo** usa `/root/rodrigo/hope_saude/...`.
2. **Specs já existentes** — `apps/api/src/payment/payment.service.spec.ts`, `apps/api/src/payment/payment.controller.spec.ts` e `apps/api/src/appointment/appointment.controller.spec.ts` **já existem** no repo. O plano antigo marcava algumas como "Create". Aqui são **Modify** (adicionar `describe` novos, sem recriar o arquivo).
3. **Gap LGPD do `Certificate`** — a auditoria apontou que `content`/`cid` do atestado contêm PHI (CID-10, motivo clínico). Este plano **encripta `content` e `cid` em repouso** via `CryptographyService`, exatamente como `MedicalRecordService` faz (`encryptNullable`/`decryptNullable`), e decripta antes de gerar PDF ou assinar.
4. **Token de assinatura** — a interface real é `SignatureProvider` em `apps/api/src/common/signature.provider.ts` (`sign(content: string, authData: any): Promise<SignatureResult>` com `{ signature, hash, signatureDate, signerInfo? }`). Não existe `signature-provider.interface`.
5. **Escopo do Swagger reduzido** — Swagger já está montado em `main.ts`/`/api/docs`. Só faltam DTOs formais e `@ApiResponse` pontuais.

**Prioridade de valor:**
- **Valor clínico/fiscal (fazer):** Feature B (Atestados — valor clínico + LGPD) e Feature E (Recibos — reembolso/IR).
- **Nice-to-have pós-MVP:** Feature A (Dashboard de métricas) e Feature C (Swagger). Marcadas como opcionais; podem ser puladas sem bloquear o release.
- **Decisão de arquitetura:** Tarefa de busca (Task S1) e limpeza de repo (Tasks L1-L2).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/package.json` | Adicionar `pdfkit` + `@types/pdfkit` |
| Modify | `apps/web/package.json` | Adicionar `recharts` (Feature A, opcional) |
| Modify | `apps/api/prisma/schema.prisma` | Model `Certificate` + relações em `User` |
| Create | `apps/api/src/certificate/dto/create-certificate.dto.ts` | DTO de criação validado |
| Create | `apps/api/src/certificate/pdf/certificate-pdf.generator.ts` | Gerador de PDF (PDFKit) |
| Create | `apps/api/src/certificate/pdf/certificate-pdf.generator.spec.ts` | Testes do gerador |
| Create | `apps/api/src/certificate/certificate.service.ts` | CRUD + encriptação + assinatura |
| Create | `apps/api/src/certificate/certificate.service.spec.ts` | Testes do service |
| Create | `apps/api/src/certificate/certificate.controller.ts` | Endpoints HTTP |
| Create | `apps/api/src/certificate/certificate.controller.spec.ts` | Testes do controller |
| Create | `apps/api/src/certificate/certificate.module.ts` | NestJS module |
| Modify | `apps/api/src/app.module.ts` | Importar `CertificateModule` |
| Modify | `apps/api/src/main.ts` | Tag Swagger `certificate` |
| Modify | `apps/api/src/payment/payment.service.ts` | `getPaymentHistory()` + `PrismaService` no construtor |
| Modify | `apps/api/src/payment/payment.service.spec.ts` | `describe('getPaymentHistory')` + `PrismaService` provider |
| Modify | `apps/api/src/payment/payment.module.ts` | Registrar `PrismaService` |
| Create | `apps/api/src/payment/pdf/receipt-pdf.generator.ts` | Gerador de recibo PDF |
| Create | `apps/api/src/payment/pdf/receipt-pdf.generator.spec.ts` | Testes do gerador de recibo |
| Modify | `apps/api/src/payment/payment.controller.ts` | `GET /payments/history` + recibo PDF |
| Modify | `apps/api/src/payment/payment.controller.spec.ts` | `describe('getPaymentHistory')` |
| Modify | `apps/api/src/clinical-scale/clinical-scale.service.ts` | `getEvolution()` (Feature A) |
| Modify | `apps/api/src/clinical-scale/clinical-scale.service.spec.ts` | `describe('getEvolution')` |
| Modify | `apps/api/src/clinical-scale/clinical-scale.controller.ts` | `GET /clinical-scales/patient/:id/evolution` |
| Create | `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts` | Testes do controller (não existe ainda) |
| Create | `apps/api/src/clinical-scale/dto/create-scale.dto.ts` | DTO Swagger (Feature C) |
| Create | `apps/api/src/clinical-scale/dto/submit-answers.dto.ts` | DTO Swagger (Feature C) |
| Modify | `apps/web/src/lib/query/query-keys.ts` | Chaves `clinicalScales` + `payments` |
| Create | `apps/web/src/lib/query/use-clinical-scales.ts` | Hook de evolução |
| Create | `apps/web/src/lib/query/use-payment-history.ts` | Hook de histórico |
| Create | `apps/web/src/components/clinical-scales/ScaleEvolutionChart.tsx` | Gráfico Recharts |
| Create | `apps/web/src/app/dashboard/patient/escalas/page.tsx` | Página de escalas |
| Create | `apps/web/src/app/dashboard/patient/pagamentos/page.tsx` | Página de pagamentos |
| Modify | `README.md` | Documentar decisão de busca em prontuário |
| Move | `squads/` → `docs/process/squads/` (fora da árvore de produto via git mv) | Limpeza scaffolding AIOS |
| Modify | `SQUAD_LOG.md` | Reescrever em UTF-8 + stack real (LiveKit/Asaas) |

---

## Tasks

> Ordem por dependência e valor: **B → E** (valor clínico/fiscal; E reusa o PDFKit instalado em B), depois **S** (decisão de busca), depois **L** (limpeza), por fim **A → C** (nice-to-have, opcionais).

---

### Task B1: Instalar PDFKit na API

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Instalar pdfkit e tipos**

```bash
cd /root/rodrigo/hope_saude/apps/api && npm install pdfkit && npm install -D @types/pdfkit
```

- [ ] **Step 2: Verificar instalação**

```bash
cd /root/rodrigo/hope_saude/apps/api && node -e "require('pdfkit'); console.log('OK')"
```
Saída esperada: `OK`

- [ ] **Step 3: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/package.json apps/api/package-lock.json
git commit -m "chore(api): adiciona pdfkit para gerar atestados e recibos em PDF"
```

---

### Task B2: Prisma — model `Certificate`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Adicionar relações no model `User`**

Em `apps/api/prisma/schema.prisma`, dentro do model `User`, após `doctorPrescriptions  Prescription[] @relation("DoctorPrescriptions")` adicione:

```prisma
  patientCertificates Certificate[] @relation("PatientCertificates")
  doctorCertificates  Certificate[] @relation("DoctorCertificates")
```

- [ ] **Step 2: Adicionar o model `Certificate`**

No fim de `apps/api/prisma/schema.prisma`, antes do model `EmailOutbox`, adicione:

```prisma
/// Atestados e declarações médicas emitidos pelo médico.
/// LGPD: `content` e `cid` contêm PHI e são encriptados em repouso (AES-256-GCM),
/// igual ao MedicalRecord. Nunca persistir/ler esses campos em texto puro.
model Certificate {
  id            Int      @id @default(autoincrement())
  patientId     Int
  patient       User     @relation("PatientCertificates", fields: [patientId], references: [id])
  doctorId      Int
  doctor        User     @relation("DoctorCertificates", fields: [doctorId], references: [id])
  appointmentId Int?
  type          String   // ATESTADO | DECLARACAO
  content       String   // PHISIGNED encriptado em repouso (AES-256-GCM)
  daysOff       Int?     // Dias de afastamento (apenas atestado)
  cid           String?  // CID-10 encriptado em repouso (opcional, com consentimento)
  status        String   @default("DRAFT") // DRAFT | SIGNED
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Assinatura digital (mesmo shape de MedicalRecord)
  signature     String?
  signatureDate DateTime?
  signedHash    String?

  @@index([patientId, createdAt])
  @@index([doctorId, patientId])
}
```

- [ ] **Step 3: Rodar migration**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx prisma migrate dev --name add-certificate-model
```
Saída esperada: `Your database is now in sync with your schema.` e o Prisma Client regenerado.

- [ ] **Step 4: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/prisma/
git commit -m "feat(api): model Certificate para atestados/declaracoes (content/cid encriptados)"
```

---

### Task B3: Gerador de PDF do atestado (TDD)

**Files:**
- Create: `apps/api/src/certificate/pdf/certificate-pdf.generator.spec.ts`
- Create: `apps/api/src/certificate/pdf/certificate-pdf.generator.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/src/certificate/pdf/certificate-pdf.generator.spec.ts`:

```typescript
import { generateCertificatePdf } from './certificate-pdf.generator';

describe('generateCertificatePdf', () => {
  it('deve retornar um Buffer de PDF valido para ATESTADO com daysOff e cid', async () => {
    const buffer = await generateCertificatePdf({
      type: 'ATESTADO',
      doctorName: 'Dr. Joao Silva',
      doctorCrm: 'CRM/SP 123456',
      patientName: 'Maria Souza',
      content: 'Atesto para os devidos fins que a paciente esteve em consulta.',
      daysOff: 3,
      cid: 'F32.1',
      date: new Date('2026-04-09'),
      signed: true,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('deve gerar PDF de DECLARACAO sem daysOff nem cid', async () => {
    const buffer = await generateCertificatePdf({
      type: 'DECLARACAO',
      doctorName: 'Dr. Joao Silva',
      doctorCrm: 'CRM/SP 123456',
      patientName: 'Maria Souza',
      content: 'Declaro que a paciente compareceu a consulta.',
      date: new Date('2026-04-09'),
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate-pdf.generator.spec --no-coverage
```
Saída esperada: FAIL — `Cannot find module './certificate-pdf.generator'`.

- [ ] **Step 3: Implementação mínima**

Crie `apps/api/src/certificate/pdf/certificate-pdf.generator.ts`:

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

    doc.fontSize(10).text('Hope Saude - Plataforma de Telepsiquiatria', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).text(`Paciente: ${input.patientName}`);
    doc.moveDown(1);

    doc.text(input.content, { align: 'justify', lineGap: 6 });
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

    doc.moveDown(2);
    doc.text(formattedDate, { align: 'right' });

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

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate-pdf.generator.spec --no-coverage
```
Saída esperada: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/certificate/pdf/
git commit -m "feat(api): generateCertificatePdf gera atestado/declaracao em PDF (PDFKit)"
```

---

### Task B4: `CertificateService` com encriptação e assinatura (TDD)

**Files:**
- Create: `apps/api/src/certificate/certificate.service.spec.ts`
- Create: `apps/api/src/certificate/certificate.service.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/src/certificate/certificate.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';

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

  const mockCrypto = {
    encryptNullable: jest.fn((v: string | null | undefined) =>
      v === null || v === undefined ? null : `ENC(${v})`,
    ),
    decryptNullable: jest.fn((v: string | null | undefined) =>
      v === null || v === undefined ? null : String(v).replace(/^ENC\((.*)\)$/, '$1'),
    ),
  };

  const mockSignature = {
    sign: jest.fn().mockResolvedValue({
      signature: 'sig-abc',
      hash: 'hash-abc',
      signatureDate: new Date('2026-04-09T10:00:00.000Z'),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptographyService, useValue: mockCrypto },
        { provide: 'SignatureProvider', useValue: mockSignature },
      ],
    }).compile();

    service = module.get<CertificateService>(CertificateService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve encriptar content e cid antes de persistir e decriptar no retorno', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.certificate.create.mockResolvedValue({
        id: 1,
        doctorId: 1,
        patientId: 2,
        type: 'ATESTADO',
        content: 'ENC(Atesto que a paciente...)',
        cid: 'ENC(F32.1)',
        daysOff: 3,
        status: 'DRAFT',
      });

      const result = await service.create({
        doctorId: 1,
        patientId: 2,
        type: 'ATESTADO',
        content: 'Atesto que a paciente...',
        cid: 'F32.1',
        daysOff: 3,
      });

      expect(mockCrypto.encryptNullable).toHaveBeenCalledWith('Atesto que a paciente...');
      expect(mockCrypto.encryptNullable).toHaveBeenCalledWith('F32.1');
      expect(mockPrisma.certificate.create).toHaveBeenCalledWith({
        data: {
          doctorId: 1,
          patientId: 2,
          type: 'ATESTADO',
          content: 'ENC(Atesto que a paciente...)',
          appointmentId: undefined,
          daysOff: 3,
          cid: 'ENC(F32.1)',
          status: 'DRAFT',
        },
      });
      expect(result.content).toBe('Atesto que a paciente...');
      expect(result.cid).toBe('F32.1');
    });

    it('deve rejeitar se medico nao tem relacao com paciente', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ doctorId: 1, patientId: 99, type: 'ATESTADO', content: 'Texto' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllByPatient', () => {
    it('deve listar certificados decriptados filtrados por medico', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([
        { id: 1, content: 'ENC(a)', cid: 'ENC(F1)' },
        { id: 2, content: 'ENC(b)', cid: null },
      ]);

      const result = await service.findAllByPatient(2, 1);

      expect(mockPrisma.certificate.findMany).toHaveBeenCalledWith({
        where: { patientId: 2, doctorId: 1 },
        orderBy: { createdAt: 'desc' },
      });
      expect(result[0].content).toBe('a');
      expect(result[0].cid).toBe('F1');
      expect(result[1].cid).toBeNull();
    });
  });

  describe('findOne', () => {
    it('deve lancar NotFoundException se nao encontrar', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(null);

      await expect(service.findOne(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('deve lancar ForbiddenException se medico nao e dono', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue({ id: 1, doctorId: 99, content: 'ENC(x)' });

      await expect(service.findOne(1, 1)).rejects.toThrow(ForbiddenException);
    });

    it('deve retornar certificado decriptado para o dono', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 1,
        content: 'ENC(prontuario)',
        cid: 'ENC(F32)',
      });

      const result = await service.findOne(1, 1);

      expect(result.content).toBe('prontuario');
      expect(result.cid).toBe('F32');
    });
  });

  describe('sign', () => {
    it('deve assinar usando o content decriptado e persistir status SIGNED', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 1,
        patientId: 2,
        type: 'ATESTADO',
        content: 'ENC(Atesto...)',
        cid: null,
        status: 'DRAFT',
        createdAt: new Date('2026-04-09T09:00:00.000Z'),
      });
      mockPrisma.certificate.update.mockResolvedValue({
        id: 1,
        doctorId: 1,
        status: 'SIGNED',
        content: 'ENC(Atesto...)',
        cid: null,
      });

      const result = await service.sign(1, 1);

      expect(mockSignature.sign).toHaveBeenCalledWith(
        expect.stringContaining('Atesto...'),
        undefined,
      );
      expect(mockPrisma.certificate.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'SIGNED',
          signature: 'sig-abc',
          signatureDate: new Date('2026-04-09T10:00:00.000Z'),
          signedHash: 'hash-abc',
        },
      });
      expect(result.status).toBe('SIGNED');
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.service.spec --no-coverage
```
Saída esperada: FAIL — `Cannot find module './certificate.service'`.

- [ ] **Step 3: Implementação mínima**

Crie `apps/api/src/certificate/certificate.service.ts`:

```typescript
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';
import { SignatureProvider } from '../common/signature.provider';

/**
 * CertificateService.
 *
 * LGPD: `content` e `cid` carregam PHI (texto clínico, CID-10). São encriptados
 * em repouso via AES-256-GCM (CryptographyService) — toda leitura passa por
 * decryptOne() antes de devolver. A assinatura digital exige o conteúdo em texto
 * puro, portanto sign() decripta antes de chamar o signatureProvider.
 */
@Injectable()
export class CertificateService {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptographyService,
    @Inject('SignatureProvider') private signatureProvider: SignatureProvider,
  ) {}

  /** Decripta content e cid de um certificado. Retorna o objeto modificado. */
  private decryptOne<
    T extends { content?: string | null; cid?: string | null } | null,
  >(cert: T): T {
    if (!cert) return cert;
    return {
      ...cert,
      content: this.cryptoService.decryptNullable(cert.content),
      cid: this.cryptoService.decryptNullable(cert.cid),
    } as T;
  }

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
        'Você não possui consultas prévias com este paciente.',
      );
    }

    const created = await this.prisma.certificate.create({
      data: {
        doctorId: data.doctorId,
        patientId: data.patientId,
        type: data.type,
        content: this.cryptoService.encryptNullable(data.content) as string,
        appointmentId: data.appointmentId,
        daysOff: data.daysOff,
        cid: this.cryptoService.encryptNullable(data.cid),
        status: 'DRAFT',
      },
    });

    return this.decryptOne(created);
  }

  async findAllByPatient(patientId: number, doctorId?: number) {
    const where: { patientId: number; doctorId?: number } = { patientId };
    if (doctorId !== undefined) where.doctorId = doctorId;
    const certs = await this.prisma.certificate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return certs.map((c) => this.decryptOne(c));
  }

  async findOne(doctorId: number, certificateId: number) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
    });
    if (!cert) throw new NotFoundException('Certificado não encontrado.');
    if (cert.doctorId !== doctorId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este certificado.',
      );
    }
    return this.decryptOne(cert);
  }

  async sign(doctorId: number, certificateId: number, authData?: unknown) {
    // findOne já decripta content/cid — fluxo correto para alimentar a assinatura.
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

    const updated = await this.prisma.certificate.update({
      where: { id: certificateId },
      data: {
        status: 'SIGNED',
        signature: result.signature,
        signatureDate: result.signatureDate,
        signedHash: result.hash,
      },
    });

    return this.decryptOne(updated);
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.service.spec --no-coverage
```
Saída esperada: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/certificate/certificate.service.ts apps/api/src/certificate/certificate.service.spec.ts
git commit -m "feat(api): CertificateService com content/cid encriptados (AES-256-GCM) e assinatura"
```

---

### Task B5: DTO de criação de atestado

**Files:**
- Create: `apps/api/src/certificate/dto/create-certificate.dto.ts`

- [ ] **Step 1: Criar o DTO**

Crie `apps/api/src/certificate/dto/create-certificate.dto.ts`:

```typescript
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCertificateDto {
  @ApiProperty({ example: 2, description: 'ID do paciente' })
  @IsInt()
  patientId!: number;

  @ApiProperty({ enum: ['ATESTADO', 'DECLARACAO'], example: 'ATESTADO' })
  @IsEnum(['ATESTADO', 'DECLARACAO'], {
    message: 'Tipo deve ser ATESTADO ou DECLARACAO',
  })
  type!: 'ATESTADO' | 'DECLARACAO';

  @ApiProperty({ example: 'Atesto que a paciente esteve em consulta médica.' })
  @IsString()
  @IsNotEmpty({ message: 'O conteúdo é obrigatório' })
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

- [ ] **Step 2: Verificar compilação (type-check do arquivo)**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i certificate || echo "sem erros em certificate"
```
Saída esperada: `sem erros em certificate`.

- [ ] **Step 3: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/certificate/dto/
git commit -m "feat(api): CreateCertificateDto validado para emissao de atestados"
```

---

### Task B6: `CertificateController` (TDD)

**Files:**
- Create: `apps/api/src/certificate/certificate.controller.spec.ts`
- Create: `apps/api/src/certificate/certificate.controller.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/src/certificate/certificate.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { PrismaService } from '../prisma.service';

describe('CertificateController', () => {
  let controller: CertificateController;

  const mockService = {
    create: jest.fn(),
    findAllByPatient: jest.fn(),
    findOne: jest.fn(),
    sign: jest.fn(),
  };

  const mockPrisma = { user: { findUnique: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificateController],
      providers: [
        { provide: CertificateService, useValue: mockService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<CertificateController>(CertificateController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar certificado como medico injetando o doctorId da sessao', async () => {
      const req = { user: { userId: 1, role: 'DOCTOR' } } as any;
      const body = { patientId: 2, type: 'ATESTADO' as const, content: 'Texto', daysOff: 3 };
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

  describe('listByPatient', () => {
    it('deve rejeitar paciente lendo certificados de outro paciente', async () => {
      const req = { user: { userId: 3, role: 'PATIENT' } } as any;

      await expect(controller.listByPatient(req, '2')).rejects.toThrow(ForbiddenException);
    });

    it('deve listar com doctorId quando medico', async () => {
      const req = { user: { userId: 1, role: 'DOCTOR' } } as any;
      mockService.findAllByPatient.mockResolvedValue([{ id: 1 }]);

      await controller.listByPatient(req, '2');

      expect(mockService.findAllByPatient).toHaveBeenCalledWith(2, 1);
    });
  });

  describe('sign', () => {
    it('deve rejeitar paciente assinando', async () => {
      const req = { user: { userId: 2, role: 'PATIENT' } } as any;

      await expect(controller.sign(req, '1')).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.controller.spec --no-coverage
```
Saída esperada: FAIL — `Cannot find module './certificate.controller'`.

- [ ] **Step 3: Implementação mínima**

Crie `apps/api/src/certificate/certificate.controller.ts`:

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
import type { Response } from 'express';
import { AuthenticatedRequest } from '../auth/authenticated-request';
import { PrismaService } from '../prisma.service';
import { CertificateService } from './certificate.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { generateCertificatePdf } from './pdf/certificate-pdf.generator';

@ApiTags('certificate')
@ApiBearerAuth('JWT')
@Controller('certificates')
@UseGuards(AuthGuard('jwt'))
export class CertificateController {
  constructor(
    private readonly service: CertificateService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Médico cria atestado ou declaração' })
  @Post()
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateCertificateDto,
  ) {
    if (req.user.role !== 'DOCTOR') {
      throw new ForbiddenException('Apenas médicos podem emitir certificados.');
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
      throw new ForbiddenException('Você só pode ver seus próprios certificados.');
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
      throw new ForbiddenException('Apenas médicos podem gerar PDF.');
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
      doctorName: doctor?.name ?? 'Médico',
      doctorCrm: doctor?.doctorProfile?.crm ? `CRM ${doctor.doctorProfile.crm}` : '',
      patientName: patient?.name ?? 'Paciente',
      content: cert.content ?? '',
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
      throw new ForbiddenException('Apenas médicos podem assinar certificados.');
    }
    return this.service.sign(req.user.userId, parseInt(idParam, 10));
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate.controller.spec --no-coverage
```
Saída esperada: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/certificate/certificate.controller.ts apps/api/src/certificate/certificate.controller.spec.ts
git commit -m "feat(api): CertificateController (create/list/pdf/sign) com RBAC por role"
```

---

### Task B7: `CertificateModule` + registro no `AppModule` e Swagger

**Files:**
- Create: `apps/api/src/certificate/certificate.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Criar o module**

Crie `apps/api/src/certificate/certificate.module.ts` (mesma estrutura de providers do `MedicalRecordModule`):

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';
import { LacunaProvider } from '../common/lacuna.provider';

@Module({
  controllers: [CertificateController],
  providers: [
    CertificateService,
    PrismaService,
    CryptographyService,
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

- [ ] **Step 2: Registrar no `AppModule`**

Em `apps/api/src/app.module.ts`, adicione o import no topo:

```typescript
import { CertificateModule } from './certificate/certificate.module';
```

E adicione `CertificateModule` ao array `imports` do `@Module`.

- [ ] **Step 3: Adicionar tag no Swagger**

Em `apps/api/src/main.ts`, localize a configuração do `DocumentBuilder` (cadeia de `.addTag(...)`) e adicione, após a tag `prescription`:

```typescript
.addTag('certificate', 'Atestados e declarações médicas')
```

- [ ] **Step 4: Rodar a suíte do módulo + smoke de boot**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest certificate --no-coverage
```
Saída esperada: PASS (todas as suítes de `certificate`).

```bash
cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit -p tsconfig.json && echo "BUILD OK"
```
Saída esperada: `BUILD OK` (sem erros de tipo no novo módulo).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/certificate/certificate.module.ts apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "feat(api): registra CertificateModule no AppModule + tag Swagger"
```

---

### Task E1: `PaymentService.getPaymentHistory` (TDD — modifica spec existente)

**Files:**
- Modify: `apps/api/src/payment/payment.service.spec.ts`
- Modify: `apps/api/src/payment/payment.service.ts`
- Modify: `apps/api/src/payment/payment.module.ts`

> Nota: `payment.service.spec.ts` **já existe**. Os mocks atuais (`AsaasService`, `AppointmentService`, repos) já estão no `providers`. Adicione **apenas** o mock de `PrismaService` e o novo `describe`.

- [ ] **Step 1: Adicionar mock de PrismaService e o teste que falha**

Em `apps/api/src/payment/payment.service.spec.ts`, adicione o import:

```typescript
import { PrismaService } from '../prisma.service';
```

No objeto de mocks (junto dos outros, ex. `mockAsaas`), adicione:

```typescript
  const mockPrisma = {
    appointment: { findMany: jest.fn() },
  };
```

No array `providers` do `Test.createTestingModule`, adicione:

```typescript
        { provide: PrismaService, useValue: mockPrisma },
```

E adicione, dentro do `describe('PaymentService', ...)`, o novo bloco:

```typescript
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
        where: { patientId: 5, paymentId: { not: null } },
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.service.spec --no-coverage -t "getPaymentHistory"
```
Saída esperada: FAIL — `service.getPaymentHistory is not a function` (ou erro de DI por `PrismaService` ainda não estar no construtor).

- [ ] **Step 3: Implementação mínima**

Em `apps/api/src/payment/payment.service.ts`, adicione o import:

```typescript
import { PrismaService } from '../prisma.service';
```

Adicione `private prisma: PrismaService` ao final do construtor (após `doctorProfileRepo`):

```typescript
  constructor(
    private asaasService: AsaasService,
    private appointmentService: AppointmentService,
    private patientProfileRepo: PatientProfileRepository,
    private doctorProfileRepo: DoctorProfileRepository,
    private prisma: PrismaService,
  ) {}
```

Adicione o método (após `confirmPayment`):

```typescript
  /** Histórico de pagamentos do paciente (consultas com paymentId). Para reembolso/IR. */
  async getPaymentHistory(patientId: number) {
    return this.prisma.appointment.findMany({
      where: { patientId, paymentId: { not: null } },
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

Em `apps/api/src/payment/payment.module.ts`, garanta que `PrismaService` esteja no array `providers` (adicione `PrismaService` ao import e à lista se ainda não estiver).

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.service.spec --no-coverage
```
Saída esperada: PASS (todos os testes da suíte, incluindo os 2 novos).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/payment/payment.service.ts apps/api/src/payment/payment.service.spec.ts apps/api/src/payment/payment.module.ts
git commit -m "feat(api): PaymentService.getPaymentHistory para reembolso/IR"
```

---

### Task E2: Gerador de recibo PDF (TDD)

**Files:**
- Create: `apps/api/src/payment/pdf/receipt-pdf.generator.spec.ts`
- Create: `apps/api/src/payment/pdf/receipt-pdf.generator.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/src/payment/pdf/receipt-pdf.generator.spec.ts`:

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

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest receipt-pdf.generator.spec --no-coverage
```
Saída esperada: FAIL — `Cannot find module './receipt-pdf.generator'`.

- [ ] **Step 3: Implementação mínima**

Crie `apps/api/src/payment/pdf/receipt-pdf.generator.ts`:

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

    doc.fontSize(10).text('Hope Saude - Plataforma de Telepsiquiatria', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(18).text('RECIBO DE PAGAMENTO', { align: 'center' });
    doc.moveDown(2);

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

    doc.moveDown(3);
    doc.fontSize(9).text(
      `Documento gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}.`,
      { align: 'center' },
    );

    doc.end();
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest receipt-pdf.generator.spec --no-coverage
```
Saída esperada: PASS (1 teste).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/payment/pdf/
git commit -m "feat(api): generateReceiptPdf gera recibo de pagamento em PDF"
```

---

### Task E3: `PaymentController` — histórico + recibo (TDD — modifica spec existente)

**Files:**
- Modify: `apps/api/src/payment/payment.controller.spec.ts`
- Modify: `apps/api/src/payment/payment.controller.ts`

> Nota: `payment.controller.spec.ts` **já existe** com 3 testes (checkout/pix/confirm). O mock de `PaymentService` lá **não** inclui `getPaymentHistory`. Adicione o método ao mock e o novo `describe`.

- [ ] **Step 1: Adicionar ao mock e escrever o teste que falha**

Em `apps/api/src/payment/payment.controller.spec.ts`, adicione o import:

```typescript
import { ForbiddenException } from '@nestjs/common';
```

No `useValue` do provider `PaymentService`, adicione a função ao objeto:

```typescript
            getPaymentHistory: jest.fn(),
```

Adicione, dentro do `describe('PaymentController', ...)`, o novo bloco:

```typescript
  describe('getPaymentHistory', () => {
    it('deve retornar historico para paciente', async () => {
      const req = { user: { userId: 2, role: 'PATIENT' } };
      const history = [{ id: 1, price: 200 }];
      (paymentService.getPaymentHistory as jest.Mock).mockResolvedValue(history);

      const result = await controller.getPaymentHistory(req as any);

      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith(2);
      expect(result).toEqual(history);
    });

    it('deve rejeitar medico acessando historico de pagamentos', async () => {
      const req = { user: { userId: 1, role: 'DOCTOR' } };

      await expect(controller.getPaymentHistory(req as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.controller.spec --no-coverage -t "getPaymentHistory"
```
Saída esperada: FAIL — `controller.getPaymentHistory is not a function`.

- [ ] **Step 3: Implementação mínima**

Em `apps/api/src/payment/payment.controller.ts`, atualize os imports do `@nestjs/common` para incluir `ForbiddenException`, `NotFoundException` e `Res`:

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  Request,
  Res,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
```

Adicione, abaixo dos imports existentes:

```typescript
import type { Response } from 'express';
import { generateReceiptPdf } from './pdf/receipt-pdf.generator';
```

Adicione os métodos dentro da classe `PaymentController`. **Importante:** o `@Get('history')` precisa vir ANTES de qualquer rota `@Get(':paymentId')` para não colidir; coloque estes métodos logo após `getPixQrData`:

```typescript
  /** Histórico de pagamentos do paciente (reembolso/IR). */
  @Get('history')
  async getPaymentHistory(@Request() req: AuthenticatedRequest) {
    if (req.user.role !== 'PATIENT') {
      throw new ForbiddenException('Apenas pacientes acessam o histórico de pagamentos.');
    }
    return this.paymentService.getPaymentHistory(req.user.userId);
  }

  /** Download do recibo de uma consulta paga, em PDF. */
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
      (h) => h.id === parseInt(appointmentIdParam, 10),
    );
    if (!appointment) {
      throw new NotFoundException('Pagamento não encontrado.');
    }

    const buffer = await generateReceiptPdf({
      patientName: req.user.name ?? 'Paciente',
      doctorName: appointment.doctor?.name ?? 'Médico',
      date: new Date(appointment.date),
      price: appointment.price,
      durationMinutes: appointment.durationMinutes,
      paymentId: appointment.paymentId as string,
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

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest payment.controller.spec --no-coverage
```
Saída esperada: PASS (5 testes — os 3 antigos + 2 novos).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/payment/payment.controller.ts apps/api/src/payment/payment.controller.spec.ts
git commit -m "feat(api): GET /payments/history + download de recibo em PDF (RBAC paciente)"
```

---

### Task E4: Frontend — hook + página de histórico de pagamentos

**Files:**
- Modify: `apps/web/src/lib/query/query-keys.ts`
- Create: `apps/web/src/lib/query/use-payment-history.ts`
- Create: `apps/web/src/app/dashboard/patient/pagamentos/page.tsx`

- [ ] **Step 1: Adicionar query key**

Em `apps/web/src/lib/query/query-keys.ts`, adicione dentro do objeto `queryKeys`:

```typescript
  payments: {
    history: ['payments', 'history'] as const,
  },
```

- [ ] **Step 2: Criar o hook**

Crie `apps/web/src/lib/query/use-payment-history.ts`:

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

- [ ] **Step 3: Criar a página**

Crie `apps/web/src/app/dashboard/patient/pagamentos/page.tsx`:

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
        <p className="text-slate-400">Carregando histórico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-red-500">Erro ao carregar histórico de pagamentos.</p>
      </div>
    );
  }

  const payments = data ?? [];
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Histórico de Pagamentos</h1>
      <p className="mb-8 text-slate-500">Todas as suas transações na Hope Saúde.</p>

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
                <th className="px-4 py-3">Médico</th>
                <th className="px-4 py-3">Duração</th>
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
                        href={`${apiBase}/payments/history/${p.id}/receipt`}
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

- [ ] **Step 4: Rodar testes do web (sem regressão)**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx jest --no-coverage
```
Saída esperada: PASS (suíte do web verde — 183 testes / 40 suítes ou mais).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/lib/query/query-keys.ts apps/web/src/lib/query/use-payment-history.ts apps/web/src/app/dashboard/patient/pagamentos/
git commit -m "feat(web): pagina de historico de pagamentos com download de recibo PDF"
```

---

### Task S1: Decisão de busca em prontuário (documentar — fora de escopo de implementação agora)

> O `content` do prontuário é AES-256-GCM com IV aleatório (não determinístico), então `where: { content: { contains } }` não funciona. O README já registra isto como limitação. A migração para PostgreSQL (médio prazo, plano separado) traz FTS/blind-index nativos. **Decisão:** não implementar blind-index sobre SQLite agora (YAGNI antes da migração); apenas documentar o desenho-alvo para a migração. Nenhum código de produção é alterado.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Substituir o bullet de limitação por uma decisão de desenho**

Em `README.md`, localize o bloco em **Limitações conhecidas** que começa com `🔒 Busca por content em prontuários **desabilitada**` e substitua o parágrafo inteiro por:

```markdown
- 🔒 **Busca por conteúdo em prontuários** — desabilitada após a criptografia
  AES-256-GCM em repouso (IV aleatório torna `content` não pesquisável). O input
  de busca foi removido do `profile/page.tsx`.
  **Desenho-alvo (na migração para PostgreSQL):** blind-index determinístico
  apenas para termos **não sensíveis** (ex.: nome do paciente, tipo de documento)
  via HMAC-SHA256 (`CryptographyService.sign`) gravado em coluna lateral indexada;
  o `content` clínico permanece exclusivamente AES-256-GCM e nunca é tokenizado.
  Implementar blind-index sobre SQLite antes da migração é YAGNI — adiado.
```

- [ ] **Step 2: Verificar que o texto antigo sumiu**

```bash
cd /root/rodrigo/hope_saude && grep -c "Solução planejada: índice de busca server-side" README.md || echo "removido"
```
Saída esperada: `removido` (ou `0`).

- [ ] **Step 3: Commit**

```bash
cd /root/rodrigo/hope_saude && git add README.md
git commit -m "docs: registra desenho-alvo de busca (blind-index HMAC) para a migracao Postgres"
```

---

### Task L1: Mover scaffolding `squads/` para fora da árvore de produto

> `squads/` contém 118 arquivos rastreados de scaffolding AIOS (97 `.md`, 9 `.json`, 6 `.yaml`, 6 `.js`) em `squads/aios-forge-squad` e `squads/hope-saude-squad`. São artefatos de processo, não código de produto. Movemos para `docs/process/squads/` (com `git mv` para preservar histórico) e ignoramos artefatos voláteis (`logs/`).

**Files:**
- Move: `squads/` → `docs/process/squads/`
- Modify: `.gitignore`

- [ ] **Step 1: Criar destino e mover preservando histórico**

```bash
cd /root/rodrigo/hope_saude && mkdir -p docs/process && git mv squads docs/process/squads
```

- [ ] **Step 2: Ignorar logs voláteis do scaffolding**

Em `.gitignore`, adicione ao final:

```gitignore
# Scaffolding AIOS (processo, não produto) — logs voláteis
docs/process/squads/**/logs/
```

E remova do índice quaisquer logs já rastreados (mantém os arquivos em disco):

```bash
cd /root/rodrigo/hope_saude && git rm -r --cached --ignore-unmatch docs/process/squads/aios-forge-squad/logs docs/process/squads/hope-saude-squad/logs 2>/dev/null; echo "logs des-rastreados"
```

- [ ] **Step 3: Confirmar que a API e o Web não referenciam `squads/`**

```bash
cd /root/rodrigo/hope_saude && grep -rIl "squads/" apps/ 2>/dev/null || echo "nenhuma referencia em apps/"
```
Saída esperada: `nenhuma referencia em apps/`.

- [ ] **Step 4: Verificar que os testes seguem verdes (nada de produto quebrou)**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage 2>&1 | tail -5
```
Saída esperada: `Tests: ... passed` sem falhas.

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add .gitignore && git commit -m "chore: move scaffolding AIOS squads/ para docs/process/ e ignora logs volateis"
```

---

### Task L2: Corrigir `SQUAD_LOG.md` (UTF-8 + stack real)

> O arquivo está em ISO-8859 (mojibake: "Integra��o", "verifica��o peri�dica") e menciona "WebRTC via socket.io" — a stack real de vídeo é **LiveKit** e a de pagamentos é **Asaas**. Reescrever em UTF-8 com a stack correta.

**Files:**
- Modify: `SQUAD_LOG.md`

- [ ] **Step 1: Confirmar o encoding atual (mojibake)**

```bash
cd /root/rodrigo/hope_saude && file SQUAD_LOG.md
```
Saída esperada: `SQUAD_LOG.md: ISO-8859 text`.

- [ ] **Step 2: Reescrever em UTF-8 com a stack correta**

Substitua todo o conteúdo de `SQUAD_LOG.md` por (UTF-8):

```markdown
# Squad Log — Hope Saúde

Registro de marcos de implementação por squad. Documento de processo (não produto).

- **[Feature] Videochamada (telepsiquiatria)** — integração com **LiveKit**
  (geração de token server-side em `video/`, sala por consulta), consumida pelo
  Next.js. Cobertura TDD.
- **[Feature] Pagamentos com Asaas** — `AsaasService` (PIX + cartão de crédito via
  `fetch`) + checkout único (`PendingCheckout`); a consulta só é criada após o
  pagamento confirmar. UI de redirecionamento PIX no frontend. Cobertura TDD.
- **[Feature] Reconciliação de pagamentos (cron)** — verificação periódica do
  status Asaas via `@nestjs/schedule`, convertendo `PendingCheckout` em
  `Appointment` confirmado. Cobertura TDD.
```

- [ ] **Step 3: Confirmar que agora é UTF-8 e sem mojibake**

```bash
cd /root/rodrigo/hope_saude && file SQUAD_LOG.md && grep -c "" SQUAD_LOG.md && grep -c "socket.io\|WebRTC\|�" SQUAD_LOG.md || echo "limpo"
```
Saída esperada: `SQUAD_LOG.md: UTF-8 Unicode text` e `limpo` (zero ocorrências de socket.io/WebRTC/replacement char).

- [ ] **Step 4: Commit**

```bash
cd /root/rodrigo/hope_saude && git add SQUAD_LOG.md
git commit -m "docs: reescreve SQUAD_LOG em UTF-8 com stack real (LiveKit/Asaas)"
```

---

### Task A1 (opcional, nice-to-have): Instalar Recharts no frontend

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar recharts**

```bash
cd /root/rodrigo/hope_saude/apps/web && npm install recharts
```

- [ ] **Step 2: Verificar**

```bash
cd /root/rodrigo/hope_saude/apps/web && node -e "require('recharts'); console.log('OK')"
```
Saída esperada: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): adiciona recharts para graficos de evolucao de escalas"
```

---

### Task A2 (opcional): `ClinicalScaleService.getEvolution` (TDD)

**Files:**
- Modify: `apps/api/src/clinical-scale/clinical-scale.service.spec.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.service.ts`

- [ ] **Step 1: Escrever o teste que falha**

No `apps/api/src/clinical-scale/clinical-scale.service.spec.ts`, dentro do `describe('ClinicalScaleService', ...)` já existente, adicione (garanta que o mock de `clinicalScale` tenha `findMany: jest.fn()`):

```typescript
  describe('getEvolution', () => {
    it('deve retornar escalas COMPLETED agrupadas por tipo', async () => {
      const scales = [
        { id: 1, type: 'PHQ9', totalScore: 12, severity: 'moderada', completedAt: new Date('2026-03-01') },
        { id: 2, type: 'PHQ9', totalScore: 8, severity: 'leve', completedAt: new Date('2026-04-01') },
        { id: 3, type: 'GAD7', totalScore: 15, severity: 'grave', completedAt: new Date('2026-03-15') },
      ];
      mockPrisma.clinicalScale.findMany.mockResolvedValue(scales);

      const result = await service.getEvolution(2, 1);

      expect(mockPrisma.clinicalScale.findMany).toHaveBeenCalledWith({
        where: { patientId: 2, doctorId: 1, status: 'COMPLETED' },
        orderBy: { completedAt: 'asc' },
        select: { id: true, type: true, totalScore: true, severity: true, completedAt: true },
      });
      expect(result.PHQ9).toHaveLength(2);
      expect(result.GAD7).toHaveLength(1);
    });

    it('deve retornar objeto vazio se nao houver escalas completadas', async () => {
      mockPrisma.clinicalScale.findMany.mockResolvedValue([]);

      const result = await service.getEvolution(2, 1);

      expect(result).toEqual({});
    });
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.service.spec --no-coverage -t "getEvolution"
```
Saída esperada: FAIL — `service.getEvolution is not a function`.

- [ ] **Step 3: Implementação mínima**

Em `apps/api/src/clinical-scale/clinical-scale.service.ts`, adicione dentro da classe `ClinicalScaleService`:

```typescript
  /** Escalas completadas agrupadas por tipo, para gráficos de evolução longitudinal. */
  async getEvolution(patientId: number, doctorId?: number) {
    const scales = await this.prisma.clinicalScale.findMany({
      where: { patientId, doctorId, status: 'COMPLETED' },
      orderBy: { completedAt: 'asc' },
      select: { id: true, type: true, totalScore: true, severity: true, completedAt: true },
    });

    const grouped: Record<string, typeof scales> = {};
    for (const scale of scales) {
      (grouped[scale.type] ??= []).push(scale);
    }
    return grouped;
  }
```

> Nota: quando `doctorId` é `undefined`, o Prisma ignora o filtro `doctorId: undefined` (comportamento padrão), retornando todas as escalas do paciente — o que é o desejado para o caso "paciente vê as próprias".

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.service.spec --no-coverage -t "getEvolution"
```
Saída esperada: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/clinical-scale/clinical-scale.service.ts apps/api/src/clinical-scale/clinical-scale.service.spec.ts
git commit -m "feat(api): ClinicalScaleService.getEvolution agrupa escalas por tipo"
```

---

### Task A3 (opcional): Controller de evolução (TDD — cria spec do controller)

**Files:**
- Create: `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.controller.ts`

> Não existe `clinical-scale.controller.spec.ts` ainda. Antes de escrever, **abra `apps/api/src/clinical-scale/clinical-scale.controller.ts`** para copiar exatamente o `providers`/imports usados (token do guard, nome injetado do service). O teste abaixo isola o controller com mock do service.

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/api/src/clinical-scale/clinical-scale.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ClinicalScaleController } from './clinical-scale.controller';
import { ClinicalScaleService } from './clinical-scale.service';

describe('ClinicalScaleController — getEvolution', () => {
  let controller: ClinicalScaleController;

  const mockService = {
    getEvolution: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClinicalScaleController],
      providers: [{ provide: ClinicalScaleService, useValue: mockService }],
    }).compile();

    controller = module.get<ClinicalScaleController>(ClinicalScaleController);
    jest.clearAllMocks();
  });

  it('deve chamar service.getEvolution com doctorId para medico', async () => {
    const req = { user: { userId: 1, role: 'DOCTOR' } } as any;
    mockService.getEvolution.mockResolvedValue({ PHQ9: [{ id: 1 }] });

    const result = await controller.getEvolution(req, '2');

    expect(mockService.getEvolution).toHaveBeenCalledWith(2, 1);
    expect(result).toEqual({ PHQ9: [{ id: 1 }] });
  });

  it('deve permitir paciente ver a propria evolucao (doctorId undefined)', async () => {
    const req = { user: { userId: 2, role: 'PATIENT' } } as any;
    mockService.getEvolution.mockResolvedValue({});

    await controller.getEvolution(req, '2');

    expect(mockService.getEvolution).toHaveBeenCalledWith(2, undefined);
  });

  it('deve rejeitar paciente vendo evolucao de outro paciente', async () => {
    const req = { user: { userId: 3, role: 'PATIENT' } } as any;

    await expect(controller.getEvolution(req, '2')).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.controller.spec --no-coverage
```
Saída esperada: FAIL — `controller.getEvolution is not a function` (ou erro de compilação por método ausente).

- [ ] **Step 3: Implementação mínima**

Em `apps/api/src/clinical-scale/clinical-scale.controller.ts`, garanta os imports `ForbiddenException`, `Get`, `Param`, `Request`, `UseGuards` (do `@nestjs/common`), `AuthGuard` (de `@nestjs/passport`), `AuthenticatedRequest` (de `../auth/authenticated-request`) e `ApiBearerAuth`/`ApiOperation` (de `@nestjs/swagger`). Adicione o método **ANTES** de qualquer rota `@Get(':id')` existente (para que `patient` não seja capturado como `:id`):

```typescript
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Evolução longitudinal das escalas de um paciente (agrupadas por tipo)' })
  @UseGuards(AuthGuard('jwt'))
  @Get('patient/:patientId/evolution')
  async getEvolution(
    @Request() req: AuthenticatedRequest,
    @Param('patientId') patientIdParam: string,
  ) {
    const patientId = parseInt(patientIdParam, 10);
    if (req.user.role === 'PATIENT' && req.user.userId !== patientId) {
      throw new ForbiddenException('Você só pode ver suas próprias escalas.');
    }
    const doctorId = req.user.role === 'DOCTOR' ? req.user.userId : undefined;
    return this.service.getEvolution(patientId, doctorId);
  }
```

> Confirme o nome real do service injetado no construtor do controller (ex.: `private readonly service: ClinicalScaleService`). Ajuste `this.service` para o identificador real, se diferente.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale.controller.spec --no-coverage
```
Saída esperada: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/clinical-scale/clinical-scale.controller.ts apps/api/src/clinical-scale/clinical-scale.controller.spec.ts
git commit -m "feat(api): GET /clinical-scales/patient/:id/evolution com RBAC por role"
```

---

### Task A4 (opcional): Frontend — hook, gráfico e página de escalas

**Files:**
- Modify: `apps/web/src/lib/query/query-keys.ts`
- Create: `apps/web/src/lib/query/use-clinical-scales.ts`
- Create: `apps/web/src/components/clinical-scales/ScaleEvolutionChart.tsx`
- Create: `apps/web/src/app/dashboard/patient/escalas/page.tsx`

- [ ] **Step 1: Adicionar query key**

Em `apps/web/src/lib/query/query-keys.ts`, adicione dentro do objeto `queryKeys`:

```typescript
  clinicalScales: {
    evolution: (patientId: number) => ['clinical-scales', 'evolution', patientId] as const,
  },
```

- [ ] **Step 2: Criar o hook**

Crie `apps/web/src/lib/query/use-clinical-scales.ts`:

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
    queryKey: queryKeys.clinicalScales.evolution(patientId ?? -1),
    queryFn: () =>
      api.get<ScaleEvolutionData>(`/clinical-scales/patient/${patientId}/evolution`),
    enabled: patientId !== undefined,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: Criar o componente de gráfico**

Crie `apps/web/src/components/clinical-scales/ScaleEvolutionChart.tsx`:

```tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ScaleDataPoint } from '../../lib/query/use-clinical-scales';

interface Props {
  scaleType: string;
  dataPoints: ScaleDataPoint[];
}

const SCALE_CONFIG: Record<string, { label: string; maxScore: number; color: string }> = {
  PHQ9: { label: 'PHQ-9 (Depressão)', maxScore: 27, color: '#0284c7' },
  GAD7: { label: 'GAD-7 (Ansiedade)', maxScore: 21, color: '#059669' },
  AUDIT: { label: 'AUDIT (Álcool)', maxScore: 40, color: '#d97706' },
  MOCA: { label: 'MoCA (Cognitivo)', maxScore: 30, color: '#7c3aed' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function ScaleEvolutionChart({ scaleType, dataPoints }: Props) {
  const config =
    SCALE_CONFIG[scaleType] ?? {
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

  const last = dataPoints[dataPoints.length - 1];

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
        {dataPoints.length} avaliação(ões) — último score: {last.totalScore} ({last.severity})
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Criar a página**

Crie `apps/web/src/app/dashboard/patient/escalas/page.tsx`:

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
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Minhas Escalas Clínicas</h1>
      <p className="mb-8 text-slate-500">
        Acompanhe a evolução dos seus scores ao longo do tempo.
      </p>

      {scaleTypes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          Nenhuma escala completada ainda. Seu médico pode aplicar escalas durante as consultas.
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

- [ ] **Step 5: Type-check e testes do web**

```bash
cd /root/rodrigo/hope_saude/apps/web && npx tsc --noEmit && npx jest --no-coverage 2>&1 | tail -5
```
Saída esperada: type-check sem erros; suíte do web verde.

- [ ] **Step 6: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/web/src/lib/query/query-keys.ts apps/web/src/lib/query/use-clinical-scales.ts apps/web/src/components/clinical-scales/ apps/web/src/app/dashboard/patient/escalas/
git commit -m "feat(web): dashboard de evolucao de escalas clinicas (Recharts)"
```

---

### Task C1 (opcional): DTOs formais de ClinicalScale para Swagger

**Files:**
- Create: `apps/api/src/clinical-scale/dto/create-scale.dto.ts`
- Create: `apps/api/src/clinical-scale/dto/submit-answers.dto.ts`
- Modify: `apps/api/src/clinical-scale/clinical-scale.controller.ts`

> Antes de editar o controller, **leia `apps/api/src/clinical-scale/clinical-scale.controller.ts`** para ver as assinaturas inline reais (`@Body() body: { ... }`). Troque-as pelos DTOs sem alterar comportamento.

- [ ] **Step 1: Criar `CreateScaleDto`**

Crie `apps/api/src/clinical-scale/dto/create-scale.dto.ts`:

```typescript
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScaleDto {
  @ApiProperty({ example: 2, description: 'ID do paciente' })
  @IsInt()
  patientId!: number;

  @ApiProperty({ enum: ['PHQ9', 'GAD7', 'AUDIT', 'MOCA'], example: 'PHQ9' })
  @IsEnum(['PHQ9', 'GAD7', 'AUDIT', 'MOCA'], {
    message: 'Tipo deve ser PHQ9, GAD7, AUDIT ou MOCA',
  })
  type!: string;

  @ApiProperty({ required: false, example: 'Paciente relata piora recente' })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 2: Criar `SubmitAnswersDto`**

Crie `apps/api/src/clinical-scale/dto/submit-answers.dto.ts`:

```typescript
import { IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitAnswersDto {
  @ApiProperty({
    type: [Number],
    example: [0, 1, 2, 3, 0, 1, 2, 1, 0],
    description: 'Array de respostas numéricas',
  })
  @IsArray()
  @IsInt({ each: true })
  answers!: number[];
}
```

- [ ] **Step 3: Trocar os tipos inline no controller pelos DTOs**

Em `apps/api/src/clinical-scale/clinical-scale.controller.ts`, adicione os imports:

```typescript
import { CreateScaleDto } from './dto/create-scale.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
```

Substitua o parâmetro inline do método de criação (`@Body() body: { patientId: number; type: ...; notes?: string }`) por `@Body() body: CreateScaleDto`, e o de submissão (`@Body() body: { answers: number[] }`) por `@Body() body: SubmitAnswersDto`. Não altere o corpo dos métodos.

- [ ] **Step 4: Rodar todos os testes de clinical-scale (sem regressão)**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest clinical-scale --no-coverage
```
Saída esperada: PASS (todas as suítes de clinical-scale, incluindo as criadas nas Tasks A2/A3).

- [ ] **Step 5: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/clinical-scale/dto/ apps/api/src/clinical-scale/clinical-scale.controller.ts
git commit -m "docs(api): DTOs formais de ClinicalScale para enriquecer Swagger"
```

---

### Task C2 (opcional): `@ApiResponse` em controllers existentes

**Files:**
- Modify: `apps/api/src/appointment/appointment.controller.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`

> Antes de editar, **leia ambos os controllers** para confirmar os nomes dos métodos (`getMyAppointments`, `register`, `login`, `me`). Apenas adicione decorators — sem mudar comportamento.

- [ ] **Step 1: `AppointmentController`**

Em `apps/api/src/appointment/appointment.controller.ts`, garanta o import:

```typescript
import { ApiResponse } from '@nestjs/swagger';
```

E adicione ao `getMyAppointments`:

```typescript
  @ApiResponse({ status: 200, description: 'Lista de consultas' })
  @ApiResponse({ status: 401, description: 'Token JWT inválido ou ausente' })
```

- [ ] **Step 2: `AuthController`**

Em `apps/api/src/auth/auth.controller.ts`, garanta o import de `ApiResponse` e adicione:

- em `register`: `@ApiResponse({ status: 201, description: 'Usuário registrado com sucesso' })` e `@ApiResponse({ status: 409, description: 'E-mail já cadastrado' })`;
- em `login`: `@ApiResponse({ status: 200, description: 'Login bem-sucedido, retorna access_token' })` e `@ApiResponse({ status: 401, description: 'Credenciais inválidas' })`;
- em `me`: `@ApiResponse({ status: 200, description: 'Dados do usuário logado' })`.

- [ ] **Step 3: Rodar a suíte completa da API (sem regressão)**

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage 2>&1 | tail -5
```
Saída esperada: `Tests: ... passed`, sem falhas.

- [ ] **Step 4: Commit**

```bash
cd /root/rodrigo/hope_saude && git add apps/api/src/appointment/appointment.controller.ts apps/api/src/auth/auth.controller.ts
git commit -m "docs(api): ApiResponse decorators em Appointment e Auth controllers"
```

---

## Checklist Final

Após as tasks de valor (B, E, S, L) e — se executadas — as opcionais (A, C):

```bash
cd /root/rodrigo/hope_saude/apps/api && npx jest --no-coverage 2>&1 | tail -5
cd /root/rodrigo/hope_saude/apps/web && npx jest --no-coverage 2>&1 | tail -5
cd /root/rodrigo/hope_saude/apps/api && npx tsc --noEmit -p tsconfig.json && echo "API BUILD OK"
```
Esperado: API ≥ 241 testes verdes + novas suítes; Web ≥ 183 verdes; build sem erros.

---

## Self-Review

**Cobertura dos gaps do escopo:**

1. **Reaproveitar/corrigir o plano antigo** — feito: todas as Tasks usam `/root/rodrigo/hope_saude` (path antigo `/root/hope_saude` eliminado); specs já existentes (`payment.service.spec`, `payment.controller.spec`, `appointment.controller.spec`) tratadas como **Modify** com instruções de "adicionar `describe`/mock" em vez de recriar.
2. **Feature B com encriptação (gap LGPD)** — `CertificateService` encripta `content` e `cid` via `CryptographyService.encryptNullable` e decripta via `decryptNullable` (Tasks B2-B7), espelhando `MedicalRecordService`; `sign()` opera sobre o conteúdo já decriptado. Provider de assinatura usa o token real `'SignatureProvider'` (`LacunaProvider`), interface `SignatureProvider` de `../common/signature.provider`.
3. **Feature A (Dashboard de métricas + Recharts)** — Tasks A1-A4, marcadas **opcional/nice-to-have**; `getEvolution` agrupa por tipo; controller com RBAC; gráfico Recharts + página.
4. **Feature E (Histórico/recibos para reembolso/IR)** — Tasks E1-E4; `getPaymentHistory` (Prisma, filtra `paymentId != null`), recibo PDF reusa PDFKit da Feature B, controller com RBAC paciente, página web com link de download.
5. **Feature C (Swagger reduzido)** — Tasks C1-C2, **opcional**; só DTOs faltantes + `@ApiResponse` (Swagger já existe em `main.ts`).
6. **Busca em prontuário** — Task S1: **documentada como fora de escopo agora** (YAGNI antes da migração Postgres), com desenho-alvo de blind-index HMAC apenas para termos não sensíveis; `content` permanece AES-256-GCM. Nenhum código de produção alterado.
7. **Limpeza** — Task L1 move `squads/` (118 arquivos) para `docs/process/squads/` via `git mv` (preserva histórico) + `.gitignore` para logs; Task L2 reescreve `SQUAD_LOG.md` em UTF-8 com stack real (LiveKit/Asaas), removendo a menção incorreta a "WebRTC via socket.io".

**Marcação de prioridade** — B/E marcadas como valor clínico/fiscal e ordenadas primeiro; A/C explicitamente "(opcional, nice-to-have)" no título e na nota de ordem.

**Ausência de placeholders** — todos os passos de código trazem blocos completos (DTO, service, controller, module, geradores PDF, hooks, componentes, páginas). Tipos referenciados existem no repo (`CryptographyService`, `SignatureProvider`, `PrismaService`, `AuthenticatedRequest`, `LacunaProvider`) ou são definidos nas próprias Tasks (`CertificatePdfInput`, `ReceiptPdfInput`, `CreateCertificateDto`, `ScaleDataPoint`). Sem "TODO", "implementar depois" ou "similar à Task N".

**Pontos que exigem verificação durante a execução (não placeholders, mas confirmação de nomes reais):**
- Identificador do service injetado em `clinical-scale.controller.ts` (`this.service` vs outro nome) — Task A3 instrui a confirmar.
- Posição relativa das rotas `@Get('history')` antes de `@Get(':paymentId')` e `@Get('patient/:id/evolution')` antes de `@Get(':id')` — alertado nas Tasks E3 e A3.
- Conteúdo inline real dos `@Body()` no `clinical-scale.controller.ts` — Task C1 instrui a ler antes de trocar.
