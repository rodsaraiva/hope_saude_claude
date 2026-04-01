---
task: "planTestStrategy()"
responsavel: "QASpecialist"
responsavel_type: agent
atomic_layer: "L4"

Entrada:
  - campo: "funcionalidade"
    tipo: "string"
    origen: "contexto"
    obrigatorio: true

Saida:
  - campo: "test-plan-doc"
    tipo: "file"
    destino: "arquivo"
    persistido: true

Checklist:
  pre-conditions:
    - "Ter a definição da funcionalidade e tech stack decidida."
  post-conditions:
    - "Plano de testes detalhando Unit, Integration e E2E gerado."

Performance:
  tokens_estimados: "2500"
  tempo_execucao: "15m"

Error_Handling:
  on_failure: "retry"
  max_retries: 2

Metadata:
  created: "2026-03-31"
  version: "1.0.0"
  tags: ["qa", "tdd", "testes"]
---

# Pipeline Diagram
[Funcionalidade] -> (QASpecialist: Design de Testes) -> [Plano de Testes]

# Description
Esta task define como a funcionalidade será testada em todos os níveis (Unitário, Integração e E2E), seguindo a metodologia TDD onde aplicável, garantindo que o comportamento esperado seja validado antes e depois da implementação.

# Steps
1. Analisar os requisitos da funcionalidade.
2. Identificar casos de teste unitários críticos.
3. Definir fluxos de integração (ex: API -> DB).
4. Mapear jornadas E2E (ex: Agendamento -> Pagamento -> Vídeo).
5. Gerar o documento de estratégia de testes.
