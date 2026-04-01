# 📄 Task Detail: Implementação de JWT e RBAC Guard

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev, QASpecialist
- **Status**: Em Execução

## 📋 Contexto da Demanda
Após validar a lógica básica de RBAC no `AuthService`, o próximo passo é implementar a segurança de rotas real usando JWT (JSON Web Tokens) e um Guard do NestJS que valide os papéis (Roles) do usuário.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação da implementação de segurança para o BackendDev.
2. **Ciclo TDD (AuthGuard)**:
   - **RED**: Escrita de teste para o `RolesGuard` garantindo que usuários sem o papel correto recebam 403 Forbidden.
   - **GREEN**: Implementação do `RolesGuard` e integração com a estratégia JWT.
3. **Configuração de Segredos**: Definição (mock) das chaves JWT para o ambiente de desenvolvimento.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado - Horários removidos)
- `logs/task-20260331-jwt-rbac.md` (Criado)
- `apps/api/src/auth/roles.guard.ts` (Criado)
- `apps/api/src/auth/roles.decorator.ts` (Criado)
- `apps/api/src/auth/auth.controller.ts` (Criado)

## 💡 Decisões Técnicas
- **JWT Strategy**: Uso do `@nestjs/jwt` para consistência.
- **Decorators**: Criação do decorator `@Roles()` para marcar rotas protegidas de forma declarativa.

## ✅ Resultado e Próximos Passos
### Resultado:
Guard e Decorators implementados e integrados ao AuthController.

### Próximos Passos:
1. Criar testes de integração para validar o bloqueio/liberação de rotas baseadas em roles.
2. Simular tokens JWT para os testes.
