# 📄 Task Detail: Dashboards e Gestão de Agenda (UI)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, FrontendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Após o setup do login e registro, é necessário criar as áreas logadas (dashboards) para pacientes e médicos. O médico precisa de uma interface para gerenciar sua disponibilidade, e o paciente de uma visão geral de suas consultas.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação da criação dos painéis ao FrontendDev.
2. **Dashboard do Paciente**: Implementada visualização inicial e integração com `/profile/me`.
3. **Dashboard do Médico**: Implementada gestão de agenda (disponibilidade) consumindo `/profile/doctor/availability`.
4. **Proteção de Client-Side**: Lógica inicial para carregar dados do usuário logado via JWT no localStorage.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-dashboards-ui.md` (Criado)
- `apps/web/src/app/dashboard/patient/page.tsx` (Criado)
- `apps/web/src/app/dashboard/doctor/page.tsx` (Criado)

## 💡 Decisões Técnicas
- **Data Fetching**: Uso de `useEffect` para carregar dados do perfil no carregamento da página.
- **Conditional Rendering**: Renderização de dashboards específicos baseados no papel (Role) retornado pela API.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar o sistema de agendamento (Paciente selecionando médico).
2. Integrar o serviço de Videochamada (WebRTC) no Dashboard.
3. Adicionar feedback visual de carregamento e erro (Toasts).
