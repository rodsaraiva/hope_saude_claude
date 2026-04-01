# 📄 Task Detail: Autenticação JWT e Login Endpoint

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Finalizar o sistema de autenticação permitindo que usuários cadastrados realizem login e recebam um token JWT. Esse token será utilizado para autorizar o acesso às rotas protegidas por papéis (RBAC).

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação da integração JWT ao BackendDev.
2. **Setup do JWT Strategy**: Implementada a estratégia Passport para validar tokens bearer.
3. **Endpoint de Login**: Criado o método `login` no `AuthController` que valida credenciais e emite o token.
4. **Proteção de Rotas**: Atualizados os guards dos perfis para exigir tanto o JWT válido quanto o papel correto.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-jwt-login.md` (Criado)
- `apps/api/src/auth/jwt.strategy.ts` (Criado)
- `apps/api/src/auth/auth.service.ts` (Atualizado)
- `apps/api/src/auth/auth.controller.ts` (Atualizado)
- `apps/api/src/auth/auth.module.ts` (Atualizado)

## 💡 Decisões Técnicas
- **Stateless Auth**: O sistema não armazena sessões no servidor, confiando na assinatura do JWT.
- **Expiration**: Tokens configurados com expiração de 60 minutos para segurança.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar o gerenciamento de perfis específicos (DoctorProfile e PatientProfile).
2. Criar endpoints para o médico definir sua agenda de disponibilidades.
3. Iniciar o desenvolvimento do Frontend para consumir essas APIs.
