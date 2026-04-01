# 📄 Task Detail: Agendamento baseado em disponibilidade (UI Paciente)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->
<!-- PLACEHOLDERS: Agendamento baseado em disponibilidade (UI Paciente), 2026-03-31, Oracle, TechLead, FrontendDev, Concluído, Contexto da demanda: substituir o prompt() por uma interface de seleção de horários baseada nos slots do médico., Ações executadas: Criado modal de disponibilidade no dashboard do paciente, implementado cálculo de data para o próximo dia da semana, atualizado fluxo de agendamento., Artefatos alterados: apps/web/src/app/dashboard/patient/page.tsx, Decisões técnicas: Uso de modal para exibição de slots, cálculo dinâmico da próxima data disponível com base no nome do dia (Segunda, Terça, etc.)., Resultado: Paciente agora escolhe horários reais definidos pelo médico., Próximos passos: Implementar lembretes de consulta ou notificações por e-mail. -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: Oracle, TechLead, FrontendDev
- **Status**: Concluído

## 📋 Contexto da Demanda
Substituir o uso de `prompt()` no dashboard do paciente por uma interface intuitiva que permita selecionar horários de consulta baseados na disponibilidade real cadastrada pelo médico.

## 🚀 Ações Executadas
1. Adição de estados `selectedDoctor` e `isModalOpen` no dashboard do paciente.
2. Criação de um modal que exibe o nome do médico e seus slots de disponibilidade.
3. Implementação da função `getSlotDate` para converter o nome do dia (ex: "Segunda") na data ISO do próximo dia correspondente.
4. Substituição do botão "Agendar" por "Ver Disponibilidade".
5. Atualização da função `handleBook` para receber a data calculada pelo slot selecionado.

## 📂 Artefatos Alterados
- `apps/web/src/app/dashboard/patient/page.tsx`: Reestruturação completa do fluxo de agendamento e adição de UI de modal.

## 💡 Decisões Técnicas
- **Cálculo de Data**: Como a disponibilidade é semanal (ex: "Toda Segunda às 09:00"), o sistema calcula automaticamente a data da *próxima* ocorrência desse dia a partir de hoje.
- **UX**: O uso de modal evita redirecionamentos e mantém o paciente no contexto do seu dashboard principal.
- **Feedback Visual**: Exibição da data formatada ("Próximo disponível: DD/MM/AAAA") para dar clareza ao paciente.

## ✅ Resultado e Próximos Passos
O fluxo de agendamento agora é guiado pela disponibilidade real do profissional, eliminando erros de entrada manual por parte do paciente.

**Próximos Passos:**
1. Implementar notificações (e-mail ou push) para confirmar o agendamento ao paciente.
2. Adicionar funcionalidade de cancelamento de consulta.
3. Integrar com o fluxo de pagamento do Stripe antes de confirmar o agendamento (opcional, dependendo do modelo de negócio).
