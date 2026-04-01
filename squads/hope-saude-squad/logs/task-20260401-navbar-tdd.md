# 📄 Task Detail: Implementação de Navbar Reutilizável (TDD)

## 🛠️ Metadata
- **Date**: 2026-04-01
- **Agents Involved**: Oracle, TechLead, FrontendDev, QA
- **Status**: Concluído

## 📋 Contexto da Demanda
A plataforma necessitava de uma navegação consistente em todas as páginas. A home tinha um cabeçalho que não aparecia em login, registro ou dashboards.

## 🚀 Ações Executadas
- [x] Criar teste E2E (`test/navbar.e2e.spec.ts`): Home, Login e links deslogados.
- [x] Implementar `src/components/Navbar.tsx` (client): logo, links Entrar/Criar conta ou Meu Painel/Sair conforme JWT no `localStorage`.
- [x] Integrar `Navbar` no `RootLayout` (`layout.tsx`).
- [x] Remover cabeçalho duplicado de `app/page.tsx` (hero CTAs mantêm `isLoggedIn` / `userRole` locais).

## 📂 Artefatos Alterados
- `apps/web/src/components/Navbar.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/test/navbar.e2e.spec.ts`

## 💡 Decisões Técnicas
- **Navbar como client component**: leitura de token e papel do JWT no browser.
- **Layout global**: uma única `<header>` em todas as rotas.
- **TDD E2E**: testes verificam `header` com marca e links; escopo via `page.locator('header')` para evitar colisão com footer.

## ✅ Resultado e Próximos Passos
- E2E: `navbar.e2e.spec.ts` (3) + `full-flow.e2e.spec.ts` (2) = **5 passed**.
- Opcional futuro: ocultar Navbar em telas full-screen (ex.: sala de vídeo) via layout aninhado ou prop.
