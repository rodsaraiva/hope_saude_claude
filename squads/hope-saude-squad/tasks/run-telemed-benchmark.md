---
task: "runTelemedBenchmark()"
responsavel: "ProductOwner"
responsavel_type: agent
atomic_layer: "L4"

Entrada:
  - campo: "area_foco"
    tipo: "string"
    origen: "parâmetro"
    obrigatorio: true

Saida:
  - campo: "benchmark-report"
    tipo: "file"
    destino: "arquivo"
    persistido: true

Checklist:
  pre-conditions:
    - "Definir qual área da plataforma será analisada (ex: fluxos de agendamento)."
  post-conditions:
    - "Relatório com pontos fortes e fracos de concorrentes gerado."

Performance:
  tokens_estimados: "3000"
  tempo_execucao: "20m"

Error_Handling:
  on_failure: "retry"
  max_retries: 2

Metadata:
  created: "2026-03-31"
  version: "1.0.0"
  tags: ["benchmark", "produto", "telemedicina"]
---

# Pipeline Diagram
[Área de Foco] -> (ProductOwner: Pesquisa de Mercado) -> [Relatório de Benchmark]

# Description
Executa uma análise detalhada de concorrentes no setor de telemedicina/psiquiatria online para identificar as melhores práticas, funcionalidades inovadoras e falhas comuns a serem evitadas na Hope Saúde.

# Steps
1. Pesquisar plataformas líderes (ex: Teladoc, BetterHelp, Zenklub).
2. Analisar o fluxo de usuário para a área de foco escolhida.
3. Identificar diferenciais competitivos e features "must-have".
4. Compilar descobertas em um relatório estratégico para o TechLead.
