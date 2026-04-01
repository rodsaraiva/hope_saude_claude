# 📄 Task Detail: Padronização 100% TDD (Unit & Integration)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, QASpecialist, TechLead
- **Status**: Em Execução

## 📋 Contexto da Demanda
O projeto ainda não estava com 100% de cobertura de testes unitários para todos os serviços e guards. É necessário garantir que todos os componentes de negócio (Auth, Profile, Appointment) tenham seus respectivos arquivos `.spec.ts` para conformidade total com o TDD.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Auditoria de arquivos de teste e identificação de lacunas.
2. **Reforço de Testes Unitários**:
   - Criado `roles.guard.spec.ts` para validar autorização RBAC.
   - Criado `profile.service.spec.ts` para validar criação de perfis e disponibilidades.
   - Criado `appointment.service.spec.ts` para validar lógica de agendamento e status.
3. **Escrita de Testes E2E Pesados**: O script `full-flow.e2e.spec.ts` já garante a integração ponta a ponta.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-tdd-compliance.md` (Criado)
- `apps/api/src/auth/roles.guard.spec.ts` (Criado)
- `apps/api/src/profile/profile.service.spec.ts` (Criado)
- `apps/api/src/appointment/appointment.service.spec.ts` (Criado)

## 💡 Decisões Técnicas
- **Mocking Strategy**: Uso de Jest Mocks para isolar os serviços das dependências de banco de dados (Prisma) durante os testes unitários.
- **Coverage First**: Prioridade para o core da aplicação (Auth e Negócio).

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Adicionar testes unitários para `PaymentService` e `VideoService`.
2. Rodar todos os testes (`npm test`) para garantir que o projeto está 100% verde.
3. Integrar com o pipeline de CI para bloquear commits sem testes.
