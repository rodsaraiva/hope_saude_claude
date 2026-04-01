---
task: createAgent()
responsavel: "Forge"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: agentName
    tipo: string
    descricao: "Nome do agente em kebab-case (ex: aios-oracle, data-engineer)"
    obrigatorio: true
    validacao: "Deve seguir conveno kebab-case, sem espaos ou caracteres especiais"
  - nome: agentRole
    tipo: string
    descricao: "Descrio concisa do papel/funo do agente no squad"
    obrigatorio: true
    validacao: "Deve ser no-vazio e descrever claramente a responsabilidade"
  - nome: archetype
    tipo: string
    descricao: "Arqutipo comportamental (strategist, executor, analyst, guardian, creator, connector)"
    obrigatorio: true
    validacao: "Deve ser um dos arqutipos vlidos do AIOS"
  - nome: commands
    tipo: array
    descricao: "Especificaes de comandos do agente com nome, descrio, visibilidade e args"
    obrigatorio: true
    validacao: "Mnimo 3 comandos (*help, *exit + pelo menos 1 operacional)"
  - nome: dependencies
    tipo: object
    descricao: "Objeto com tasks, templates, checklists e data files que o agente usa"
    obrigatorio: false
    validacao: "Se fornecido, todos os artefatos referenciados devem existir ou sero marcados como TODO"
  - nome: targetSquad
    tipo: string
    descricao: "Nome do squad destino para salvar o agente (kebab-case)"
    obrigatorio: false
    validacao: "Se fornecido, squad deve existir em squads/"

Saida:
  - nome: agentFile
    tipo: file
    descricao: "Arquivo .md completo do agente seguindo AGENT-PERSONALIZATION-STANDARD-V1"
    destino: "squads/{targetSquad}/agents/{agentName}.md"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: validationResult
    tipo: object
    descricao: "Resultado da validao de formato e qualidade do agente gerado"
    destino: "Memory"
    persistido: false
    formato_esperado: "Definir formato esperado do output"
  - nome: commandLoaderBlock
    tipo: object
    descricao: "Bloco command_loader gerado para o agente"
    destino: "Embutido no agentFile"
    persistido: true
    formato_esperado: "Definir formato esperado do output"

Checklist:
  pre-conditions:
    - "[ ] agentName segue conveno kebab-case"
    - "[ ] No existe agente com mesmo ID no squad destino"
    - "[ ] agentRole  no-vazio e descritivo"
    - "[ ] archetype  um dos valores vlidos (strategist, executor, analyst, guardian, creator, connector)"
    - "[ ] commands array contm pelo menos 3 comandos incluindo *help e *exit"
    - "[ ] Se targetSquad fornecido, diretrio squads/{targetSquad}/ existe"
  post-conditions:
    - "[ ] Arquivo do agente segue AGENT-PERSONALIZATION-STANDARD-V1 completo"
    - "[ ] YAML frontmatter  vlido e parseable"
    - "[ ] Todas as 3 sees Markdown presentes: Quick Commands, Agent Collaboration, Usage Guide"
    - "[ ] persona_profile contm archetype e communication style"
    - "[ ] greeting_levels tem 3 nveis (brief, standard, detailed)"
    - "[ ] persona contm role, style, identity, focus, core_principles, responsibility_boundaries"
    - "[ ] Todos os comandos tm visibility, description e args definidos"
    - "[ ] command_loader mapeia todos os comandos operacionais para task files"
    - "[ ] Bloco CRITICAL_LOADER_RULE presente no corpo do agente (verbatim)"
    - "[ ] dependencies referenciam artefatos existentes ou marcados com TODO"
    - "[ ] Linha count >= 200 para agente bsico, >= 300 para agente completo"

Performance:
  duration_expected: "3-5 minutos"
  cost_estimated: "~4000 tokens (Opus)"
  cacheable: false
  parallelizable: false
  skippable_when: "Nunca  agente  artefato fundamental do AIOS"

Error Handling:
  strategy: retry
  retry:
    max_attempts: 2
    delay: "5s"
  fallback: "Gerar template do agente com marcadores TODO nos campos incompletos"
  notification: "orchestrator"
  common_errors:
    - error: "Duplicate Agent ID"
      cause: "J existe agente com mesmo nome no squad"
      resolution: "Verificar agentes existentes e sugerir nome alternativo"
    - error: "Invalid Archetype"
      cause: "Arqutipo fornecido no  um dos valores vlidos"
      resolution: "Listar arqutipos vlidos e solicitar seleo"
    - error: "Missing Dependencies"
      cause: "Artefatos em dependencies no existem no filesystem"
      resolution: "Marcar como TODO e listar para criao posterior"

Metadata:
  story: "Como Forge Squad, preciso criar agentes completos que seguem o padro AIOS"
  version: "1.0.0"
  dependencies:
    - "AGENT-PERSONALIZATION-STANDARD-V1"
    - "Conhecimento do sistema de agentes AIOS (11 core agents)"
  tags:
    - creation
    - agent
    - persona
    - command-loader
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# createAgent()

## Pipeline Diagram

```
    
  agentName        agentRole        archetype    
  (string)         (string)         (string)     
    
                                         
       
                 
                 

                     Forge Agent                       
                                                      
       
   1. Validate  2. Structure  3. Generate  
      Inputs         Persona         File      
       
                                                    
                     
   5. Validate  4. Build             
      Output         CmdLoader                    
                       
                                                     

          
          
  
  agentFile           validationResult 
  (.md completo)      (quality check)  
  
          
          

  Estrutura do Arquivo do Agente           
                                           
   YAML Frontmatter  
    persona_profile                      
    greeting_levels (3)                  
    persona (role/style/identity/focus)  
    core_principles                      
    responsibility_boundaries            
    commands[]                           
    command_loader{}                     
    dependencies{}                       
   
                                           
   Markdown Body  
    ## Quick Commands (tabela)           
    ## Agent Collaboration               
      - Receives From                    
      - Hands Off To                     
      - Shared Artifacts                 
    ## Usage Guide                       
      - Operaes detalhadas             
      - Exemplos de uso                  
   

```

## Descrio

A task `createAgent()`  uma das **tasks fundamentais** do AIOS Forge Squad. Gera um arquivo de agente completo seguindo o padro AGENT-PERSONALIZATION-STANDARD-V1, incluindo YAML frontmatter com persona, comandos e command_loader, alm do corpo Markdown com documentao operacional.

### Responsabilidades

1. **Validao de Inputs**  Verificar que todos os inputs obrigatrios esto presentes e vlidos antes de iniciar a gerao:
   - agentName segue kebab-case (`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`)
   - No existe agente duplicado no squad destino
   - archetype  um valor reconhecido
   - commands tem pelo menos 3 entries

2. **Estruturao da Persona**  Construir a persona completa do agente baseada nos inputs:
   - **persona_profile**: archetype (ex: "O Guardio Analtico"), communication (tom, verbosidade, formalidade)
   - **greeting_levels**: 3 nveis de saudao (brief para YOLO mode, standard para Interactive, detailed para Pre-Flight)
   - **persona**: role (responsabilidade central), style (como se comunica), identity (quem ), focus (objetivo primrio)
   - **core_principles**: 5-10 princpios fundamentais derivados do role e archetype
   - **responsibility_boundaries**: o que o agente FAZ e o que NO FAZ (delega)

3. **Gerao do Arquivo**  Criar o arquivo .md com estrutura completa:

   **YAML Frontmatter** deve incluir:
   ```yaml
   name: "Agent Name"
   id: agent-name
   title: "Ttulo descritivo"
   icon: "emoji apropriado"
   whenToUse: "Descrio de quando ativar este agente"

   persona_profile:
     archetype: "Descrio do arqutipo"
     communication:
       tom: formal | casual | tcnico
       verbosity: concise | moderate | detailed
       formality: high | medium | low

   greeting_levels:
     brief: "Saudao curta (1 linha)"
     standard: "Saudao padro (2-3 linhas)"
     detailed: "Saudao detalhada com contexto (5+ linhas)"

   persona:
     role: "Descrio da responsabilidade"
     style: "Como se comunica e opera"
     identity: "Quem  este agente"
     focus: "Objetivo primrio"

   core_principles:
     - "Princpio 1"
     - "Princpio 2"

   responsibility_boundaries:
     owns:
       - "Responsabilidade exclusiva 1"
     delegates:
       - "Delega para @outro-agente: operao X"

   commands:
     - name: "*command"
       description: "O que faz"
       visibility: full | quick | key | hidden
       args:
         - name: arg1
           type: string
           required: true

   command_loader:
     "*command":
       description: "O que faz"
       requires:
         - "tasks/command-workflow.md"
       optional:
         - "data/reference-data.md"

   dependencies:
     tasks: []
     templates: []
     checklists: []
     data: []
   ```

   **Markdown Body** deve incluir 3 sees obrigatrias:

   | Seo | Contedo |
   |-------|----------|
   | Quick Commands | Tabela com todos os comandos, descrio e args |
   | Agent Collaboration | Receives From, Hands Off To, Shared Artifacts |
   | Usage Guide | Instrues detalhadas de operao com exemplos |
   | CRITICAL_LOADER_RULE | Bloco obrigatrio de instruo ao modelo |

4. **Build do Command Loader**  Para cada comando operacional (no utility):
   - Mapear para task file correspondente em `requires[]`
   - Adicionar data files opcionais em `optional[]`
   - Incluir `CRITICAL_LOADER_RULE` no corpo do agente:
     ```markdown
     # CRITICAL_LOADER_RULE
     SEMPRE que o usurio invocar um comando listado em `command_loader`, voc DEVE usar a tool de leitura para abrir e ler TODOS os arquivos listados em `requires` ANTES de agir ou responder. Nunca tente executar os comandos de memria. Siga estritamente as instrues e "Actionable Steps" descritos nos arquivos lidos.
     ```
   - Garantir que command_loader cobre TODOS os comandos operacionais
   - Em caso de ausncia de `command_loader` ou `CRITICAL_LOADER_RULE`, o artefato  automaticamente classificado como **FAILED**

5. **Validao do Output**  Executar validao de qualidade antes de salvar:
   - YAML  parseable sem erros
   - Todas as sees obrigatrias presentes
   - Contagem de linhas >= 200
   - Comandos todos documentados
   - Dependencies verificadas (existem ou marcadas TODO)

### Arqutipos Vlidos

| Archetype | Descrio | Exemplo de Agente |
|-----------|-----------|-------------------|
| `strategist` | Planeja, prioriza, orquestra | @pm, @po, @sm |
| `executor` | Implementa, constri, codifica | @dev, @forge |
| `analyst` | Analisa, pesquisa, diagnostica | @analyst, @oracle |
| `guardian` | Valida, protege, audita | @qa, @sentinel |
| `creator` | Cria, inova, gera | @forge, @catalyst |
| `connector` | Integra, conecta, sincroniza | @nexus, @devops |

### Regras de Gerao

- **Nomes**: `agentName` em kebab-case no ID, PascalCase no display name
- **Comandos**: Mnimo 3 (`*help`, `*exit` + operacionais), cada um com visibility
- **Persona**: Coerente com archetype  um `guardian` no deve ter tom casual por default
- **Core Principles**: Derivados do role, no genricos  devem ser especficos ao domnio
- **Boundaries**: Explcitas  o que FAZ e o que DELEGA para outros agentes
- **Command Loader**: Todo comando operacional DEVE ter entry no command_loader
- **CRITICAL_LOADER_RULE**: Deve estar presente verbatim no agente

### Validao de Qualidade (SC_AGT_001 Adaptado)

| Dimenso | Peso | Critrio |
|----------|------|----------|
| Estrutura | 0.25 | YAML vlido, sees presentes, formato correto |
| Persona | 0.20 | Role/style/identity coerentes com archetype |
| Comandos | 0.20 | Todos documentados, command_loader completo |
| Principles | 0.15 | Especficos ao domnio, mnimo 5 |
| Boundaries | 0.10 | Owns e delegates explcitos |
| Documentation | 0.10 | Quick Commands, Collaboration, Usage Guide presentes |

**Threshold**: Score >= 7.0 para PASS, < 7.0 requer iterao.

### Integrao com Outros Tasks

| Task Relacionada | Relao |
|-----------------|---------|
| `createTask()` | Cria task files referenciados no command_loader |
| `createTemplate()` | Cria templates referenciados em dependencies |
| `validateArtifact()` | Valida o agente gerado contra SC_AGT_001 |
| `analyzeAiosComponent()` | Analisa agentes existentes para referncia |
| `createSquad()` | Usa createAgent() para gerar cada agente do squad |
