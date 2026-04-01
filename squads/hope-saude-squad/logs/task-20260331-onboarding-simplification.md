# 📄 Task Detail: Simplificação do Onboarding de Pacientes

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->
<!-- PLACEHOLDERS: Simplificação do Onboarding de Pacientes, 2026-03-31, Oracle, TechLead, Squad, Concluído, Contexto da demanda: remover o segundo formulário de cadastro para pacientes e redirecionar para a home após o login., Ações executadas: Auto-criação de PatientProfile no registro, remoção de redirecionamento para setup no dashboard, alteração de redirecionamento de login para a home., Artefatos alterados: apps/api/src/auth/auth.service.ts, apps/web/src/app/login/page.tsx, apps/web/src/app/dashboard/patient/page.tsx, apps/web/src/app/page.tsx, Decisões técnicas: O PatientProfile agora é criado automaticamente pelo backend ao registrar um novo usuário com o papel PATIENT., Resultado: Fluxo de cadastro mais rápido e intuitivo para pacientes., Próximos passos: Refinar a home para exibir informações dinâmicas baseadas no perfil logado. -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: Oracle, TechLead, Squad
- **Status**: Concluído

## 📋 Contexto da Demanda
O usuário solicitou que o fluxo de cadastro para pacientes ("usuário normal") fosse simplificado, removendo o formulário adicional de perfil obrigatório (onboarding) e redirecionando o usuário diretamente para a página inicial (Home) após o login.

## 🚀 Ações Executadas
1. **Backend**: Modificado `AuthService.createUser` para criar automaticamente um `PatientProfile` sempre que um usuário com `role: 'PATIENT'` for cadastrado.
2. **Frontend**: Atualizado `login/page.tsx` para redirecionar pacientes para `/` (Home) em vez de `/dashboard/patient`.
3. **Frontend**: Removido o redirecionamento forçado para `/setup/patient` no dashboard do paciente.
4. **Frontend**: Atualizado `page.tsx` (Landing Page) para exibir botões de "Meu Painel" e "Sair" se o usuário estiver autenticado, garantindo que ele consiga navegar após o login.

## 📂 Artefatos Alterados
- `apps/api/src/auth/auth.service.ts`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/dashboard/patient/page.tsx`
- `apps/web/src/app/page.tsx`

## 💡 Decisões Técnicas
- **Auto-criação de Perfil**: Para evitar erros 404 no dashboard sem forçar um formulário, o perfil do paciente agora é gerado automaticamente no banco de dados durante o registro inicial.
- **Navegação**: A Landing Page foi transformada em uma página dinâmica que detecta o estado de login (via `localStorage` e decodificação do JWT no cliente) para fornecer links contextuais de navegação.

## ✅ Resultado e Próximos Passos
O fluxo para pacientes agora é: Registro -> Login -> Home (com acesso ao painel).

**Próximos Passos:**
1. Monitorar a taxa de conversão com o novo fluxo simplificado.
2. Considerar se o médico também deve ser redirecionado para a Home ou manter o dashboard direto.
3. Adicionar uma seção de "Minhas Próximas Consultas" diretamente na Home para usuários logados.
