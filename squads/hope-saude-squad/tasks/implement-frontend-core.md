---
task: "implementFrontendCore()"
responsavel: "FrontendDev"
responsavel_type: agent
atomic_layer: "L4"

Entrada:
  - campo: "codigo-backend"
    tipo: "string"
    origen: "contexto"
    obrigatorio: true

Saida:
  - campo: "codigo-frontend"
    tipo: "string"
    destino: "arquivo"
    persistido: true

Checklist:
  pre-conditions:
    - "APIs do backend estarem estáveis."
  post-conditions:
    - "Interfaces de paciente e médico implementadas e integradas."

Performance:
  tokens_estimados: "5000"
  tempo_execucao: "40m"

Error_Handling:
  on_failure: "retry"
  max_retries: 3

Metadata:
  created: "2026-03-31"
  version: "1.0.0"
  tags: ["frontend", "ui"]
---

# Pipeline Diagram
[API] -> (FrontendDev: Implementação UI) -> [Aplicação Web]

# Description
Construir as telas da aplicação web para a plataforma, focando em usabilidade e na integração fluida da videochamada em tempo real.

# Steps
1. Inicializar o app frontend (React/Vue/Next).
2. Criar fluxos de login com diferenciação de painéis (Dashboard Paciente vs Painel Médico).
3. Implementar calendário/interface para médicos inserirem disponibilidades.
4. Construir tela de checkout para agendamentos.
5. Integrar sala de videochamada (WebRTC SDK).
