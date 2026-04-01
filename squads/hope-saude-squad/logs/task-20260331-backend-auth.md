# 📄 Task Detail: Setup do Backend e Autenticação (TDD)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev, QASpecialist
- **Status**: Em Execução

## 📋 Contexto da Demanda
Após o planejamento de arquitetura e estratégia de testes, iniciamos a implementação do motor da plataforma. O foco inicial é o setup do repositório backend e o sistema de autenticação (RBAC) com suporte a pacientes e médicos, seguindo estritamente a metodologia TDD.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação do setup técnico para o BackendDev e supervisão do TDD pelo QASpecialist.
2. **Setup Técnico (BackendDev)**: Inicialização do projeto NestJS em `apps/api` e configuração de estrutura inicial.
3. **Primeiro Ciclo TDD (AuthService)**:
   - **RED**: Escrita do teste `auth.service.spec.ts` para validação de RBAC (DOCTOR vs PATIENT).
   - **GREEN**: Implementação do `auth.service.ts` com a lógica mínima de papéis.
4. **Escrita de Testes (QA/Dev)**: Criação dos primeiros testes unitários falhando (Red phase) para a lógica de criação de usuário com papéis (PATIENT, DOCTOR).

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado com horários corrigidos)
- `logs/task-20260331-backend-auth.md` (Criado e atualizado)
- `apps/api/src/auth/auth.service.spec.ts` (Criado)
- `apps/api/src/auth/auth.service.ts` (Criado)

## 💡 Decisões Técnicas
- **Autenticação**: Utilização de JWT para autenticação stateless.
- **RBAC**: Implementação via decorators nativos do NestJS para proteção de rotas.
- **TDD**: Garantia de que a cobertura de testes de domínio será de 100% no core de auth.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar o serviço de registro de usuários.
2. Implementar a lógica de login e geração de tokens.
3. Validar os testes em fase Green.
