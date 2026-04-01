---
task: createTemplate()
responsavel: "Forge"
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - nome: templateName
    tipo: string
    descricao: "Nome do template em kebab-case  ex: agent-persona-tmpl, task-definition-tmpl"
    obrigatorio: true
    validacao: "Deve seguir conveno kebab-case, idealmente terminando em -tmpl"
  - nome: templateType
    tipo: string
    descricao: "Tipo de artefato AIOS que este template gera: agent | task | workflow | story | doc"
    obrigatorio: true
    validacao: "Deve ser um dos 5 tipos vlidos de artefato AIOS"
  - nome: placeholders
    tipo: array
    descricao: "Array de especificaes de placeholder com name, type, description, required, default"
    obrigatorio: true
    validacao: "Mnimo 1 placeholder. Cada um deve ter name, description e required definidos"
  - nome: targetContext
    tipo: string
    descricao: "Contexto de deploy: core (framework), squad (squad-specific), project (projeto)"
    obrigatorio: false
    validacao: "Default: squad. Determina path de destino"
  - nome: exampleValues
    tipo: object
    descricao: "Valores de exemplo para cada placeholder (opcional, usado para gerar preview)"
    obrigatorio: false
    validacao: "Se fornecido, deve ter key para cada placeholder required"

Saida:
  - nome: templateFile
    tipo: file
    descricao: "Arquivo de template anotado com placeholders e instrues"
    destino: "squads/{squad}/templates/{templateName}.md ou .aios-core/development/templates/"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: validationResult
    tipo: object
    descricao: "Resultado da validao do template"
    destino: "Memory"
    persistido: false
    formato_esperado: "Definir formato esperado do output"

Checklist:
  pre-conditions:
    - "[ ] templateName segue conveno kebab-case"
    - "[ ] templateType  um dos 5 tipos vlidos: agent, task, workflow, story, doc"
    - "[ ] placeholders array tem pelo menos 1 item com campos obrigatrios"
    - "[ ] No existe template com mesmo nome no contexto destino"
    - "[ ] Cada placeholder tem name (SCREAMING_SNAKE_CASE), description e required"
  post-conditions:
    - "[ ] Arquivo de template criado com todos os placeholders marcados"
    - "[ ] Template segue o formato exato do artifact type alvo"
    - "[ ] Cada placeholder tem anotao com instrues de preenchimento"
    - "[ ] Template  auto-documentado  qualquer pessoa consegue us-lo"
    - "[ ] Sees obrigatrias do artifact type esto presentes"
    - "[ ] Se exampleValues fornecido, preview renderizado est correto"

Performance:
  duration_expected: "1-3 minutos"
  cost_estimated: "~1500 tokens (Opus)"
  cacheable: true
  parallelizable: true
  skippable_when: "Quando artefato pode ser criado diretamente sem template reutilizvel"

Error Handling:
  strategy: retry
  retry:
    max_attempts: 2
    delay: "3s"
  fallback: "Gerar template esqueleto com placeholders bsicos e instrues mnimas"
  notification: "orchestrator"
  common_errors:
    - error: "Duplicate Template Name"
      cause: "J existe template com mesmo nome no contexto"
      resolution: "Listar templates existentes e sugerir nome alternativo"
    - error: "Invalid Template Type"
      cause: "templateType no  um dos 5 valores vlidos"
      resolution: "Listar tipos vlidos e solicitar seleo"
    - error: "Placeholder Name Conflict"
      cause: "Dois placeholders com mesmo name"
      resolution: "Renomear placeholder duplicado com sufixo numrico"
    - error: "Missing Required Artifact Sections"
      cause: "Template no contm sees obrigatrias do artifact type"
      resolution: "Adicionar sees faltantes com placeholders adequados"

Metadata:
  story: "Como Forge Squad, preciso criar templates anotados para gerao consistente de artefatos AIOS"
  version: "1.0.0"
  dependencies:
    - "Conhecimento dos formatos de artefatos AIOS (agent, task, workflow, story, doc)"
    - "AIOS template annotation convention"
  tags:
    - creation
    - template
    - scaffold
    - reusability
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# createTemplate()

## Pipeline Diagram

```
    
  templateName         templateType         placeholders     
  (kebab-case)         (artifact type)      (array)          
    
                                                   
         
                    

  targetContext    
  (core|squad|    
   project)       

                    
                    

                        Forge Agent                            
                                                               
   
   Step 1: Resolve Artifact Format                          
                                                             
    templateType  Format Specification                    
                                                             
    agent     AGENT-PERSONALIZATION-STANDARD-V1             
    task      TASK-FORMAT-SPECIFICATION-V1                  
    workflow  WORKFLOW-FORMAT-SPECIFICATION-V1              
    story     STORY-FORMAT-V1                               
    doc       DOCUMENTATION-FORMAT-V1                       
   
                                                             
   
   Step 2: Map Placeholders to Format Sections              
                                                             
    Placeholder            Format Section                    
                              
    {{AGENT_NAME}}      name: field                       
    {{AGENT_ROLE}}      persona.role                      
    {{TASK_INPUTS}}     Entrada[] array                   
    {{DESCRIPTION}}     description field                 
                                                             
    + Identify MISSING placeholders for required sections    
    + Add auto-generated placeholders for required fields    
   
                                                             
   
   Step 3: Generate Annotated Template                      
                                                             
       
      <!-- TEMPLATE: {templateName}                        
           Type: {templateType}                            
           Version: 1.0.0                                  
           Placeholders: N                                 
      -->                                                  
                                                           
      ---                                                  
      ## YAML frontmatter com {{PLACEHOLDERS}}             
      ---                                                  
                                                           
      # {{TITLE}}                                          
      <!-- Instruo: Ttulo do artefato -->               
                                                           
      ## Seo com {{PLACEHOLDER}}                         
      <!-- Instruo: Como preencher esta seo -->        
       
   
                                                             
   
   Step 4: Validate & Save                                  
    - All required placeholders present                     
    - Template follows artifact format                      
    - Annotations are clear and actionable                  
    - Write to targetContext path                           
   
                                                             

                          
              
                                     
     
     templateFile         validationResult 
     (annotated .md)      (quality check)  
     
```

## Descrio

A task `createTemplate()` gera templates anotados para criao consistente de artefatos AIOS. Templates so **blueprints reutilizveis** que garantem que novos artefatos seguem o formato correto do tipo de artefato alvo, com placeholders documentados e instrues claras de preenchimento.

### Responsabilidades

1. **Resoluo do Formato do Artefato**  Identificar o formato specification correto:

   | templateType | Format Specification | Sees Obrigatrias |
   |-------------|---------------------|-------------------|
   | `agent` | AGENT-PERSONALIZATION-STANDARD-V1 | persona_profile, greeting_levels, persona, commands, dependencies |
   | `task` | TASK-FORMAT-SPECIFICATION-V1 | task(), Entrada, Saida, Checklist, Performance, Error Handling, Metadata, Pipeline Diagram, Descrio |
   | `workflow` | WORKFLOW-FORMAT-SPECIFICATION-V1 | workflow_name, agent_sequence, transitions, key_commands, success_indicators |
   | `story` | STORY-FORMAT-V1 | title, status, tasks[], acceptance_criteria, file_list |
   | `doc` | DOCUMENTATION-FORMAT-V1 | title, purpose, content, references |

2. **Mapeamento de Placeholders**  Conectar cada placeholder fornecido a uma seo do formato:
   - Verificar que todas as sees obrigatrias do formato tm placeholder correspondente
   - Identificar sees que ficaram sem placeholder  adicionar placeholders auto-gerados
   - Garantir que nomes de placeholder so nicos e em `SCREAMING_SNAKE_CASE`

   **Conveno de Naming de Placeholders:**
   ```
   {{AGENT_NAME}}           Identificador em kebab-case
   {{AGENT_ROLE}}           Descrio do papel
   {{TASK_IDENTIFIER}}      camelCase()
   {{TASK_INPUTS}}          Array de Entrada
   {{WORKFLOW_NAME}}        snake_case
   {{DESCRIPTION}}          Texto livre
   {{CUSTOM_SECTION}}       Seo customizada
   ```

3. **Gerao do Template Anotado**  Criar o arquivo com 3 camadas de informao:

   **Camada 1: Header de Template**
   ```markdown
   <!-- TEMPLATE: template-name
        Type: artifact-type
        Version: 1.0.0
        Created: YYYY-MM-DD
        Placeholders: N required, M optional

        INSTRUCTIONS:
        1. Copy this template to the appropriate directory
        2. Replace ALL {{PLACEHOLDER}} markers with actual values
        3. Remove all <!-- instruction --> comments after filling
        4. Validate the result with validateArtifact()
   -->
   ```

   **Camada 2: Estrutura do Artefato com Placeholders**
   ```yaml
   ---
   # YAML frontmatter fields com {{PLACEHOLDERS}}
   field_name: {{PLACEHOLDER_NAME}}
   # <!-- Instruo: como preencher este campo -->
   ---
   ```

   **Camada 3: Anotaes Inline**
   ```markdown
   ## Section Title
   <!-- PLACEHOLDER: {{SECTION_CONTENT}}
        Required: true
        Type: markdown
        Description: Descrio detalhada do que colocar aqui
        Example: "Exemplo concreto de contedo"
   -->
   {{SECTION_CONTENT}}
   ```

4. **Tipos de Placeholder e Suas Anotaes:**

   | Tipo | Formato | Anotao | Exemplo |
   |------|---------|----------|---------|
   | `string` | `{{NAME}}` | Texto simples, 1 linha | `{{AGENT_NAME}}`  "data-engineer" |
   | `text` | `{{NAME}}` | Texto multilinha | `{{DESCRIPTION}}`  "Descrio longa..." |
   | `array` | `{{NAME}}` | Lista YAML | `{{COMMANDS}}`  "- cmd1\n- cmd2" |
   | `yaml` | `{{NAME}}` | Bloco YAML completo | `{{ENTRADA}}`  YAML block |
   | `choice` | `{{NAME}}` | Seleo de opes | `{{ARCHETYPE}}`  "strategist\|executor\|..." |
   | `computed` | `{{NAME}}` | Derivado de outros placeholders | `{{DISPLAY_NAME}}`  PascalCase de {{NAME}} |

5. **Validao do Template**  Antes de salvar:
   - Todos os placeholders required tm anotaes
   - Template segue o formato do artifact type
   - Nenhum placeholder rfo (referenciado mas no definido)
   - Nenhum placeholder duplicado
   - Instrues so claras e no ambguas
   - Se exampleValues fornecido, rendering funciona

### Templates por Artifact Type

**Template para Agent (`templateType=agent`):**
```
Placeholders obrigatrios:
  {{AGENT_NAME}}       string, name field
  {{AGENT_ID}}         string, id field (kebab-case)
  {{AGENT_TITLE}}      string, title field
  {{AGENT_ICON}}       string, emoji
  {{WHEN_TO_USE}}      text, whenToUse
  {{ARCHETYPE}}        choice, persona_profile.archetype
  {{ROLE}}             text, persona.role
  {{STYLE}}            text, persona.style
  {{COMMANDS}}         yaml, commands array
  {{DEPENDENCIES}}     yaml, dependencies object

Placeholders opcionais:
  {{CORE_PRINCIPLES}}  array, core_principles
  {{BOUNDARIES}}       yaml, responsibility_boundaries
  {{GREETING_BRIEF}}   string, greeting_levels.brief
```

**Template para Task (`templateType=task`):**
```
Placeholders obrigatrios:
  {{TASK_NAME}}        string, task field (camelCase())
  {{RESPONSAVEL}}      string, responsavel
  {{ATOMIC_LAYER}}     choice, atomic_layer
  {{ENTRADA}}          yaml, Entrada array
  {{SAIDA}}            yaml, Saida array
  {{PRE_CONDITIONS}}   array, Checklist.pre-conditions
  {{POST_CONDITIONS}}  array, Checklist.post-conditions
  {{DESCRIPTION}}      text, corpo Markdown
  {{PIPELINE_DIAGRAM}} text, diagrama ASCII

Placeholders opcionais:
  {{PERFORMANCE}}      yaml, Performance section
  {{ERROR_HANDLING}}   yaml, Error Handling section
  {{METADATA}}         yaml, Metadata section
```

### Deploy Contexts

| Context | Path | Uso |
|---------|------|-----|
| `core` | `.aios-core/development/templates/` | Templates do framework (L2, extend-only) |
| `squad` | `squads/{squad}/templates/` | Templates especficos do squad (L4) |
| `project` | `templates/` (root) | Templates do projeto (L4) |

**Regra de Deploy:**
- Templates para `core` context requerem que o componente NO exista em L2 (extend-only, no override)
- Templates para `squad` e `project` so sempre permitidos (L4)

### Critrios de Qualidade

| Check | Critrio | Blocker |
|-------|----------|---------|
| Placeholders anotados | Cada required placeholder tem instruo | SIM |
| Formato correto | Template segue artifact type specification | SIM |
| Sem rfos | Todos os placeholders referenciados esto definidos | SIM |
| Auto-documentado | Qualquer pessoa consegue usar o template | NO (warning) |
| Exemplos | exampleValues fornecidos e rendering correto | NO (recomendado) |

### Integrao com Outros Tasks

| Task Relacionada | Relao |
|-----------------|---------|
| `createAgent()` | Usa templates do tipo agent para gerar agentes |
| `createTask()` | Usa templates do tipo task para gerar tasks |
| `createWorkflow()` | Usa templates do tipo workflow para gerar workflows |
| `createSquad()` | Usa mltiplos templates durante criao do squad |
| `validateArtifact()` | Valida templates contra format specifications |
| `analyzeAiosComponent()` | Analisa templates existentes como referncia |
