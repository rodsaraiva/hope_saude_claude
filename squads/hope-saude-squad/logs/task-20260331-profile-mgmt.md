# 📄 Task Detail: Gestão de Perfis e Disponibilidade Médica

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Com a autenticação concluída, agora o sistema deve permitir que médicos e pacientes configurem seus perfis específicos. O médico deve, em especial, ser capaz de definir sua agenda de disponibilidades para consultas futuras.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação do desenvolvimento de perfis ao BackendDev.
2. **Criação do ProfileService**: Implementada lógica para criação e consulta de `DoctorProfile` e `PatientProfile`.
3. **Endpoints de Perfil**: Criados endpoints para setup inicial e consulta de perfil próprio (`/profile/me`).
4. **Gestão de Agenda**: Implementado endpoint `/profile/doctor/availability` para que o médico defina seus horários disponíveis.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-profile-mgmt.md` (Criado)
- `apps/api/src/profile/profile.service.ts` (Criado)
- `apps/api/src/profile/profile.controller.ts` (Criado)
- `apps/api/src/profile/profile.module.ts` (Criado)
- `apps/api/src/app.module.ts` (Atualizado)

## 💡 Decisões Técnicas
- **Schema Separation**: Uso de tabelas separadas (`DoctorProfile`, `PatientProfile`) relacionadas à tabela `User` para clareza e extensibilidade.
- **Availability Storage**: Armazenamento da agenda como string/JSON no SQLite para flexibilidade inicial.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Iniciar o desenvolvimento do Frontend (Setup do Next.js).
2. Criar telas de login e dashboards básicos consumindo o novo backend.
3. Implementar lógica de busca de médicos pelo paciente.
