# 📄 Task Detail: Busca de Especialistas (API e UI)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev, FrontendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Uma funcionalidade central da plataforma é permitir que o paciente encontre médicos para agendamento. É necessário um endpoint de busca e uma interface no dashboard do paciente para listar os médicos disponíveis.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação do desenvolvimento da busca ao BackendDev e FrontendDev.
2. **API de Busca**: Criado o endpoint `/profile/doctors` com filtro opcional por especialidade.
3. **Persistência**: Implementada query no `ProfileService` usando Prisma para listar médicos e seus dados de usuário.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-doctor-search.md` (Criado)
- `apps/api/src/profile/profile.controller.ts` (Atualizado)
- `apps/api/src/profile/profile.service.ts` (Atualizado)

## 💡 Decisões Técnicas
- **Data Exposure**: O endpoint de busca retorna apenas dados públicos do médico (nome, especialidade) e seus dados de perfil para segurança.
- **Filtering**: Implementado filtro básico via Query Param.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Criar a interface de busca no Dashboard do Paciente.
2. Implementar a seleção de horário e reserva (Appointment).
3. Integrar Gateway de Pagamento no fluxo de reserva.
