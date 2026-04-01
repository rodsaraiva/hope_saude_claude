# 📄 Task Detail: Agendamento de Consultas (Core)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Com os perfis de médico e paciente operacionais, o próximo passo é permitir que o paciente realize o agendamento de uma consulta. É necessário um modelo de dados para `Appointment` e endpoints para criação e listagem dessas consultas.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação do core de agendamentos ao BackendDev.
2. **Modelagem Prisma**: Adicionado o modelo `Appointment` ao schema do banco de dados.
3. **Serviço de Agendamento**: Criado o `AppointmentService` para gerenciar a lógica de criação e atualização de status (PENDING, CONFIRMED).
4. **Endpoints de Agenda**: Implementada a API `/appointments` para permitir reservas e visualização de consultas marcadas.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-appointments-core.md` (Criado)
- `apps/api/prisma/schema.prisma` (Atualizado)
- `apps/api/src/appointment/` (Pasta e arquivos criados)
- `apps/api/src/app.module.ts` (Atualizado)

## 💡 Decisões Técnicas
- **Status Lifecycle**: As consultas iniciam como `PENDING` e aguardam confirmação do médico ou pagamento.
- **Relacionamentos**: Uso de IDs para referenciar `patientId` e `doctorId` garantindo integridade.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar a interface de agendamento no Frontend (calendário de horários).
2. Integrar o fluxo de pagamento para mudar o status de `PENDING` para `CONFIRMED`.
3. Implementar notificações para o médico quando houver novo agendamento.
