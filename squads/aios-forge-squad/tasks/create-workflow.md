---
task: createWorkflow()
responsavel: "Forge"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: workflowName
    tipo: string
    descricao: "Nome do workflow em snake_case  ex: forge_artifact, optimize_framework"
    obrigatorio: true
    validacao: "Deve seguir conveno snake_case  /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/"
  - nome: description
    tipo: string
    descricao: "Descrio completa do propsito e escopo do workflow"
    obrigatorio: true
    validacao: "Mnimo 30 caracteres, deve ser especfica ao domnio"
  - nome: agentSequence
    tipo: array
    descricao: "Sequncia ordenada de agentes que participam do workflow com papel em cada step"
    obrigatorio: true
    validacao: "Mnimo 2 agentes, cada um com agentId e role definidos"
  - nome: workflowType
    tipo: string
    descricao: "Tipo de fluxo: sequential | fan-out | pipeline"
    obrigatorio: true
    validacao: "Deve ser um dos 3 tipos vlidos"
  - nome: triggerCondition
    tipo: string
    descricao: "Condio que dispara o workflow (comando, evento, schedule)"
    obrigatorio: false
    validacao: "Se no fornecido, trigger  manual via comando"
  - nome: targetSquad
    tipo: string
    descricao: "Nome do squad onde salvar o workflow (kebab-case)"
    obrigatorio: false
    validacao: "Se fornecido, squad deve existir em squads/"

Saida:
  - nome: workflowFile
    tipo: file
    descricao: "Arquivo YAML completo do workflow com todas as definies"
    destino: "squads/{targetSquad}/workflows/{workflowName}.yaml"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: validationResult
    tipo: object
    descricao: "Resultado da validao estrutural do workflow"
    destino: "Memory"
    persistido: false
    formato_esperado: "Definir formato esperado do output"

Checklist:
  pre-conditions:
    - "[ ] workflowName segue conveno snake_case"
    - "[ ] Todos os agentes em agentSequence existem ou esto planejados"
    - "[ ] workflowType  um dos 3 valores vlidos: sequential, fan-out, pipeline"
    - "[ ] No existe workflow com mesmo nome no diretrio destino"
    - "[ ] Para tipo fan-out: pelo menos 2 agentes paralelos definidos"
    - "[ ] Para tipo pipeline: outputs de step N compatveis com inputs de step N+1"
  post-conditions:
    - "[ ] YAML do workflow  vlido e parseable"
    - "[ ] workflow_name, description, agent_sequence presentes"
    - "[ ] Transitions definidas para todas as conexes entre steps"
    - "[ ] Cada transition tem trigger, confidence, greeting_message, next_steps"
    - "[ ] key_commands est no formato de objeto (command, agent, description)"
    - "[ ] key_commands referenciam comandos existentes nos agentes"
    - "[ ] typical_duration e success_indicators definidos"
    - "[ ] trigger_threshold documentado"
    - "[ ] Diagrama de fluxo presente na description ou em comentrios"

Performance:
  duration_expected: "3-5 minutos"
  cost_estimated: "~3000 tokens (Opus)"
  cacheable: false
  parallelizable: false
  skippable_when: "Nunca  workflows conectam tasks e agentes em processos coerentes"

Error Handling:
  strategy: retry
  retry:
    max_attempts: 2
    delay: "5s"
  fallback: "Gerar workflow esqueleto com transitions marcadas como TODO"
  notification: "orchestrator"
  common_errors:
    - error: "Duplicate Workflow Name"
      cause: "J existe workflow com mesmo nome no escopo"
      resolution: "Listar workflows existentes e sugerir nome alternativo"
    - error: "Agent Not Found in Sequence"
      cause: "Agente referenciado em agentSequence no existe"
      resolution: "Listar agentes disponveis e sugerir substituio"
    - error: "Circular Transition"
      cause: "Transition cria ciclo infinito sem exit condition"
      resolution: "Identificar ciclo e adicionar exit condition (max_iterations ou completion_criteria)"
    - error: "Incompatible I/O Between Steps"
      cause: "Output de step N no  compatvel com input de step N+1"
      resolution: "Mapear contratos e sugerir adaptao ou middleware step"

Metadata:
  story: "Como Forge Squad, preciso criar workflows YAML que orquestram agentes e tasks em processos coerentes"
  version: "1.0.0"
  dependencies:
    - "WORKFLOW-FORMAT-SPECIFICATION-V1"
    - "Conhecimento dos 7 workflows AIOS existentes"
  tags:
    - creation
    - workflow
    - orchestration
    - transitions
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# createWorkflow()

## Pipeline Diagram

```
    
  workflowName         description          workflowType     
  (snake_case)         (string)             (seq|fan|pipe)   
    
                                                   
         
                    

  agentSequence    
  (array)          

                    
                    

                        Forge Agent                            
                                                               
   
   Step 1: Validate & Classify                              
    - workflowType routing                                  
    - agent existence check                                 
    - naming convention validation                          
   
                                                             
                             
                                                           
                   
   Sequential     Fan-Out       Pipeline               
   Builder        Builder       Builder                
                                                       
   A  B  C        B       A  B               
                 A              in  out              
                     C                               
                   
                                                          
                            
                                                             
   
   Step 3: Generate Transitions                             
    - trigger per connection                                
    - confidence level                                      
    - greeting_message for agent handoff                    
    - next_steps with command references                    
   
                                                             
   
   Step 4: Assemble YAML & Validate                        
    - merge all sections                                    
    - validate YAML syntax                                  
    - check transition completeness                         
    - write file                                            
   
                                                             

                          
              
                                     
     
     workflowFile         validationResult 
     (.yaml completo)     (structure check)
     
```

## Descrio

A task `createWorkflow()` gera definies de workflow AIOS no formato YAML. Workflows so os **orquestradores** do framework  conectam agentes e tasks em processos multi-step com transies definidas, permitindo automao de fluxos complexos.

### Responsabilidades

1. **Validao e Classificao**  Verificar inputs e rotear para o builder correto:
   - `workflowName` segue snake_case (ex: `forge_artifact`, `optimize_framework`)
   - Todos os agentes em `agentSequence` existem no squad
   - `workflowType` determina o padro de construo

2. **Construo por Tipo**  Cada tipo de workflow tem um builder especializado:

   **Sequential (A  B  C):**
   ```yaml
   # Agentes executam em srie, um aps o outro
   # Output de cada step  input do prximo
   # Falha em qualquer step interrompe a cadeia
   agent_sequence:
     - step: 1
       agent: "@agent-a"
       role: "Anlise inicial"
       key_command: "*analyze"
       output: "analysis.md"
     - step: 2
       agent: "@agent-b"
       role: "Implementao"
       key_command: "*implement"
       input_from: "step_1.output"
   ```

   **Fan-Out (A  [B, C, D]  E):**
   ```yaml
   # Um agente distribui trabalho para N agentes paralelos
   # Resultados so agregados por um agente final
   agent_sequence:
     - step: 1
       agent: "@orchestrator"
       role: "Distribuio"
       fan_out_to: [2, 3, 4]
     - step: 2
       agent: "@worker-1"
       role: "Subtask A"
       parallel: true
     - step: 3
       agent: "@worker-2"
       role: "Subtask B"
       parallel: true
     - step: 4
       agent: "@aggregator"
       role: "Consolidao"
       waits_for: [2, 3]
   ```

   **Pipeline (A inputoutput B):**
   ```yaml
   # Encadeamento rigoroso de contratos I/O
   # Cada step produz output tipado consumido pelo prximo
   # Validao de compatibilidade entre steps
   agent_sequence:
     - step: 1
       agent: "@analyzer"
       input_contract: { userObjective: string }
       output_contract: { analysis: file, registry: file }
     - step: 2
       agent: "@builder"
       input_contract: { analysis: file, registry: file }
       output_contract: { artifacts: array<file> }
   ```

3. **Gerao de Transitions**  Cada conexo entre steps recebe uma transition completa:

   ```yaml
   transitions:
     - from: "step_1"
       to: "step_2"
       trigger: "step_1.status == 'completed'"
       confidence: 0.95
       greeting_message: |
         {agent-b} recebendo handoff de {agent-a}.
         Contexto: {step_1.summary}
         Prximo: Executar {key_command} com dados recebidos.
       next_steps:
         - command: "*implement"
           args: "--input={step_1.output}"
         - command: "*validate"
           args: "--type=pre-check"
   ```

   **Campos Obrigatrios por Transition:**

   | Campo | Tipo | Descrio |
   |-------|------|-----------|
   | `from` | string | ID/Step do agente de origem |
   | `to` | string | ID/Step do agente de destino |
   | `trigger` | string | Condio que dispara a transio |
   | `confidence` | float | Nvel de confiana da transio (0.0-1.0) |
   | `greeting_message` | string | Mensagem de handoff para o prximo agente |
   | `next_steps` | array | Comandos a executar no step seguinte |

4. **Montagem do YAML Final**  Estrutura completa do workflow:

   ```yaml
   workflow_name: "nome_do_workflow"
   description: "Descrio completa"
   version: "1.0.0"
   workflow_type: "sequential | fan-out | pipeline"

   agent_sequence:
     - step: N
       agent: "@agent-id"
       role: "Descrio do papel"
       key_command: "*command"

   key_commands:
     command: "*command-name"
     agent: "@agent-id"
     description: "O que faz"

   trigger_threshold:
     condition: "Quando disparar"
     manual_command: "*start-workflow-name"

   typical_duration: "X-Y minutos"

   success_indicators:
     - "Indicador 1"
     - "Indicador 2"

   transitions:
     - from: "step_N"
       to: "step_N+1"
       trigger: "condition"
       confidence: 0.95
       greeting_message: "handoff message"
       next_steps:
         - command: "*cmd"
   ```

5. **Validao do YAML**  Antes de salvar, validar:
   - YAML  sintaticamente vlido
   - Todos os steps referenciados em transitions existem
   - No h transitions rfs (sem source ou target)
   - No h ciclos infinitos sem exit condition
   - key_commands (objeto) referencia comando real de agente
   - agent_sequence  consistente com transitions

6. **Compatibilidade de Shell por SO (Gate obrigatrio)**:
   - Detectar ambiente alvo (`windows`, `linux`, `macos`)
   - Se alvo for Windows, gerar passos acionveis em **PowerShell** por padro
   - Em alvo Windows, usar exemplos em PowerShell (`New-Item`, `Get-ChildItem`, `Set-Content`)
   - Registrar no workflow metadata: `shell_profile: powershell | bash`

### Tipos de Workflow  Guia de Seleo

| Situao | Tipo Recomendado | Justificativa |
|----------|-----------------|---------------|
| Fluxo linear sem paralelismo | `sequential` | Simples, previsvel, fcil debug |
| Mltiplas subtasks independentes | `fan-out` | Paralelismo natural, consolidao no final |
| Contratos I/O rgidos entre steps | `pipeline` | Garantia de compatibilidade entre steps |
| Fluxo com decision points | `sequential` + branches | Transitions com condies |
| Operao massiva paralela | `fan-out` + nested | Distribuio hierrquica |

### Workflows AIOS Existentes (Referncia)

O AIOS possui 7 workflows core que servem como referncia de padro:

| Workflow | Tipo | Agentes | Propsito |
|----------|------|---------|-----------|
| Story Development Cycle | sequential | @sm  @po  @dev  @qa | Desenvolvimento de stories |
| QA Loop | sequential/iterativo | @qa  @dev | Review-fix cycle |
| Spec Pipeline | pipeline | @pm  @architect  @analyst  @qa | Requirements to spec |
| Brownfield Discovery | sequential | @architect  @data  @ux  @qa  @pm | Legacy assessment |

### Regras de Gerao

- **Naming**: workflow_name em snake_case, arquivo em kebab-case.yaml
- **Mnimo 2 agentes** em qualquer workflow (workflow de 1 agente  uma task, no workflow)
- **Transitions completas**: toda conexo step-to-step precisa de transition explcita (com from, to, trigger, confidence, greeting_message, next_steps)
- **Key Commands completos**: key_commands deve ser um objeto com `command`, `agent`, `description`
- **Exit conditions**: workflows cclicos DEVEM ter max_iterations ou completion_criteria
- **Success indicators**: mnimo 2 indicadores mensurveis de sucesso
- **Greeting messages**: devem incluir contexto suficiente para o agente receptor

### Critrios de Qualidade

| Check | Critrio | Blocker |
|-------|----------|---------|
| YAML vlido | Parseable sem erros | SIM |
| Campos obrigatrios | workflow_name, description, agent_sequence, transitions | SIM |
| Transitions completas | Toda conexo stepstep tem transition | SIM |
| Sem ciclos infinitos | Exit conditions para loops | SIM |
| Agentes existem | Todos os agentes referenciados so vlidos | NO (warning) |
| Key commands vlidos | Referncias a comandos reais | NO (warning) |
| Success indicators | Mnimo 2 indicadores | NO (warning) |

### Integrao com Outros Tasks

| Task Relacionada | Relao |
|-----------------|---------|
| `createAgent()` | Agentes so os executores dos steps do workflow |
| `createTask()` | Tasks so as operaes executadas em cada step |
| `createSquad()` | Squads incluem workflows como componente |
| `validateArtifact()` | Valida workflows gerados contra WORKFLOW-FORMAT-V1 |
| `analyzeAiosComponent()` | Analisa workflows existentes como referncia |
