# 📄 Task Detail: Interface de Sala de Vídeo (Frontend)

<!-- TEMPLATE: task-detail-tmpl v1.0.0 -->

## 🛠️ Metadata
- **Date**: 2026-03-31
- **Agents Involved**: OracleCoordinator, FrontendDev
- **Status**: Em Execução

## 📋 Contexto da Demanda
Após o setup da infraestrutura de vídeo no backend, é necessário criar a interface de consulta em tempo real no frontend. A sala deve permitir que médico e paciente se vejam e se ouçam de forma segura.

## 🚀 Ações Executadas
1. **Coordenação (Oracle)**: Delegação do desenvolvimento da sala de vídeo ao FrontendDev.
2. **Criação da Rota Dinâmica**: Criada a página `/video/[id]` para as sessões de consulta.
3. **Integração WebRTC**: Implementada a lógica inicial para acessar câmera e microfone e exibir no navegador.
4. **Ponto de Entrada**: Adicionados botões "Entrar na Consulta" nos dashboards do paciente e do médico para consultas `CONFIRMED`.

## 📂 Artefatos Alterados
- `SQUAD_LOG.md` (Atualizado)
- `logs/task-20260331-video-ui.md` (Criado)
- `apps/web/src/app/video/[id]/page.tsx` (Criado)
- `apps/web/src/app/dashboard/patient/page.tsx` (Atualizado)
- `apps/web/src/app/dashboard/doctor/page.tsx` (Atualizado)

## 💡 Decisões Técnicas
- **Dynamic Routing**: Uso de rotas dinâmicas do Next.js para carregar a sala específica de cada agendamento.
- **MediaStream API**: Uso da API nativa do navegador para gerenciamento de áudio e vídeo local.

## ✅ Resultado e Próximos Passos
### Próximos Passos:
1. Finalizar a integração real com o SDK do Twilio Video (Frontend Client).
2. Implementar controle de mute/desligar câmera.
3. Realizar teste final de fluxo completo do MVP.
