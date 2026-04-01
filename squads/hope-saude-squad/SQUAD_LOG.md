# 📜 SQUAD_LOG (Hope Saúde) — Índice executivo

Visão macro das demandas. Detalhes técnicos obrigatórios em `logs/task-YYYYMMDD-identificador.md` (usar `logs/template.md`).

**Regra:** nenhuma entrega é considerada encerrada sem linha neste índice **e** arquivo de detalhe correspondente. O **OracleCoordinator** consolida o registro; especialistas entregam resumo ao Oracle ao finalizar trabalho.

| Data | Tarefa macro | Agente(s) | Status | Detalhamento |
|------|--------------|-----------|--------|--------------|
| 2026-03-31 | Setup inicial do squad | Forge | Concluído | [detalhe](logs/task-20260331-initial-setup.md) |
| 2026-03-31 | Adição de QA e PO | Forge | Concluído | [detalhe](logs/task-20260331-qa-po-addition.md) |
| 2026-03-31 | Governança em 2 camadas e modelo com coordenador | Forge | Concluído | [detalhe](logs/task-20260331-governance-setup.md) |
| 2026-03-31 | Início do projeto MVP | Oracle, PO, TechLead, QA | Concluído | [detalhe](logs/task-20260331-mvp-start.md) |
| 2026-03-31 | Benchmark telemedicina (PO) | Oracle, PO | Concluído | [detalhe](logs/task-20260331-benchmark-execution.md) |
| 2026-03-31 | Arquitetura e estratégia de testes | Oracle, TechLead, QA | Concluído | [detalhe](logs/task-20260331-arch-qa-planning.md) |
| 2026-03-31 | Backend: auth e RBAC (TDD) | Oracle, BackendDev, QA | Concluído | [detalhe](logs/task-20260331-backend-auth.md) |
| 2026-03-31 | JWT e RolesGuard | Oracle, BackendDev, QA | Concluído | [detalhe](logs/task-20260331-jwt-rbac.md) |
| 2026-03-31 | Testes de integração auth/RBAC | Oracle, BackendDev, QA | Concluído | [detalhe](logs/task-20260331-auth-integration.md) |
| 2026-03-31 | Prisma e persistência (SQLite) | Oracle, BackendDev | Concluído | [detalhe](logs/task-20260331-prisma-setup.md) |
| 2026-03-31 | Persistência no AuthService | Oracle, BackendDev, QA | Concluído | [detalhe](logs/task-20260331-backend-persistence.md) |
| 2026-03-31 | Endpoint de registro | Oracle, BackendDev, QA | Concluído | [detalhe](logs/task-20260331-auth-register.md) |
| 2026-03-31 | Hash de senha (bcrypt) | Oracle, BackendDev | Concluído | [detalhe](logs/task-20260331-password-security.md) |
| 2026-03-31 | Login JWT e estratégia Passport | Oracle, BackendDev | Concluído | [detalhe](logs/task-20260331-jwt-login.md) |
| 2026-03-31 | Perfis, disponibilidade e módulo Profile | Oracle, BackendDev | Concluído | [detalhe](logs/task-20260331-profile-mgmt.md) |
| 2026-03-31 | Frontend Next.js (login/register) | Oracle, FrontendDev | Concluído | [detalhe](logs/task-20260331-frontend-init.md) |
| 2026-03-31 | Dashboards paciente e médico | Oracle, FrontendDev | Concluído | [detalhe](logs/task-20260331-dashboards-ui.md) |
| 2026-03-31 | Busca de médicos (API + UI) | Oracle, BackendDev, FrontendDev | Concluído | [detalhe](logs/task-20260331-doctor-search.md) |
| 2026-03-31 | Agendamentos — API | Oracle, BackendDev | Concluído | [detalhe](logs/task-20260331-appointments-core.md) |
| 2026-03-31 | Agendamentos — UI paciente | Oracle, FrontendDev | Concluído | [detalhe](logs/task-20260331-appointments-ui.md) |
| 2026-03-31 | Confirmação de consulta (UI médico) | Oracle, FrontendDev | Concluído | [detalhe](logs/task-20260331-doctor-confirm.md) |
| 2026-03-31 | Pagamentos — integração Stripe (MVP) | Oracle, BackendDev | Concluído | [detalhe](logs/task-20260331-stripe-integration.md) |
| 2026-03-31 | Vídeo — token e API (Twilio) | Oracle, BackendDev | Concluído | [detalhe](logs/task-20260331-video-infra.md) |
| 2026-03-31 | Vídeo — sala no frontend | Oracle, FrontendDev | Concluído | [detalhe](logs/task-20260331-video-ui.md) |
| 2026-03-31 | Encerramento MVP v1 (escopo macro) | Oracle, Squad | Concluído | [detalhe](logs/task-20260331-mvp-v1.md) |
| 2026-03-31 | E2E pesados (Playwright) | Oracle, TechLead, QA | Concluído | [detalhe](logs/task-20260331-rigorous-tests.md) |
| 2026-03-31 | Conformidade TDD — specs adicionais | Oracle, TechLead, QA | Concluído | [detalhe](logs/task-20260331-tdd-compliance.md) |
| 2026-03-31 | Ambiente local (monorepo, npm, Prisma db push) | Oracle, TechLead | Concluído | [detalhe](logs/task-20260331-local-infra.md) |
| 2026-03-31 | Ajustes SQLite (schema sem enum) e build Nest | Oracle, TechLead, BackendDev | Concluído | [detalhe](logs/task-20260331-sqlite-schema-build-fix.md) |
| 2026-03-31 | Landing page (home marketing) | Oracle, TechLead, FrontendDev | Concluído | [detalhe](logs/task-20260331-landing-page.md) |
| 2026-03-31 | Sincronização SQUAD_LOG com repositório de logs | Oracle, TechLead | Concluído | [detalhe](logs/task-20260331-squad-log-reconciliation.md) |
| 2026-03-31 | Redirecionamento por papel (Fluxo pós-login) | Oracle, TechLead, FrontendDev | Concluído | [detalhe](logs/task-20260331-role-redirection.md) |
| 2026-03-31 | Setup de perfil obrigatório (Onboarding) | Oracle, TechLead, Squad | Concluído | [detalhe](logs/task-20260331-mandatory-setup.md) |
| 2026-03-31 | UI de Disponibilidade (Estilo Google Calendar) | Oracle, TechLead, FrontendDev | Concluído | [detalhe](logs/task-20260331-doctor-calendar-ui.md) |
| 2026-03-31 | Usabilidade Google Calendar (Click-to-create) | Oracle, TechLead, FrontendDev | Concluído | [detalhe](logs/task-20260331-doctor-calendar-usability.md) |
| 2026-03-31 | Agendamento baseado em disponibilidade (UI Paciente) | Oracle, TechLead, FrontendDev | Concluído | [detalhe](logs/task-20260331-patient-booking-ui.md) |
| 2026-03-31 | Simplificação do Onboarding de Pacientes | Oracle, TechLead, Squad | Concluído | [detalhe](logs/task-20260331-onboarding-simplification.md) |
| 2026-03-31 | Restauração da Infra de Testes e TDD | Oracle, TechLead, QA | Concluído | [detalhe](logs/task-20260401-tdd-restoration.md) |
| 2026-03-31 | Testes E2E Pesados e UI de Vídeo Profissional | Oracle, TechLead, QA | Concluído | [detalhe](logs/task-20260401-heavy-e2e-video-ui.md) |
| 2026-04-01 | Correção E2E: hidratação, guards e seleção de dados | Oracle, TechLead, QA | Concluído | [detalhe](logs/task-20260401-e2e-green.md) |
| 2026-04-01 | Implementação de Navbar Reutilizável (TDD) | Oracle, TechLead, QA | Concluído | [detalhe](logs/task-20260401-navbar-tdd.md) |
