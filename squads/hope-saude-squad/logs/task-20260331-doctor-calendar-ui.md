# 📄 Task Detail: Interface de Disponibilidade Estilo Google Calendar

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: Oracle, TechLead, FrontendDev, BackendDev
- **Status**: Em Execução

## 📋 Contexto da demanda
O médico precisa de uma forma intuitiva de gerenciar seus horários, semelhante ao Google Calendar. A interface anterior via `textarea` era apenas um placeholder para o MVP inicial. Agora, implementaremos uma grade horária onde o médico pode clicar e arrastar (ou selecionar) slots de disponibilidade.

## 🚀 Ações executadas
- **Modelagem de Dados**: Estruturação do campo `availability` para suportar um array de objetos `{ day, startTime, endTime }`.
- **UI de Grade Horária**: Implementação de uma visualização semanal com colunas para dias e linhas para horas.
- **Interatividade**: Adição de modal para criação de novos slots de disponibilidade.
- **Persistência**: Integração com a API para salvar a grade completa de horários.

## 📂 Artefatos alterados
- `apps/web/src/app/dashboard/doctor/page.tsx`
- `apps/api/src/profile/profile.service.ts`

## 💡 Decisões técnicas
- **Visualização Customizada**: Construção de uma grid CSS nativa com Tailwind para emular o comportamento do calendário sem dependências pesadas.
- **JSON Serialization**: Embora o SQLite use String, o dado trafega como JSON estruturado para facilitar a renderização no frontend.

## ✅ Resultado e próximos passos
Interface de agendamento profissional para o médico.
Próximo passo: Refletir esses slots na busca do paciente para seleção de horário real.
