# 📄 Task Detail: Ajustes SQLite (schema) e build Nest

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: Oracle, TechLead, BackendDev
- **Status**: Concluído

## 📋 Contexto da demanda
`prisma db push` falhava no SQLite com `enum Role` (conector não suporta enum). O `nest build` incluía `*.spec.ts` e quebrava por falta de tipos Jest no grafo de compilação.

## 🚀 Ações executadas
- Remoção do bloco `enum Role` do `schema.prisma` (papel permanece como `String` em `User`).
- Criação de `tsconfig.build.json` excluindo `**/*.spec.ts` e `test/`; `nest-cli.json` com `tsConfigPath` apontando para ele.
- Correções pontuais: `RolesGuard` (comparação `user.role === role`), `VideoController` usando `AppointmentService.findById`, import Twilio via default export.

## 📂 Artefatos alterados
- `apps/api/prisma/schema.prisma`
- `apps/api/tsconfig.build.json`
- `apps/api/nest-cli.json`
- `apps/api/src/auth/roles.guard.ts`
- `apps/api/src/video/video.controller.ts`
- `apps/api/src/video/video.service.ts`
- `apps/api/src/appointment/appointment.service.ts`

## ✅ Resultado e próximos passos
Build da API estável; Prisma sincroniza com SQLite. Manter enums apenas quando migrar para PostgreSQL, se desejado.
