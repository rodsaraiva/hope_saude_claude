# 📄 Task Detail: Setup de Perfil Obrigatório (Patient & Doctor)

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: Oracle, TechLead, BackendDev, FrontendDev
- **Status**: Concluído

## 📋 Contexto da demanda
Garantir que novos usuários (médicos e pacientes) completem seus perfis obrigatórios antes de acessar as funcionalidades principais do dashboard. Sem o perfil, dados como CRM (médicos) ou telefone (pacientes) estariam ausentes no banco.

## 🚀 Ações executadas
- **Backend**: Atualização do `ProfileController` (`/profile/me`) para lançar `NotFoundException` (404) caso o perfil não exista.
- **Frontend (Setup Pages)**: Criação das páginas de configuração inicial:
  - `apps/web/src/app/setup/doctor/page.tsx` (CRM, Especialidade)
  - `apps/web/src/app/setup/patient/page.tsx` (Telefone, Histórico)
- **Lógica de Proteção**: Dashboards (`patient` e `doctor`) agora verificam o status 404 da API e redirecionam para a página de setup correta.

## 📂 Artefatos alterados
- `apps/api/src/profile/profile.controller.ts`
- `apps/web/src/app/setup/doctor/page.tsx` (Novo)
- `apps/web/src/app/setup/patient/page.tsx` (Novo)
- `apps/web/src/app/dashboard/doctor/page.tsx`
- `apps/web/src/app/dashboard/patient/page.tsx`

## 💡 Decisões técnicas
- **Validação preemptiva**: A verificação ocorre no carregamento do dashboard, garantindo que o usuário não "salte" o setup via URL direta sem possuir dados persistidos.

## ✅ Resultado e próximos passos
Fluxo de onboarding completo.
Próximo passo: Implementar seleção de data/hora no agendamento (Remover prompt).
