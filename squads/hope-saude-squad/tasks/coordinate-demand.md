---
task: "coordinateDemand()"
responsavel: "OracleCoordinator"
responsavel_type: agent
atomic_layer: "L4"

Entrada:
  - campo: "demanda_usuario"
    tipo: "string"
    origen: "parâmetro"
    obrigatorio: true

Saida:
  - campo: "log_detalhado"
    tipo: "file"
    destino: "arquivo"
    persistido: true

Checklist:
  pre-conditions:
    - "Acessar SQUAD_LOG.md e ler o estado atual."
  post-conditions:
    - "Atualizar SQUAD_LOG.md e criar arquivo detalhado em logs/."

Performance:
  tokens_estimados: "2000"
  tempo_execucao: "10m"

Error_Handling:
  on_failure: "retry"
  max_retries: 2

Metadata:
  created: "2026-03-31"
  version: "1.0.0"
  tags: ["coordenação", "governança", "logs"]
---

# Pipeline Diagram
[Demanda] -> (OracleCoordinator: Análise e Registro) -> [Log Macro e Detalhamento]

# Description
Esta task centraliza o recebimento de qualquer demanda para o squad Hope Saúde. O Oracle analisa o histórico nos logs, cria o registro da nova tarefa e delega as ações técnicas para os especialistas competentes.

# Steps
1. Receber a demanda do usuário.
2. Ler `SQUAD_LOG.md` para entender o contexto histórico.
3. Consultar detalhamentos em `logs/` se houver dependências.
4. Criar um novo arquivo de detalhamento baseado no `logs/template.md`.
5. Atualizar o `SQUAD_LOG.md` com o status 'Em Execução'.
6. Delegar a tarefa ao agente especialista com o contexto necessário.
