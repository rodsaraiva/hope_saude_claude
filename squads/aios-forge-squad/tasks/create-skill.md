---
task: createSkill()
responsavel: "Forge"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: skillName
    tipo: string
    descricao: "Nome da skill em kebab-case  ex: code-review, deploy-preview"
    obrigatorio: true
    validacao: "Deve seguir conveno kebab-case  /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/"
  - nome: description
    tipo: string
    descricao: "Descrio clara do propsito da skill e quando deve ser ativada"
    obrigatorio: true
    validacao: "Mnimo 30 caracteres, deve incluir contexto de quando triggar"
  - nome: commands
    tipo: array
    descricao: "Array de comandos da skill com nome, descrio, args e implementao"
    obrigatorio: true
    validacao: "Mnimo 1 comando operacional. Cada comando deve ter name, description, args[]"
  - nome: triggerConditions
    tipo: string
    descricao: "Condies que ativam automaticamente esta skill no Cursor"
    obrigatorio: true
    validacao: "Deve ser especfico e no-ambguo. Ex: 'Quando o usurio pede code review'"
  - nome: agentPersona
    tipo: object
    descricao: "Persona opcional para a skill (tone, expertise, constraints)"
    obrigatorio: false
    validacao: "Se fornecido, deve ter pelo menos tone e expertise definidos"
  - nome: targetPath
    tipo: string
    descricao: "Path de destino para os arquivos da skill"
    obrigatorio: false
    validacao: "Default: .cursor/skills/ para skills globais, squads/{squad}/skills/ para squad skills"

Saida:
  - nome: skillFile
    tipo: file
    descricao: "Arquivo SKILL.md principal com definio completa da skill"
    destino: "{targetPath}/{skillName}/SKILL.md"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: commandFiles
    tipo: array
    descricao: "Arquivos de persona por comando  cada comando operacional gera um .md"
    destino: "{targetPath}/{skillName}/commands/"
    persistido: true
    formato_esperado: "Definir formato esperado do output"
  - nome: validationResult
    tipo: object
    descricao: "Resultado da validao de formato e completude"
    destino: "Memory"
    persistido: false
    formato_esperado: "Definir formato esperado do output"

Checklist:
  pre-conditions:
    - "[ ] skillName segue conveno kebab-case"
    - "[ ] No existe skill com mesmo nome no targetPath"
    - "[ ] description inclui contexto de quando ativar (trigger)"
    - "[ ] commands array tem pelo menos 1 comando operacional"
    - "[ ] triggerConditions  especfico e no-ambguo"
    - "[ ] Se agentPersona fornecido, tem tone e expertise"
  post-conditions:
    - "[ ] SKILL.md tem YAML frontmatter vlido com name, description, trigger"
    - "[ ] SKILL.md tem corpo Markdown com Usage Guide, Commands table, Agent Collaboration"
    - "[ ] Para cada comando operacional, existe arquivo de persona em commands/"
    - "[ ] Cada arquivo de comando persona tem instrues claras de execuo"
    - "[ ] Trigger conditions so claras  Cursor consegue decidir quando ativar"
    - "[ ] Nenhuma ambiguidade nos triggers  skill no conflita com outras skills existentes"
    - "[ ] Formato compatvel com .cursor/skills/ ou squad deployment"

Performance:
  duration_expected: "2-4 minutos"
  cost_estimated: "~2500 tokens (Opus)"
  cacheable: false
  parallelizable: true
  skippable_when: "Quando funcionalidade pode ser coberta por task simples sem necessidade de skill dedicada"

Error Handling:
  strategy: retry
  retry:
    max_attempts: 2
    delay: "3s"
  fallback: "Gerar SKILL.md com marcadores TODO nos comandos incompletos"
  notification: "orchestrator"
  common_errors:
    - error: "Duplicate Skill Name"
      cause: "J existe skill com mesmo nome no targetPath"
      resolution: "Listar skills existentes e sugerir nome alternativo"
    - error: "Ambiguous Trigger Condition"
      cause: "Trigger conflita com skill existente"
      resolution: "Refinar trigger para ser mais especfico e no sobrepor"
    - error: "Empty Command Implementation"
      cause: "Comando no tem instrues de execuo"
      resolution: "Adicionar instrues mnimas ou marcar como TODO"
    - error: "Invalid Persona Format"
      cause: "agentPersona no tem campos necessrios"
      resolution: "Usar persona default com tone=professional e expertise derivada da description"

Metadata:
  story: "Como Forge Squad, preciso criar skills Cursor com triggers claros e comandos operacionais"
  version: "1.0.0"
  dependencies:
    - "Cursor custom agent format"
    - "Conhecimento de .cursor/skills/ deployment"
  tags:
    - creation
    - skill
    - claude-code
    - custom-agent
    - command-persona
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# createSkill()

## Pipeline Diagram

```
    
  skillName            description          triggerConditions
  (kebab-case)         (string)             (string)        
    
                                                   
         
                    
  
  commands             agentPersona     
  (array)              (object, opt)    
  
                    
                    

                        Forge Agent                            
                                                               
   
   Step 1: Validate & Plan                                  
    - Name uniqueness check                                 
    - Trigger conflict detection                            
    - Command classification (operational vs utility)       
   
                                                             
   
   Step 2: Generate SKILL.md                                
                                                             
     YAML Frontmatter    
      name: skill-name                                     
      description: "..."                                   
      trigger:                                             
        conditions: ["condition 1", "condition 2"]         
        keywords: ["keyword1", "keyword2"]                 
      persona: (optional)                                  
        tone: professional                                 
        expertise: "domain"                                
      commands: [...]                                      
       
                                                             
     Markdown Body    
      ## Usage Guide                                       
      ## Commands (tabela)                                 
      ## Agent Collaboration                               
      ## Examples                                          
       
   
                                                             
   
   Step 3: Generate Command Persona Files                   
                                                             
    Para cada comando operacional:                           
                       
      commands/{command-name}.md                            
      - Instrues de execuo                             
      - Contexto e constraints                             
      - Output format esperado                             
      - Error handling                                     
                       
   
                                                             
   
   Step 4: Validate All Files                               
    - SKILL.md YAML check                                   
    - Command files exist for each command                  
    - No trigger conflicts with existing skills             
   
                                                             

                          
          
                                        
    
  SKILL.md         commands/        validation   
  (main file)      *.md files      Result       
    
```

## Descrio

A task `createSkill()` gera skills para o Cursor seguindo o formato de custom agents. Skills so **capacidades especializadas** que podem ser ativadas automaticamente por trigger conditions ou manualmente por comando. Cada skill inclui um arquivo principal (SKILL.md) e arquivos de persona por comando.

### Responsabilidades

1. **Validao e Planejamento**  Verificar inputs e planejar a estrutura:
   - Verificar unicidade do nome no targetPath
   - Detectar conflitos de trigger com skills existentes
   - Classificar comandos como operacionais (produzem output) ou utility (*help, *exit)
   - Determinar path de deploy (.cursor/skills/ ou squads/{squad}/skills/)

2. **Gerao do SKILL.md**  Criar o arquivo principal com 2 blocos:

   **YAML Frontmatter da Skill:**
   ```yaml
   name: "skill-name"
   description: "Descrio completa do que a skill faz"
   version: "1.0.0"

   trigger:
     conditions:
       - "Quando o usurio pede X"
       - "Quando o contexto envolve Y"
     keywords:
       - "keyword1"
       - "keyword2"
     auto_activate: true | false

   persona:
     tone: "professional | casual | technical | friendly"
     expertise: "Área de expertise principal"
     constraints:
       - "Constraint 1  o que NO fazer"
       - "Constraint 2"

   commands:
     - name: "/command-name"
       description: "O que faz"
       args:
         - name: "arg1"
           type: "string"
           required: true
           description: "Descrio do argumento"
       persona_file: "commands/command-name.md"
   ```

   **Markdown Body:**

   | Seo | Contedo | Obrigatrio |
   |-------|----------|-------------|
   | Usage Guide | Como usar a skill, quando ativar, exemplos de invocao | SIM |
   | Commands | Tabela com todos os comandos, args e descries | SIM |
   | Agent Collaboration | Como a skill interage com outros agentes/skills | SIM |
   | Examples | Exemplos reais de uso com input  output | NO (recomendado) |
   | Limitations | O que a skill NO faz | NO (recomendado) |

3. **Gerao de Command Persona Files**  Para cada comando operacional:

   Cada comando gera um arquivo `commands/{command-name}.md` contendo:

   ```markdown
   # /command-name

   ## Propsito
   Descrio detalhada do que este comando faz.

   ## Instrues de Execuo
   Passo a passo de como executar este comando:
   1. Step 1: ...
   2. Step 2: ...
   3. Step 3: ...

   ## Contexto e Constraints
   - Constraint 1
   - Constraint 2

   ## Output Format
   Formato esperado do output:
   (template ou exemplo)

   ## Error Handling
   - Se X acontecer: fazer Y
   - Se Z acontecer: fazer W
   ```

   **Regras para Command Personas:**
   - Instrues devem ser detalhadas o suficiente para execuo determinstica
   - Output format deve ser claro e consistente
   - Error handling deve cobrir os 3 erros mais comuns
   - Constraints devem prevenir comportamento indesejado

4. **Validao Final**  Antes de finalizar:
   - SKILL.md tem YAML vlido
   - Cada comando operacional tem arquivo de persona correspondente
   - Triggers no conflitam com skills existentes no mesmo scope
   - Formato  compatvel com deploy target

### Deployment Models

Skills podem ser deployadas em 2 modelos:

| Modelo | Path | Visibilidade | Uso |
|--------|------|-------------|-----|
| **Global** | `.cursor/skills/{skill-name}/` | Disponvel em todos os projetos | Skills utilitrias gerais |
| **Squad** | `squads/{squad}/skills/{skill-name}/` | Disponvel apenas no contexto do squad | Skills especializadas |

### Trigger System

O sistema de triggers define quando a skill  automaticamente sugerida ou ativada:

```yaml
trigger:
  # Condies textuais  Cursor avalia contra a mensagem do usurio
  conditions:
    - "Quando o usurio menciona 'code review' ou 'revisar cdigo'"
    - "Quando o contexto envolve anlise de qualidade de cdigo"

  # Keywords  matching rpido antes de avaliao semntica
  keywords:
    - "code review"
    - "review"
    - "quality check"

  # Auto-ativao  se true, skill  ativada automaticamente quando trigger match
  # Se false, skill  sugerida mas requer confirmao do usurio
  auto_activate: false

  # Prioridade  quando mltiplas skills matcham, maior prioridade vence
  priority: 5  # 1-10, default 5
```

**Regras de Trigger:**
- Conditions devem ser mutuamente exclusivas com outras skills (sem overlap)
- Keywords devem ser especficas (evitar termos genricos como "code" ou "help")
- `auto_activate: true` requer alta confiana no trigger (>= 0.9)
- Se trigger conflita com skill existente, RECUSAR e pedir refinamento

### Compatibilidade Cursor

A skill gerada deve ser compatvel com o formato de custom agents do Cursor:

```
{skill-name}/
 SKILL.md           # Arquivo principal com definio
 commands/
    command-1.md   # Persona do comando 1
    command-2.md   # Persona do comando 2
    ...
 data/              # (opcional) Dados de referncia
     reference.md
```

O Cursor carrega SKILL.md como "agent file" e os arquivos de comando como "persona files" que so injetados no contexto quando o comando  invocado.

### Integrao com Outros Tasks

| Task Relacionada | Relao |
|-----------------|---------|
| `createAgent()` | Agents so mais completos que skills  skill  agent "lightweight" |
| `createTask()` | Commands da skill referenciam tasks para operaes complexas |
| `createSquad()` | Squads podem incluir skills como componente |
| `validateArtifact()` | Valida skills geradas contra formato Cursor |
| `analyzeAiosComponent()` | Analisa skills existentes para referncia e conflito de trigger |
