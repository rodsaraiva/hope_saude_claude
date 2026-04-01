# 🧪 Estratégia TDD e Plano de Testes (MVP)

## Frameworks
- **Testes Unitários/Integração**: Jest + Supertest (Backend) / Vitest + Testing Library (Frontend).
- **E2E**: Playwright (Simulação completa de agendamento e vídeo).

## Fluxo de Trabalho
1. **Red**: Escrever o teste para o requisito (ex: "Deve permitir que o médico cadastre horários"). O teste deve falhar.
2. **Green**: Escrever o código mínimo necessário para o teste passar.
3. **Refactor**: Otimizar o código mantendo o teste passando.

## Prioridade de Testes para o MVP
1. Autenticação e Perfis (RBAC).
2. Fluxo de Criação de Disponibilidade (Médico).
3. Fluxo de Agendamento e Pagamento (Paciente).
4. Estabilidade da Conexão WebRTC.
