---
task: createTask()
responsavel: "Forge"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: taskName
    tipo: string
    descricao: "Identificador da task em camelCase seguido de ()  ex: analyzePerformance()"
    obrigatorio: true
    validacao: "Deve seguir padro camelCase()  /^[a-z][a-zA-Z]*\\(\\)$/"
  - nome: responsavel
    tipo: string
    descricao: "Nome do agente responsvel pela execuo (PascalCase display name)"
    obrigatorio: true
    validacao: "Deve corresponder a um agente existente ou planejado no squad"
  - nome: description
    tipo: string
    descricao: "Descrio detalhada do propsito e escopo da task"
    obrigatorio: true
    validacao: "Mnimo 50 caracteres, deve ser especfico e no genrico"
  - nome: inputs
    tipo: array
    descricao: "Array de especificaes de input com nome, tipo, descrio, obrigatoriedade"
    obrigatorio: true
    validacao: "Mnimo 1 input, cada um com nome (camelCase), tipo, descrio, obrigatrio (bool)"
  - nome: outputs
    tipo: array
    descricao: "Array de especificaes de output com nome, tipo, destino, persistncia"
    obrigatorio: true
    validacao: "Mnimo 1 output, cada um com nome (camelCase), tipo, destino, persistido (bool)"
  - nome: atomicLayer
    tipo: string
    descricao: "Camada atmica: Atom | Molecule | Organism | Ecosystem"
    obrigatorio: false
    validacao: "Default: Organism. Deve refletir complexidade real da task"
  - nome: targetPath
    tipo: string
    descricao: "Path de destino para o arquivo da task"
    obrigatorio: false
    validacao: "Se no fornecido, usa squads/{squad}/tasks/{task-name}.md"

Saida:
  - nome: taskFile
    tipo: file
    descricao: "Arquivo .md completo da task seguindo TASK-FORMAT-SPECIFICATION-V1"
    destino: "squads/{squad}/tasks/{taskName-kebab}.md"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: validationResult
    tipo: object
    descricao: "Resultado da validao estrutural e de contedo"
    destino: "Memory"
    persistido: false
    formato_esperado: "Definir formato esperado do output"

Checklist:
  pre-conditions:
    - "[ ] taskName segue conveno camelCase()  ex: createAgent(), analyzePerformance()"
    - "[ ] responsavel corresponde a um agent.name existente ou planejado"
    - "[ ] description tem mnimo 50 caracteres e  especfica"
    - "[ ] inputs array tem pelo menos 1 item com todos os campos obrigatrios"
    - "[ ] outputs array tem pelo menos 1 item com todos os campos obrigatrios"
    - "[ ] No existe task com mesmo identifier no diretrio destino"
  post-conditions:
    - "[ ] Arquivo .md criado com YAML frontmatter vlido e parseable"
    - "[ ] Campos obrigatrios presentes: task, responsavel, responsavel_type, atomic_layer, Entrada, Saida, Checklist"
    - "[ ] Checklist tem pelo menos 1 pre-condition e 1 post-condition"
    - "[ ] Pipeline Diagram presente no corpo Markdown"
    - "[ ] Descrio detalhada presente com Responsabilidades e Regras"
    - "[ ] Performance section com duration_expected e cost_estimated"
    - "[ ] Error Handling section com strategy e common_errors"
    - "[ ] Metadata section com version, dependencies, tags"
    - "[ ] Contratos Entrada/Sada so tipados e descritivos"
    - "[ ] Cada item de Saida contm formato_esperado obrigatrio"

Performance:
  duration_expected: "2-4 minutos"
  cost_estimated: "~3000 tokens (Opus)"
  cacheable: false
  parallelizable: true
  skippable_when: "Nunca  tasks so o building block fundamental do AIOS"

Error Handling:
  strategy: retry
  retry:
    max_attempts: 2
    delay: "3s"
  fallback: "Gerar task com estrutura mnima e sees marcadas como TODO"
  notification: "orchestrator"
  common_errors:
    - error: "Duplicate Task Identifier"
      cause: "J existe task com mesmo identifier camelCase() no escopo"
      resolution: "Listar tasks existentes e sugerir nome alternativo"
    - error: "Invalid Task Name Format"
      cause: "Nome no segue padro camelCase()"
      resolution: "Corrigir automaticamente para camelCase e confirmar com usurio"
    - error: "Agent Not Found"
      cause: "responsavel no corresponde a nenhum agente existente"
      resolution: "Listar agentes disponveis e solicitar seleo"
    - error: "Input/Output Contract Incomplete"
      cause: "Campos obrigatrios faltando em Entrada ou Saida"
      resolution: "Solicitar campos faltantes ao usurio"

Metadata:
  story: "Como Forge Squad, preciso criar tasks com contratos formais Entrada/Sada para garantir encadeamento"
  version: "1.0.0"
  dependencies:
    - "TASK-FORMAT-SPECIFICATION-V1"
    - "Conhecimento do sistema de tasks AIOS (250+ tasks)"
  tags:
    - creation
    - task
    - contracts
    - pipeline
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# createTask()

## Pipeline Diagram

```
    
  taskName         responsavel      description  
  (camelCase)      (agent name)     (string)     
    
                                         
       
                 
  
  inputs           outputs      
  (array)         (array)      
  
                 
                 

                     Forge Agent                       
                                                      
      
   Step 1: Validate Inputs                          
    - taskName format (camelCase())                 
    - responsavel exists                             
    - no duplicates                                  
      
                                                     
      
   Step 2: Build YAML Frontmatter                   
    - task, responsavel, responsavel_type            
    - atomic_layer classification                    
    - Entrada[] contracts                            
    - Saida[] contracts                              
    - Checklist (pre/post)                           
    - Performance, Error Handling, Metadata          
      
                                                     
      
   Step 3: Generate Markdown Body                   
    - # taskName() heading                          
    - ## Pipeline Diagram (ASCII art)               
    - ## Descrio (detailed)                       
      - Responsabilidades                            
      - Regras de Execuo                           
      - Critrios de Qualidade                       
      - Integrao com Outros Tasks                  
      
                                                     
      
   Step 4: Validate & Save                          
    - YAML parseable check                          
    - Required fields check                         
    - Contract completeness check                   
    - Write file to targetPath                      
      
                                                     

                      
          
                                 
  
  taskFile             validationResult 
  (complete .md)       (quality report) 
  
```

## Descrio

A task `createTask()` gera definies de tasks AIOS completas com contratos formais de dados. Tasks so os **building blocks** do framework AIOS  cada operao executvel  uma task com inputs, outputs, pr/ps-condies e tratamento de erros definidos.

### Responsabilidades

1. **Validao de Inputs**  Verificar todos os inputs antes da gerao:
   - `taskName` deve seguir camelCase(): primeira letra minscula, palavras capitalizadas, terminado em `()`
   - `responsavel` deve corresponder a um `agent.name` existente no squad
   - `inputs` e `outputs` devem ter pelo menos 1 item cada com todos os campos necessrios
   - Verificar unicidade do identifier no escopo destino

2. **Construo do YAML Frontmatter**  Gerar o bloco YAML completo com todas as sees:

   **Campos Obrigatrios do Frontmatter:**

   | Campo | Tipo | Descrio | Exemplo |
   |-------|------|-----------|---------|
   | `task` | string | Identifier em camelCase() | `analyzePerformance()` |
   | `responsavel` | string | Agent display name | `"Oracle"` |
   | `responsavel_type` | string | Tipo do executor | `"Agente"` |
   | `atomic_layer` | string | Camada de complexidade | `"Organism"` |
   | `Entrada` | array | Contratos de input | Ver formato abaixo |
   | `Saida` | array | Contratos de output | Ver formato abaixo |
   | `Checklist` | object | Pre/post conditions | Ver formato abaixo |
   | `Performance` | object | Estimativas de performance | Ver formato abaixo |
   | `Error Handling` | object | Estratgia de erros | Ver formato abaixo |
   | `Metadata` | object | Metadados da task | Ver formato abaixo |

   **Formato de Cada Entrada[]:**
   ```yaml
   - nome: fieldName
     tipo: string | number | boolean | file | array | object
     descricao: "O que este input representa"
     obrigatorio: true | false
     validacao: "Regras de validao"
   ```

   **Formato de Cada Saida[] (OBRIGATRIO):**
   ```yaml
   - nome: fieldName
     tipo: string | number | boolean | file | array | object
     descricao: "O que este output representa"
     destino: "Para onde vai (file path, Memory, Return value)"
     persistido: true | false
     formato_esperado: "Formato exato ou contedo esperado do output (ex: cdigo TSX, JSON estruturado, comandos executveis)"
   ```

3. **Gerao do Corpo Markdown**  O corpo deve conter obrigatoriamente:

   - **Heading H1**: `# taskName()` (mesmo identifier do frontmatter)
   - **Pipeline Diagram**: Diagrama ASCII mostrando fluxo de dados de inputs  processamento  outputs
   - **Descrio**: Seo detalhada com:
     - Responsabilidades numeradas (o que a task faz)
     - **Comandos e Operaes (Actionable Steps)**: Passo a passo PRAGMÁTICO (comandos shell reais, scripts ou pseudocdigo executvel)
     - Regras de Execuo (Obrigatrio: "Ler tech-stack.md e coding-standards.md do squad antes de agir")
     - Critrios de Qualidade (o que define sucesso)
     - Integrao (como se conecta com outras tasks)

4. **Classificao Atomic Layer**  Atribuir a camada correta baseada na complexidade real:

   | Layer | Complexidade | Exemplo | Guideline |
   |-------|-------------|---------|-----------|
   | `Atom` | Operao nica, indivisvel | Ler arquivo, validar campo | 1 step, 1 input, 1 output |
   | `Molecule` | Combinao de atoms | Gerar template preenchido | 2-4 steps, poucos I/O |
   | `Organism` | Operao complexa multi-step | Criar agente completo | 5+ steps, mltiplos I/O |
   | `Ecosystem` | Orquestrao de organisms | Criar squad inteiro | 10+ steps, pipeline |

5. **Encadeamento de Contratos**  Garantir que os contratos so encadeveis:
   - Cada `Saida[].destino` indica quem consome este output
   - Cada `Entrada[].descricao` indica de onde vem este input
   - Tipos so compatveis entre produtor e consumidor
   - Campos obrigatrios tm produtores garantidos na pipeline

### Regras de Gerao

- **task identifier**: camelCase seguido de `()`  ex: `createAgent()`, `analyzePerformance()`
- **responsavel**: Nome legvel do agente (PascalCase), no o ID kebab-case
- **responsavel_type**: Sempre `"Agente"` para agents, `"Pipeline"` para workflows automatizados
- **Checklist**: Mnimo 2 pre-conditions + 2 post-conditions
- **Pipeline Diagram**: Obrigatrio, usando caracteres Unicode (       )
- **Descrio**: Mnimo 5 subsees (Responsabilidades, Actionable Steps, Regras, Qualidade, Integrao)
- **Performance**: Sempre incluir `duration_expected` e `cost_estimated`
- **Tech Stack Context**: O agente deve SEMPRE ser instrudo a consultar os padres e a stack (`config/`) antes de gerar cdigo ou arquivos no triviais.

### Diagrama Pipeline  Regras de Construo

O Pipeline Diagram deve seguir estas convenes:

```
Regras visuais:
  - Inputs à esquerda, outputs à direita
  - Processamento no centro
  - Fluxo de dados indicado com  (horizontal) ou  (vertical)
  - Boxes usando Unicode:     
  - Labels dentro dos boxes
  - Anotar tipo de dado entre parnteses: (string), (file), (array)
  - Para fluxos complexos, usar numerao: Step 1, Step 2...
```

### Validao de Qualidade

| Check | Critrio | Blocker |
|-------|----------|---------|
| YAML vlido | Frontmatter  parseable sem erros | SIM |
| Campos obrigatrios | task, responsavel, responsavel_type, atomic_layer, Entrada, Saida, Checklist | SIM |
| Contracts tipados | Cada Entrada/Saida tem tipo definido | SIM |
| formato_esperado em Saida | Cada output possui formato_esperado explcito | SIM |
| Pipeline Diagram | Presente no corpo Markdown | SIM |
| Descrio detalhada | Mnimo 5 subsees (incluindo Actionable Steps) | NO (warning) |
| Performance | duration_expected presente | NO (warning) |
| Unicidade | No existe task duplicada | SIM |

### Integrao com Outros Tasks

| Task Relacionada | Relao |
|-----------------|---------|
| `createAgent()` | Agentes referenciam tasks em command_loader |
| `createWorkflow()` | Workflows encadeiam tasks em sequncia |
| `validateArtifact()` | Valida tasks geradas contra TASK-FORMAT-V1 |
| `analyzeAiosComponent()` | Analisa tasks existentes como referncia |
| `optimizeComponent()` | Otimiza tasks com base em anlise de performance |

### Exemplo de Output Gerado

Para uma chamada `createTask({ taskName: "validateSchema()", responsavel: "Sentinel", ... })`:

```yaml
# No frontmatter:
task: validateSchema()
responsavel: "Sentinel"
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - nome: schemaPath
    tipo: string
    descricao: "Caminho para o schema a validar"
    obrigatorio: true

Saida:
  - nome: validationResult
    tipo: object
    descricao: "Resultado da validao com erros e warnings"
    destino: "Memory"
    persistido: false

# No corpo:
# validateSchema()
## Pipeline Diagram
## Descrio
```
