---
task: createSquad()
responsavel: "Forge"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: squadName
    tipo: string
    descricao: "Nome do squad em kebab-case  ex: aios-forge-squad, data-pipeline-squad"
    obrigatorio: true
    validacao: "Deve seguir conveno kebab-case, terminar em -squad, ser nico em squads/"
  - nome: description
    tipo: string
    descricao: "Descrio completa do domnio e propsito do squad"
    obrigatorio: true
    validacao: "Mnimo 50 caracteres, deve definir claramente o domnio de atuao"
  - nome: agentCount
    tipo: number
    descricao: "Nmero de agentes especializados no squad (mnimo 3). Se omitido, o Forge calcular dinamicamente baseado na complexidade da description e domain."
    obrigatorio: false
    validacao: "Se fornecido, deve ser >= 3. Se omitido, ser inferido via Heurstica de Dimensionamento."
  - nome: domain
    tipo: string
    descricao: "Domnio de atuao do squad (ex: devops, data-engineering, frontend, aios-framework)"
    obrigatorio: true
    validacao: "Deve ser identificvel e no genrico"
  - nome: agentSpecs
    tipo: array
    descricao: "Especificaes de cada agente: name, role, archetype, key_commands"
    obrigatorio: false
    validacao: "Se fornecido, cada spec deve ter name e role. Se no fornecido, Forge infere do domain"
  - nome: workflowPatterns
    tipo: array
    descricao: "Padres de workflow desejados: sequential, fan-out, pipeline"
    obrigatorio: false
    validacao: "Default: [sequential]. Cada pattern gera pelo menos 1 workflow"
  - nome: useNirvanaCreator
    tipo: boolean
    descricao: "Se true, usa o pipeline completo do Nirvana Squad Creator"
    obrigatorio: false
    validacao: "Default: false. Se true, delega para nirvana-squad-creator/"

Saida:
  - nome: squadDirectory
    tipo: directory
    descricao: "Diretrio completo do squad com toda a estrutura de arquivos"
    destino: "squads/{squadName}/"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: squadYaml
    tipo: file
    descricao: "Manifesto do squad (squad.yaml) com todos os componentes listados"
    destino: "squads/{squadName}/squad.yaml"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: creationReport
    tipo: object
    descricao: "Relatrio de criao com contagens, status e recomendaes"
    destino: "Memory"
    persistido: false
    formato_esperado: "Definir formato esperado do output"

Checklist:
  pre-conditions:
    - "[ ] squadName segue conveno kebab-case e termina em -squad"
    - "[ ] No existe squad com mesmo nome em squads/"
    - "[ ] agentCount fornecido >= 3 OU calculado dinamicamente >= 3"
    - "[ ] domain  identificvel e no genrico"
    - "[ ] Se useNirvanaCreator=true, squad nirvana-squad-creator existe e est funcional"
  post-conditions:
    - "[ ] Diretrio squads/{squadName}/ criado com estrutura completa"
    - "[ ] squad.yaml existe com todos os components listados"
    - "[ ] agents/ contm N arquivos .md (1 por agente)"
    - "[ ] tasks/ contm pelo menos N tasks (mnimo 1 por agente)"
    - "[ ] workflows/ contm pelo menos 1 workflow .yaml"
    - "[ ] config/ contm coding-standards.md, tech-stack.md, source-tree.md"
    - "[ ] README.md existe com descrio, agentes, tasks e instrues de uso"
    - "[ ] Cada agente tem pelo menos 3 comandos (*help, *exit + operacionais)"
    - "[ ] Cada task segue TASK-FORMAT-SPECIFICATION-V1"
    - "[ ] Workflow(s) conectam os agentes em processo coerente"
    - "[ ] Gate de compatibilidade de shell executado para o SO alvo"
    - "[ ] .squad-lock.json atualizado para installed somente aps todos os gates passarem"
    - "[ ] `SQUAD_LOG.md` criado com estrutura macro (data/hora, tarefa, agentes, status, detalhamento)"
    - "[ ] `logs/template.md` criado como base obrigatria de detalhamento"
    - "[ ] Para cada tarefa macro executada, existe `logs/task-YYYYMMDD-identificador.md`"

Performance:
  duration_expected: "10-20 minutos"
  cost_estimated: "~15000 tokens (Opus)"
  cacheable: false
  parallelizable: false
  skippable_when: "Nunca  squad  a unidade organizacional do AIOS"

Error Handling:
  strategy: retry
  retry:
    max_attempts: 1
    delay: "10s"
  fallback: "Gerar scaffold mnimo com TODO markers em artefatos incompletos"
  notification: "orchestrator"
  common_errors:
    - error: "Duplicate Squad Name"
      cause: "J existe squad com mesmo nome"
      resolution: "Listar squads existentes e sugerir nome alternativo"
    - error: "Insufficient Agent Count"
      cause: "agentCount calculado ou fornecido < 3"
      resolution: "Explicar que um Squad requer mnimo de 3 agentes e sugerir tarefas isoladas ou adicionar papis complementares (ex: Tester, Reviewer)."
    - error: "Nirvana Creator Unavailable"
      cause: "useNirvanaCreator=true mas squad creator no existe"
      resolution: "Fallback para gerao direta pelo Forge"
    - error: "Incomplete Agent Specs"
      cause: "agentSpecs fornecido mas incompleto"
      resolution: "Inferir campos faltantes do domain e confirmar com usurio"
    - error: "Disk Space / Permissions"
      cause: "Falha ao criar diretrios ou arquivos"
      resolution: "Verificar permisses e espao disponvel, reportar ao usurio"

Metadata:
  story: "Como Forge Squad, preciso criar squads completos com agentes, tasks, workflows e configurao"
  version: "1.0.0"
  dependencies:
    - createAgent()
    - createTask()
    - createWorkflow()
    - createTemplate()
    - "Conhecimento da estrutura de squads AIOS"
  tags:
    - creation
    - squad
    - scaffold
    - ecosystem
    - multi-agent
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# createSquad()

## Pipeline Diagram

```
      
 squadName      description    domain         agentCount? 
 (string)       (string)       (string)       (number)   
      
                                                   
      
              
              

                          Forge Agent                            
                                                                 
   
   Phase 1: VALIDATE & PLAN (Sizing Heuristic)                
    - Verify squad name uniqueness                            
    - Dynamically calculate agent count (if omitted)          
    - Domain analysis  infer agent roles & patterns          
    - Plan directory structure                                
   
                                                               
   
   Phase 2: SCAFFOLD DIRECTORY                                
                                                               
    squads/{squadName}/                                        
     squad.yaml           manifesto                       
     README.md            documentao                    
     agents/              N agent .md files               
     tasks/               N+ task .md files               
     workflows/           1+ workflow .yaml               
     config/              coding-standards, tech-stack    
          coding-standards.md                               
          tech-stack.md                                     
          source-tree.md                                    
   
                                                               
   
   Phase 3: GENERATE AGENTS                                   
                                                               
    Para cada agente (N = agentCount):                         
                                               
     createAgent()   Invoca task do Forge Squad             
      - name                                                 
      - role        Gera arquivo completo .md                
      - archetype   com AGENT-PERSONALIZATION-STANDARD-V1    
      - commands                                             
                                               
   
                                                               
   
   Phase 4: GENERATE TASKS                                    
                                                               
    Para cada agente, pelo menos 1 task:                       
                                               
     createTask()    Invoca task do Forge Squad             
      - taskName                                             
      - inputs      Gera .md com contratos Entrada/Sada     
      - outputs     Pipeline Diagram e Descrio             
                                               
   
                                                               
   
   Phase 5: GENERATE WORKFLOWS                                
                                                               
    Pelo menos 1 workflow conectando os agentes:               
                                            
     createWorkflow()   Invoca task do Forge Squad          
      - name                                                 
      - type           Gera .yaml com transitions            
      - sequence                                             
                                            
   
                                                               
   
   Phase 6: GENERATE CONFIG & README                          
                                                               
    - coding-standards.md (convenes do domnio)              
    - tech-stack.md (tecnologias utilizadas)                   
    - source-tree.md (estrutura de diretrios)                 
    - README.md (documentao completa)                        
    - squad.yaml (manifesto com todos os components)           
   
                                                               
   
   Phase 7: VALIDATE & REPORT                                 
                                                               
    - Verificar todos os arquivos existem                      
    - squad.yaml lista todos os components                     
    - Cross-reference agents  tasks  workflows              
    - Gerar creation report                                    
   
                                                               

                              
              
                                            
       
    squadDirectory   squad.yaml      creation     
    (complete)       (manifest)      Report       
       
```

## Descrio

A task `createSquad()`  a **task mais complexa** do AIOS Forge Squad. Orquestra a criao completa de um squad AIOS, incluindo agentes, tasks, workflows, configurao e documentao. Um squad  a **unidade organizacional** do AIOS  um grupo especializado de agentes que colaboram em um domnio especfico.

### Responsabilidades

1. **Validao, Planejamento e Dimensionamento Dinmico (Phase 1)**:
   - Verificar unicidade do nome em squads/
   - **Heurstica de Dimensionamento (Auto-Sizing)**: Se `agentCount` ou `agentSpecs` no forem fornecidos, analise a `description` e o `domain` para definir o tamanho e composio ideal do squad:
     - **Complexidade Baixa (1-2 passos lgicos)**: O escopo no exige um squad inteiro. ABORTE a criao do squad e sugira a criao de Agents, Skills ou Tasks isoladas.
     - **Complexidade Mdia (3-4 Agentes)**: Requer ciclo completo de produo (Planejar  Executar  Validar). Exemplo: `frontend`, `data-engineering`. Crie 1 Architect/Strategist, 1-2 Builders/Executors e 1 Guardian/Validator.
     - **Complexidade Alta (5-7 Agentes)**: Cruza mltiplas disciplinas ou requer paralelismo intensivo. Crie especialistas dividindo as reas (ex: SecOps, Backend, QA, DBA).
     - **Complexidade Extrema (> 7 Agentes)**: Domnios gigantes ou ecossistemas inteiros. Sugira usar a flag `useNirvanaCreator=true`.
   - Analisar o domain para inferir roles precisos para cada agente que ser gerado, definindo o array de `agentSpecs`.
   - Planejar estrutura de diretrios e handoffs.

   **Inferncia de Roles por Domain:**

   | Domain | Roles Tpicos | Workflow Pattern |
   |--------|--------------|-----------------|
   | devops | orchestrator, builder, validator, deployer | pipeline |
   | data-engineering | analyzer, transformer, validator, loader | pipeline |
   | frontend | designer, developer, reviewer | sequential |
   | backend | architect, developer, tester | sequential |
   | aios-framework | oracle, forge, sentinel | fan-out |
   | security | scanner, analyzer, reporter | sequential |
   | content | researcher, writer, editor | pipeline |

2. **Scaffold de Diretrio (Phase 2)**  Criar a estrutura de diretrios:

   ```
   squads/{squadName}/
    squad.yaml              # Manifesto principal
    README.md               # Documentao do squad
    agents/                 # Definies de agentes
       agent-1.md
       agent-2.md
       agent-N.md
    tasks/                  # Definies de tasks
       task-1.md
       task-2.md
       task-N.md
    workflows/              # Definies de workflows
       main-workflow.yaml
    config/                 # Configuraes do squad
        coding-standards.md
        tech-stack.md
        source-tree.md
   ```

3. **Gerao de Agentes (Phase 3)**  Para cada agente no squad:
   - Invoca `createAgent()` com specs derivadas do domain
   - Cada agente recebe persona e comandos.
   - **Formato OBRIGATRIO de command_loader:** O agente DEVE ter um bloco `command_loader` vinculando cada `*comando` aos seus arquivos de `tasks/` correspondentes (que sero gerados na prxima fase).
   - Agentes so coerentes entre si (no overlap de responsabilidade)
   - Handoffs entre agentes so explcitos

4. **Gerao de Tasks (Phase 4)**  Para cada agente, pelo menos 1 task:
   - Invoca `createTask()` com contratos Entrada/Sada
   - Tasks so encadeveis  output de task N alimenta input de task N+1
   - Contratos so tipados e validados
   - Pipeline diagram em cada task
   - **Critrio Crtico:** Toda task deve mapear entradas obrigatrias e referenciar qual ser a sada real produzida.

5. **Gerao de Workflows (Phase 5)**  Pelo menos 1 workflow:
   - Invoca `createWorkflow()` conectando os agentes gerados.
   - **Formato OBRIGATRIO de transitions:** Toda transio DEVE ter `from`, `to`, `trigger`, `confidence`, `greeting_message` e `next_steps` (array de objetos com command e args).
   - **Formato OBRIGATRIO de key_commands:** Array de objetos com `command`, `agent` e `description`. NO deve ser um array simples de strings.
   - Tipo de workflow derivado do domain
   - Success indicators definidos
   - trigger_threshold e typical_duration presentes

6. **Configurao e Documentao (Phase 6)**  Arquivos de suporte:

   **squad.yaml**  Manifesto com estrutura:
   ```yaml
   name: squad-name
   version: 1.0.0
   author: "Author"
   description: "..."

   components:
     agents:
       - agent-1.md
       - agent-2.md
     tasks:
       - task-1.md
       - task-2.md
     workflows:
       - main-workflow.yaml
     checklists: []
     templates: []

   config:
     coding-standards: config/coding-standards.md
     tech-stack: config/tech-stack.md
     source-tree: config/source-tree.md

   tags:
     - domain-tag
   ```

   **config/coding-standards.md**  Convenes de cdigo especficas do domnio
   **config/tech-stack.md**  Stack tecnolgica utilizada
   **config/source-tree.md**  Mapa de diretrios com descries
   **README.md**  Documentao completa com:
   - Descrio do squad e domnio
   - Lista de agentes com roles
   - Lista de tasks disponveis
   - Workflows e como execut-los
   - Instrues de uso e exemplos

7. **Validao e Report (Phase 7)**  Validao final:
   - Todos os arquivos listados em squad.yaml existem
   - Cross-reference agents  tasks  workflows  consistente
   - Nenhum agente sem task
   - Nenhuma task sem agente responsvel
   - Workflow referencia agentes existentes
   - `manual_command` de workflow existe em algum agente do squad
   - `next_steps.args` de workflow referencia outputs existentes em tasks
   - Em caso de inconsistncia crtica, marcar squad como `draft` no `.squad-lock.json`

8. **Registro Condicional no .squad-lock.json (Phase 8)**:
   - Se TODOS os gates passarem: `status: installed`
   - Se qualquer gate crtico falhar: `status: draft`
   - Sempre registrar relatrio de validao com timestamp e lista de correes pendentes

## Template Base vs Especializao de Domnio

Toda criao de squad deve separar duas camadas:

1. **Template Base (imutvel por padro)**:
   - Estrutura mnima (`agents/`, `tasks/`, `workflows/`, `config/`)
   - Contratos obrigatrios de agentes/tasks/workflows
   - Workflow mnimo com transies completas
   - Documentao mnima (`README.md`, `squad.yaml`, `source-tree.md`)

2. **Especializao de Domnio (extensvel)**:
   - Papis e comandos especficos do domnio (`mobile`, `game`, `data`, etc.)
   - Tasks e workflows adicionais
   - Regras e mtricas especficas

**Regra:** domnio adiciona contedo, nunca remove contratos do template base.

### Modo Nirvana Creator

Se `useNirvanaCreator=true`, delega todo o processo para o Nirvana Squad Creator:

```
createSquad(useNirvanaCreator=true)
    
    
nirvana-squad-creator/
    
     analyzeRequirements()    analysis.md + component-registry.md
     createAgents()           agents/*.md
     createTasks()            tasks/*.md (com contratos)
     createWorkflows()        workflows/*.yaml
     optimizeSquad()          otimizao e validao
     deploySquad()            deploy final
```

**Quando usar Nirvana Creator:**
- Squads complexos (> 5 agentes)
- Domnios novos que requerem research
- Quando se deseja pipeline completo com otimizao

**Quando usar Gerao Direta (Forge):**
- Squads simples (3-5 agentes)
- Domnios bem conhecidos
- Quando se deseja controle direto sobre cada artefato

### Critrios de Qualidade

| Check | Critrio | Blocker |
|-------|----------|---------|
| Diretrio completo | Todas as subpastas criadas | SIM |
| squad.yaml vlido | YAML parseable, components listados | SIM |
| Agentes presentes | N arquivos em agents/ (N = agentCount) | SIM |
| Tasks presentes | >= N tasks em tasks/ | SIM |
| Workflow presente | >= 1 workflow em workflows/ | SIM |
| Config completo | 3 arquivos em config/ | NO (warning) |
| README presente | README.md com documentao | NO (warning) |
| Cross-reference | Agents  tasks  workflows consistente | SIM |
| No overlap | Agentes no tm responsabilidades sobrepostas | NO (warning) |

### Integrao com Outros Tasks

| Task Relacionada | Relao |
|-----------------|---------|
| `createAgent()` | Chamada N vezes para gerar cada agente |
| `createTask()` | Chamada N+ vezes para gerar tasks |
| `createWorkflow()` | Chamada 1+ vezes para gerar workflows |
| `createTemplate()` | Chamada para gerar templates de config |
| `validateArtifact()` | Valida o squad completo aps gerao |
| `analyzeAiosComponent()` | Analisa squads existentes como referncia |
| `optimizeComponent()` | Otimiza squad aps criao se necessrio |

## Governana e Logs para Squads (Padro Obrigatrio)

Toda gerao de novo squad DEVE incluir arquitetura de logs em 2 camadas para rastreabilidade executiva e tcnica:

1. `SQUAD_LOG.md` (camada macro, sem poluio)
2. `logs/*.md` (camada de detalhamento tcnico por tarefa macro)

### Estrutura obrigatria do `SQUAD_LOG.md`

Cada linha macro deve registrar apenas:
- Data/Hora
- Tarefa macro (nome curto da demanda)
- Agente(s) envolvidos
- Status (`concluida`, `em_execucao`, `erro`, `bloqueada`)
- Arquivo de detalhamento (link para `logs/...`)

### Estrutura obrigatria de `logs/*.md`

Para cada tarefa macro, criar 1 arquivo dedicado no formato:
- `logs/task-YYYYMMDD-identificador.md`

Cada arquivo de detalhamento deve ser criado a partir de `logs/template.md` e conter:
- contexto da demanda
- aes executadas
- artefatos alterados
- decises tcnicas
- resultado e prximos passos

### Modelo Operacional com Coordenador

O squad gerado deve seguir este contrato:

- **Agente Coordenador**
  - recebe a demanda do usurio;
  - l `SQUAD_LOG.md` e detalhamentos relevantes em `logs/`;
  - decide roteamento para agente especialista;
  - consolida status e atualiza rastreabilidade no log macro e no detalhamento.

- **Agentes Especialistas**
  - executam apenas tarefas delegadas;
  - no leem logs diretamente;
  - retornam resultado tcnico para o coordenador.

### Regra de Gap de Capacidade

Se no houver agente apto para a demanda, o coordenador deve responder explicitamente:

`gap de capacidade do time`

E apresentar plano de evoluo com opes objetivas:
- criar novo agente especializado;
- ampliar escopo de agente existente;
- adicionar nova task/workflow;
- definir critrios de fallback/manual;
- recomendar skill ou ferramenta complementar.
