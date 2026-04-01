# 📄 Task Detail: Integração com Stripe (Pagamentos)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Para viabilizar o MVP, é necessário que o paciente pague pela consulta antes da confirmação. Utilizaremos o Stripe como gateway de pagamento para processar as transações de forma segura.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação da integração financeira ao BackendDev.
2. **Setup do StripeService**: Implementada a comunicação com a API do Stripe para criação de `PaymentIntents`.
3. **Endpoint de Checkout**: Criado `/payments/checkout` para iniciar o fluxo de pagamento para uma consulta específica.
4. **Endpoint de Confirmação**: Criado `/payments/confirm` que verifica o status no Stripe e atualiza a consulta para `CONFIRMED`.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-stripe-integration.md` (Criado)
- `apps/api/src/payment/` (Pasta e arquivos criados)
- `apps/api/src/app.module.ts` (Atualizado)

## 💡 Decisões Técnicas
- **Payment Intent**: Uso da estratégia moderna do Stripe para maior segurança.
- **Webhook Placeholder**: Futuramente será implementado um webhook para confirmações assíncronas.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar o componente de pagamento no Frontend (Stripe Elements).
2. Criar a interface de videochamada usando WebRTC (Twilio Video ou similar).
3. Finalizar o fluxo E2E (Agendamento -> Pagamento -> Consulta).
