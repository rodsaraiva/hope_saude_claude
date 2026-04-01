# 📄 Task Detail: Infraestrutura de Videochamada (WebRTC)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, BackendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
A funcionalidade principal da plataforma é a consulta por vídeo. Para o MVP, utilizaremos a infraestrutura do Twilio Video para gerar tokens seguros que permitam a conexão ponto a ponto entre médico e paciente.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação do setup de vídeo ao BackendDev.
2. **Setup do VideoService**: Criada lógica para geração de JWT tokens para salas Twilio.
3. **Endpoint de Token**: Criado o endpoint `/video/token/:appointmentId` que emite o token apenas se a consulta estiver com status `CONFIRMED`.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-video-infra.md` (Criado)
- `apps/api/src/video/` (Pasta e arquivos criados)
- `apps/api/src/app.module.ts` (Atualizado)

## 💡 Decisões Técnicas
- **Security Check**: Somente usuários autenticados e vinculados a consultas confirmadas podem gerar tokens para uma sala específica.
- **Provider Choice**: Twilio Video foi escolhido pela facilidade de SDK e robustez.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Implementar a interface da sala de vídeo no Frontend (WebRTC Client).
2. Adicionar o fluxo de finalização de consulta (mudar status para `COMPLETED`).
3. Realizar testes E2E do fluxo completo (Agendamento -> Pagamento -> Vídeo).
