---
task: analyzeAiosComponent()
responsavel: "Oracle"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: componentPath
    tipo: string
    descricao: "Caminho absoluto ou relativo para o componente AIOS a ser analisado"
    obrigatorio: true
    validacao: "Deve ser um path vlido para um artefato AIOS existente (agent, task, workflow, squad, core module)"
  - nome: analysisType
    tipo: string
    descricao: "Tipo de anlise a executar: architecture | performance | quality | dependencies"
    obrigatorio: true
    validacao: "Deve ser um dos valores: architecture, performance, quality, dependencies"
  - nome: depth
    tipo: string
    descricao: "Profundidade da anlise: shallow (overview) | deep (completa)"
    obrigatorio: false
    validacao: "Default: deep"
  - nome: outputFormat
    tipo: string
    descricao: "Formato do relatrio: markdown | yaml | json"
    obrigatorio: false
    validacao: "Default: markdown"

Saida:
  - nome: analysisReport
    tipo: file
    descricao: "Relatrio detalhado da anlise do componente"
    destino: "squads/aios-forge-squad/outputs/analysis/"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: recommendations
    tipo: file
    descricao: "Lista de recomendaes acionveis para melhorias"
    destino: "squads/aios-forge-squad/outputs/analysis/"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: dependencyGraph
    tipo: object
    descricao: "Grafo de dependncias do componente (quando analysisType=dependencies)"
    destino: "Memory"
    persistido: false
    formato_esperado: "Definir formato esperado do output"

Checklist:
  pre-conditions:
    - "[ ] componentPath existe e  acessvel no filesystem"
    - "[ ] componentPath aponta para um artefato AIOS vlido (agent .md, task .md, workflow .yaml, squad dir, core module)"
    - "[ ] analysisType  um dos valores permitidos"
    - "[ ] Permisso de leitura no componente e seus artefatos relacionados"
  post-conditions:
    - "[ ] analysisReport cobre TODAS as dimenses do analysisType selecionado"
    - "[ ] recommendations contm pelo menos 1 recomendao acionvel"
    - "[ ] Nenhum artefato referenciado no report aponta para paths inexistentes"
    - "[ ] Se analysisType=dependencies, dependencyGraph  um DAG vlido (sem ciclos indetectveis)"
    - "[ ] Report identifica a camada AIOS correta (L1/L2/L3/L4) do componente"

Performance:
  duration_expected: "2-5 minutos"
  cost_estimated: "~3000 tokens (Opus)"
  cacheable: true
  parallelizable: true
  skippable_when: "Nunca  anlise  prerequisito para qualquer otimizao ou modernizao"

Error Handling:
  strategy: retry
  retry:
    max_attempts: 2
    delay: "3s"
  fallback: "Executar anlise manual com escopo reduzido ao analysisType principal"
  notification: "orchestrator"
  common_errors:
    - error: "Component Not Found"
      cause: "componentPath invlido ou artefato removido"
      resolution: "Validar path e listar artefatos disponveis"
    - error: "Invalid Artifact Format"
      cause: "Arquivo no segue formato AIOS esperado"
      resolution: "Identificar formato atual e reportar divergncias"
    - error: "Circular Dependency Detected"
      cause: "Grafo de dependncias contm ciclo"
      resolution: "Reportar ciclo com path completo e sugerir breaking point"

Metadata:
  story: "Como mantenedor do AIOS, preciso analisar componentes para entender arquitetura, performance e qualidade"
  version: "1.0.0"
  dependencies:
    - "Acesso ao filesystem do projeto"
    - "Conhecimento do modelo de 4 camadas AIOS (L1-L4)"
  tags:
    - analysis
    - architecture
    - performance
    - quality
    - dependencies
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# analyzeAiosComponent()

## Pipeline Diagram

```
┌───────────────────     ┌──────────────
│  componentPath     │────▶│              │
│  (string)          │     │   Oracle /   │
└───────────────────┘     │   Architect  │
                          │              │
┌───────────────────     │  ┌────────  │     ┌──────────────────────
│  analysisType      │────▶│  │ Router │  │────▶│  analysisReport      │
│  (string)          │     │  └────────┘  │     │  (detailed .md file) │
└───────────────────┘     │              │     └──────────────────────┘
                          │  ┌────────  │
┌───────────────────     │  │ Engine │  │     ┌──────────────────────
│  depth             │────▶│  └────────┘  │────▶│  recommendations     │
│  (shallow|deep)    │     │              │     │  (actionable .md)    │
└───────────────────┘     │  ┌────────  │     └──────────────────────┘
                          │  │ Graph  │  │
┌───────────────────     │  └────────┘  │     ┌──────────────────────
│  outputFormat      │────▶│              │────▶│  dependencyGraph     │
│  (md|yaml|json)    │     └──────────────┘     │  (in-memory object)  │
└───────────────────┘                           └──────────────────────┘
                                │
                    ┌───────────┼───────────
                    │           │           │
                    ▼           ▼           ▼
             ┌────────── ┌────────── ┌──────────
             │ L1 Core  │ │ L2 Tmpl  │ │ L3/L4    │
             │ Analysis │ │ Analysis │ │ Analysis │
             └──────────┘ └──────────┘ └──────────┘
```

## Descrio

A task `analyzeAiosComponent()`  o **ponto de entrada analtico** do AIOS Forge Squad. Recebe qualquer componente AIOS e produz um relatrio abrangente com recomendaes acionveis. É utilizada como prerequisito para tasks de otimizao (`optimize-component`), modernizao (`modernize-component`) e auditoria (`audit-framework`).

### Responsabilidades

1. **Identificao do Artefato**  Determinar o tipo do componente (agent, task, workflow, squad, core module) e sua camada no modelo AIOS (L1 Core, L2 Templates, L3 Config, L4 Runtime).

2. **Roteamento por Tipo de Anlise**  Direcionar para o engine correto baseado no `analysisType`:

   | analysisType | Engine | Foco |
   |-------------|--------|------|
   | `architecture` | ArchitectureEngine | Dependncias, camadas, interaes entre subsistemas, acoplamento |
   | `performance` | PerformanceEngine | Uso de tokens, complexidade, tempo de carregamento, overhead |
   | `quality` | QualityEngine | Conformidade de formato, check constitucional, compliance IDS |
   | `dependencies` | DependencyEngine | Grafo, dependncias circulares, referncias rfs |

3. **Anlise de Arquitetura**  Quando `analysisType=architecture`:
   - Mapear todas as dependncias diretas e transitivas
   - Identificar a camada AIOS (L1/L2/L3/L4) e verificar boundary compliance
   - Analisar interaes com outros subsistemas (agents, tasks, workflows)
   - Avaliar acoplamento (tight vs loose) e coeso
   - Verificar aderncia ao modelo de 4 camadas (L1 read-only, L2 extend-only, etc.)
   - Detectar violaes de boundary (ex: task L4 modificando artefato L1)

4. **Anlise de Performance**  Quando `analysisType=performance`:
   - Estimar token usage para execuo completa
   - Analisar complexidade computacional (linear, quadrtica, etc.)
   - Avaliar tempo de carregamento (quantos arquivos precisam ser lidos)
   - Identificar gargalos (steps que consomem mais tokens)
   - Comparar com benchmarks de componentes similares
   - Recomendar otimizaes de context window

5. **Anlise de Qualidade**  Quando `analysisType=quality`:
   - Verificar conformidade com o formato esperado (TASK-FORMAT-V1, AGENT-PERSONALIZATION-STANDARD-V1, etc.)
   - Check constitucional (6 artigos da Constituio AIOS)
   - Compliance IDS (Incremental Development System)
   - Validar YAML frontmatter (campos obrigatrios, tipos corretos)
   - Avaliar completude (sees presentes vs sees esperadas)
   - Verificar qualidade da documentao (descries, diagramas, exemplos)

6. **Anlise de Dependncias**  Quando `analysisType=dependencies`:
   - Construir grafo de dependncias (directed acyclic graph)
   - Detectar dependncias circulares
   - Identificar referncias rfs (aponta para artefatos inexistentes)
   - Calcular fan-in (quantos artefatos dependem deste) e fan-out (de quantos este depende)
   - Sugerir refatoraes para reduzir acoplamento

### Classificao de Camada

O engine identifica automaticamente a camada do componente:

| Camada | Path Pattern | Mutabilidade | Ao da Anlise |
|--------|-------------|-------------|----------------|
| L1 Core | `.aios-core/core/` | NEVER modify | Verificar integridade, reportar como referncia |
| L2 Templates | `.aios-core/development/` | Extend-only | Verificar se extenses no quebram base |
| L3 Config | `.aios-core/data/`, `agents/*/MEMORY.md` | Mutable (excees) | Validar configuraes |
| L4 Runtime | `docs/stories/`, `packages/`, `squads/` | ALWAYS modify | Anlise completa, recomendaes livres |

### Gerao de Recomendaes

Cada recomendao segue o formato:

```yaml
recommendation:
  id: "REC-001"
  severity: critical | high | medium | low
  category: architecture | performance | quality | dependency
  title: "Descrio curta"
  description: "Explicao detalhada do problema"
  impact: "O que acontece se no corrigir"
  action: "Passos concretos para resolver"
  effort: low | medium | high
  related_artifacts:
    - "path/to/related.md"
```

### Critrios de Qualidade do Report

- Cada seo do report deve ter pelo menos 3 bullets de anlise
- Recomendaes devem ser SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- Nenhum statement sem evidncia (path, contagem, comparao)
- Severidade deve refletir impacto real no framework
- Referncias a paths devem ser verificveis

### Integrao com Outros Tasks

| Task Consumidora | Como Usa o Output |
|-----------------|------------------|
| `optimizeComponent()` | Usa recommendations com severity>=high como input |
| `modernizeComponent()` | Usa analysisReport para planejar modernizao |
| `auditFramework()` | Agrega mltiplos analysisReports em audit geral |
| `validateArtifact()` | Usa quality analysis como referncia de validao |
