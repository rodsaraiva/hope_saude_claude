# 📄 Task Detail: Fluxo de Reserva no Frontend

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, FrontendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Após o core de agendamentos no backend, é necessário permitir que o paciente realize a reserva através da interface. O paciente deve ser capaz de ver a lista de médicos, selecionar um e solicitar um horário.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação da integração da reserva ao FrontendDev.
2. **Integração de Listagem**: Dashboard do paciente agora lista médicos reais do banco.
3. **Fluxo de Reserva**: Implementada a função `handleBook` que envia a solicitação de agendamento para a API.
4. **Histórico de Consultas**: Adicionada a visualização das consultas já marcadas (histórico/pendentes) no dashboard.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-appointments-ui.md` (Criado)
- `apps/web/src/app/dashboard/patient/page.tsx` (Atualizado)

## 💡 Decisões Técnicas
- **Simplicidade Inicial**: Uso de `prompt` para entrada de data simplificada para o MVP.
- **Real-time Refresh**: Recarregamento da página após agendamento para refletir novos estados (futuramente será via estado global/SWR).

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar a confirmação de consulta no Painel do Médico.
2. Integrar o pagamento (Stripe) para automatizar a mudança de status.
3. Iniciar o desenvolvimento da sala de Videochamada (WebRTC).
