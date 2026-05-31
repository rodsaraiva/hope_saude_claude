
* **[Feature] Sistema de videochamada (100% TDD)** via LiveKit (token server-side `livekit-server-sdk`) e NestJS, integrado ao Next.js (`@livekit/components-react`).
* **[Feature] Integração de pagamentos com Asaas** implementada no Backend (AsaasService e checkout) e no Frontend (UI e link de redirecionamento Pix). Testado via E2E (Playwright) com 100% de cobertura TDD.


* **[Feature] Sistema de verificação periódica de Pagamentos (Cron Job)** a cada 15 minutos para checar o status de pagamentos Asaas via API e atualizar consultas pendentes, usando \@nestjs/schedule\ com cobertura 100% de testes TDD.

