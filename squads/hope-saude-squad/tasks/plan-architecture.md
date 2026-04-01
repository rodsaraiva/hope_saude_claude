---
task: "planArchitecture()"
responsavel: "TechLead"
responsavel_type: agent
atomic_layer: "L4"

Entrada:
  - campo: "requisitos"
    tipo: "string"
    origen: "contexto"
    obrigatorio: true

Saida:
  - campo: "tech-stack-doc"
    tipo: "file"
    destino: "arquivo"
    persistido: true

Checklist:
  pre-conditions:
    - "Ter os requisitos iniciais do produto."
  post-conditions:
    - "Ter documentos em config/ preenchidos (tech-stack, coding-standards)."

Performance:
  tokens_estimados: "2000"
  tempo_execucao: "10m"

Error_Handling:
  on_failure: "retry"
  max_retries: 2

Metadata:
  created: "2026-03-31"
  version: "1.0.0"
  tags: ["arquitetura", "planejamento"]
---

# Pipeline Diagram
[Requisitos] -> (TechLead: Desenho de Arquitetura) -> [Documentos Tech Stack]

# Description
Esta task define a fundação técnica da plataforma de telepsiquiatria, escolhendo as tecnologias exatas para backend, frontend, banco de dados, provedor de vídeo e gateway de pagamentos.

# Steps
1. Analisar requisitos de RBAC (Pacientes vs Médicos).
2. Definir stack tecnológica para o servidor e cliente.
3. Escolher provedores externos (ex: Twilio Video/Agora para chamadas, Stripe/Pagar.me para pagamentos).
4. Gerar o arquivo `config/tech-stack.md` e `config/coding-standards.md`.
