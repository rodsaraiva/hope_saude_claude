---
task: integrateConfiguration()
responsavel: "Nexus"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: integrationType
    tipo: string
    descricao: "Tipo de integrao: mcp|settings|rules|core-config|squad-deploy"
    obrigatorio: true
  - nome: source
    tipo: string
    descricao: "Caminho ou identificador da fonte de configurao"
    obrigatorio: true
  - nome: target
    tipo: string
    descricao: "Caminho ou identificador do destino da configurao"
    obrigatorio: true

Saida:
  - nome: configResult
    tipo: file
    descricao: "Configurao aplicada com resultado e estado final"
    obrigatorio: true
    formato_esperado: "JSON ou YAML com status final e alteraes aplicadas"
  - nome: integrationLog
    tipo: file
    descricao: "Log detalhado de todas as operaes de integrao executadas"
    obrigatorio: true
    formato_esperado: "Markdown com operaes, status, rollback e evidncias"

Checklist:
  pre-conditions:
    - "[ ] Source existe e  acessvel"
    - "[ ] Target  gravvel e est em camada mutvel (L3 ou L4)"
    - "[ ] Tipo de integrao  um dos 5 vlidos"
    - "[ ] No h conflitos conhecidos com configurao existente no target"
    - "[ ] Backup da configurao atual do target criado"
  post-conditions:
    - "[ ] Configurao aplicada com sucesso no target"
    - "[ ] Nenhum conflito com configurao existente (ou conflitos resolvidos)"
    - "[ ] Instrues de rollback documentadas no integration log"
    - "[ ] Integrao validada via teste de sanidade"
    - "[ ] Log completo com cada operao, timestamp e resultado"

Performance:
  duration_expected: "2-5 minutos"
  cost_estimated: "~2000 tokens"
  cacheable: false
  parallelizable: false
  skippable_when: "Quando configurao j est aplicada e idntica"

Error Handling:
  strategy: rollback
  fallback: "Gerar instrues manuais de integrao com comandos passo-a-passo"
  notification: "orchestrator"

Metadata:
  story: "Como framework, preciso que configuraes e integraes sejam aplicadas de forma segura e reversvel"
  version: "1.0.0"
  dependencies: []
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# integrateConfiguration()

## Pipeline Diagram

```
          
 integrationType       Nexus          Target Config     
 source                 (aios-nexus)            (estado atual)    
 target                    
              
                         
                            Backup      
                            Target      
                         
                                 
                    
                                            
                
                Detect     Apply     Verify   
               Conflicts   Config    Sanity   
                
                                            
                    
                                
                       
                                        
                    
                  config         integration
                  Result         Log.md     
                    
```

## Descrio

A task `integrateConfiguration()`  o **ponto central de integrao** do AIOS Forge Squad. Gerencia todas as operaes de configurao e deployment, garantindo que mudanas so aplicadas de forma segura, rastrevel e reversvel.

### Responsabilidades por Tipo de Integrao

1. **MCP Server Configuration** (`integrationType: mcp`):
   - Adicionar novo MCP server  configurao do Cursor
   - Remover MCP server existente
   - Atualizar configurao de MCP server (credenciais, endpoints)
   - Validar conectividade aps configurao
   - Atualizar `.cursor/settings.json` ou Docker MCP catalog conforme necessrio

   ```yaml
   # Exemplo de operao MCP
   source: "context7"  # Nome do MCP server
   target: "~/.cursor/settings.json"  # Configurao global
   ```

2. **Settings Management** (`integrationType: settings`):
   - Atualizar `.cursor/settings.json` com novas deny/allow rules
   - Gerenciar permisses de ferramentas
   - Configurar tool permissions e resource limits
   - Preservar settings existentes enquanto adiciona novos

   ```yaml
   # Exemplo de operao settings
   source: "new-deny-rules.json"
   target: ".cursor/settings.json"
   ```

3. **Rules File Management** (`integrationType: rules`):
   - Criar ou atualizar arquivos em `.cursor/rules/`
   - Configurar frontmatter `globs:` para regras contextuais
   - Validar que regras no conflitam entre si
   - Manter ndice atualizado de regras ativas

   ```yaml
   # Exemplo de operao rules
   source: "new-rule-content.md"
   target: ".cursor/rules/new-rule.md"
   ```

4. **Core Config Updates** (`integrationType: core-config`):
   - Atualizar `core-config.yaml` com novos parmetros
   - Gerenciar feature flags e toggles
   - Atualizar boundary framework protection settings
   - Validar schema do core-config aps mudana

   ```yaml
   # Exemplo de operao core-config
   source: "updated-params.yaml"
   target: "core-config.yaml"
   ```

5. **Squad Deployment** (`integrationType: squad-deploy`):
   - Copiar artefatos do squad para diretrio de destino
   - Habilitar slash commands no projeto AIOS
   - Criar `.aios-sync.yaml` para rastreamento de sincronizao
   - Registrar squad no IDS registry
   - Configurar agent IDs como comandos disponveis

   ```yaml
   # Exemplo de operao squad-deploy
   source: "squads/aios-forge-squad/"
   target: "project-x/squads/aios-forge-squad/"
   ```

### Deteco e Resoluo de Conflitos

| Tipo de Conflito | Estratgia |
|-----------------|-----------|
| Chave duplicada em JSON/YAML | Merge inteligente com preservao do existente |
| Regra contraditria | Notificar Oracle e aguardar deciso |
| Verso incompatvel | Rollback e gerar instrues de upgrade |
| Permisso insuficiente | Gerar instrues manuais com sudo/admin |

### Formato do Integration Log

```markdown
# Integration Log  {integrationType}

**Date:** ISO-8601
**Source:** {source}
**Target:** {target}
**Status:** SUCCESS | PARTIAL | FAILED

## Operations
| # | Operation | Status | Details |
|---|-----------|--------|---------|
| 1 | Backup target | OK | backup-{timestamp} |
| 2 | Detect conflicts | OK | 0 conflicts |
| 3 | Apply config | OK | N changes applied |
| 4 | Verify sanity | OK | All checks passed |

## Rollback Instructions
[Comandos exatos para reverter todas as mudanas]

## Changes Applied
[Lista detalhada de cada mudana com before/after]
```

### Regras de Segurana

- **Nunca** modificar camadas L1 (Framework Core) ou L2 (Framework Templates)
- **Sempre** criar backup antes de qualquer modificao
- **Sempre** documentar instrues de rollback
- **Nunca** aplicar configurao que cause conflito sem resoluo
- **Sempre** validar resultado aps aplicao via teste de sanidade
- Operaes em `.cursor/settings.json` requerem validao extra de schema

### Integrao com Pipeline

- **forge-artifact workflow**: integrateConfiguration()  a Fase 6 para deploy/integrao
- **optimize-framework workflow**: integrateConfiguration() deploia mudanas aps otimizao
- Oracle pode invocar diretamente para operaes de configurao standalone
- Nexus  o nico agente com permisso para modificar arquivos de configurao do framework
