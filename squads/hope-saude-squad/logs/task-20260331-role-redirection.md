# 📄 Task Detail: Redirecionamento Baseado em Papel (Role-Based Redirection)

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: Oracle, TechLead, FrontendDev
- **Status**: Concluído

## 📋 Contexto da demanda
Implementação do fluxo pós-login para redirecionar o usuário para o dashboard correto (`/dashboard/patient` ou `/dashboard/doctor`) baseado no papel (role) contido no token JWT.

## 🚀 Ações executadas
- Modificação da página de login (`apps/web/src/app/login/page.tsx`) para decodificar o payload do JWT retornado pela API.
- Lógica de redirecionamento condicional baseada no campo `role`.

## 📂 Artefatos alterados
- `apps/web/src/app/login/page.tsx`

## 💡 Decisões técnicas
- **Decodificação Client-side**: Uso de `atob()` e `JSON.parse()` no segmento central do JWT para extrair o papel do usuário sem necessidade de bibliotecas extras, garantindo rapidez no redirecionamento.

## ✅ Resultado e próximos passos
Usuários agora caem diretamente em suas áreas de trabalho específicas após o login.
Próximo passo: Implementar o setup de perfil obrigatório.
