# 📄 Task Detail: Restauração da Infra de Testes e TDD

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->
<!-- PLACEHOLDERS: Restauração da Infra de Testes e TDD, 2026-03-31, Oracle, TechLead, QA, Concluído, Contexto da demanda: corrigir a infraestrutura de testes que estava quebrada e garantir a conformidade com o TDD., Ações executadas: Adicionado scripts de teste ao package.json, configurado jest.config.js em apps/api, corrigido tsconfig.json para incluir tipos do jest, atualizado AuthService tests para cobrir nova lógica., Artefatos alterados: apps/api/package.json, apps/web/package.json, apps/api/tsconfig.json, apps/api/jest.config.js, apps/api/src/auth/auth.service.spec.ts, Decisões técnicas: Uso de ts-jest com isolatedModules para contornar problemas de tipagem em monorepo, centralização da configuração do jest no workspace da api., Resultado: 100% de aprovação nos testes do backend e infra pronta para novos testes., Próximos passos: Implementar testes e2e para o fluxo de agendamento simplificado. -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: Oracle, TechLead, QA
- **Status**: Concluído

## 📋 Contexto da Demanda
Após uma implementação rápida de simplificação de onboarding, o usuário questionou a falta de aderência ao TDD. Identificou-se que a infraestrutura de testes estava incompleta (faltavam scripts e configurações de Jest no monorepo), impedindo a execução correta das suítes de teste.

## 🚀 Ações Executadas
1. **Infraestrutura**: Adicionados scripts `"test"`, `"test:watch"` e `"test:cov"` no `package.json` da API.
2. **Configuração**: Criado `apps/api/jest.config.js` com suporte a `ts-jest` e mapeamento de arquivos `.ts`.
3. **Tipagem**: Atualizado `apps/api/tsconfig.json` para incluir explicitamente os tipos `@types/jest` e `@types/node`.
4. **TDD**: Reescrito `apps/api/src/auth/auth.service.spec.ts` para mockar `PrismaService` e `JwtService`, adicionando testes para a nova lógica de auto-criação de `PatientProfile` em `createUser`.
5. **Correção**: Corrigido erro de parsing do Jest ativando `isolatedModules: true` na configuração do `ts-jest`.

## 📂 Artefatos Alterados
- `apps/api/package.json`
- `apps/web/package.json`
- `apps/api/tsconfig.json`
- `apps/api/jest.config.js`
- `apps/api/src/auth/auth.service.spec.ts`

## 💡 Decisões Técnicas
- **Mocking**: Optou-se por mocks manuais do Prisma para garantir que os testes unitários sejam rápidos e independentes do banco de dados SQLite.
- **Isolated Modules**: Necessário para resolver conflitos de ambiente de execução do Jest em uma estrutura de monorepo npm onde a resolução de tipos pode ser ambígua.

## ✅ Resultado e Próximos Passos
Toda a suíte de testes do backend está passando (10 testes em 4 arquivos). O processo de TDD foi restaurado e validado.

**Próximos Passos:**
1. Manter a disciplina de escrever testes antes de qualquer nova funcionalidade.
2. Expandir a cobertura para o frontend (Jest/React Testing Library).
3. Executar os testes E2E com Playwright para validar o novo fluxo de login.
