# 📄 Task Detail: Segurança de Senhas e Hash com Bcrypt

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Garantir a segurança dos dados sensíveis dos usuários (pacientes e médicos) através da criptografia de senhas no banco de dados. Senhas em texto plano são proibidas por políticas de segurança.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação da implementação de segurança de senhas ao BackendDev.
2. **Integração de Bcrypt**: Adicionado o `bcrypt` para realizar o hashing de senhas durante o registro.
3. **Validação de Login**: Implementado o método `validateUser` no `AuthService` para comparar senhas durante o processo de autenticação.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-password-security.md` (Criado)
- `apps/api/src/auth/auth.service.ts` (Atualizado)

## 💡 Decisões Técnicas
- **Salting**: Uso de um salt factor de 10 (padrão seguro e performático).
- **Security First**: Senhas nunca devem ser persistidas ou trafegadas em texto plano.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar o endpoint de Login (`POST /auth/login`) que retorna o JWT.
2. Finalizar a integração do `Passport` para autenticação baseada em estratégia JWT.
