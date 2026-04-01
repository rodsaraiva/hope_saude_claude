# AIOS Forge Squad

> Squad de desenvolvimento, otimização e evolução do framework AIOS.

[![Version](https://img.shields.io/badge/version-1.0.2-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![AIOS](https://img.shields.io/badge/AIOS-%3E%3D%202.1.0-orange)]()
[![Validation](https://img.shields.io/badge/validation-100%2F100-brightgreen)]()

## O que é

O AIOS Forge Squad é a meta-ferramenta do ecossistema AIOS: um squad que cria, valida, otimiza e moderniza o próprio framework. Com 7 agentes especializados, 14 tasks e 3 workflows, ele cobre todo o ciclo de vida de artefatos AIOS — de agentes a squads completos.

## Instalação

```bash
npx squads add gutomec/squads-sh-aios/aios-forge-squad
```

## Agentes

| Agente | ID | Papel |
|--------|-----|-------|
| Oracle | `aios-oracle` | Orquestrador — roteia requisições, coordena agentes, gerencia pipelines |
| Architect | `aios-architect` | Estrategista — projeta melhorias com awareness das 4 camadas (L1-L4) |
| Forge | `aios-forge` | Criador — gera qualquer artefato AIOS com perfeição de formato |
| Sentinel | `aios-sentinel` | Guardião — valida contra constituição, quality gates e IDS |
| Catalyst | `aios-catalyst` | Otimizador — compactação de contexto, AgentDropout, performance |
| Nexus | `aios-nexus` | Integrador — MCP, deploy, configuração, regras |
| Scout | `aios-scout` | Pesquisador — auto-atualização via web, monitoramento de novidades |

## Comandos

### Criação

```bash
@aios-forge *create-agent       # Novo agente com persona completa
@aios-forge *create-task        # Nova task com contratos I/O
@aios-forge *create-workflow    # Novo workflow multi-agente
@aios-forge *create-skill       # Nova skill para Cursor
@aios-forge *create-squad       # Novo squad completo (auto-dimensionado)
@aios-forge *create-template    # Novo template anotado
```

### Validação e Auditoria

```bash
@aios-sentinel *validate-artifact    # Valida formato + constituição + IDS
@aios-sentinel *audit-framework      # Auditoria completa do projeto
```

### Otimização

```bash
@aios-catalyst *optimize-component    # Mede, otimiza, verifica
@aios-catalyst *modernize-component   # Migra para padrões atuais
```

### Integração

```bash
@aios-nexus *integrate-config    # Configura MCP, rules, settings, deploy
```

### Pesquisa e Auto-Atualização

```bash
@aios-scout *research-updates         # Pesquisa novidades (Cursor, AIOS)
@aios-scout *self-update-knowledge    # Atualiza base de conhecimento
```

### Orquestração

```bash
@aios-oracle *analyze-component    # Análise profunda de qualquer componente
```

## Workflows

### forge_artifact

Pipeline completo de criação — da requisição ao deploy.

```
Oracle → Architect → Forge → Sentinel → Catalyst → Nexus
```

Analisa a requisição, projeta a estrutura, cria o artefato, valida contra os padrões, otimiza e integra no sistema.

### optimize_framework

Pipeline de otimização — auditoria completa até deploy das melhorias.

```
Oracle → Architect → Scout → Catalyst → Sentinel → Nexus
```

Audita o estado atual, pesquisa melhores práticas, aplica otimizações, valida conformidade e deploya.

### self_update

Pipeline de auto-atualização — pesquisa, avalia e aplica novidades.

```
Scout → Scout → Oracle → Forge → Sentinel
```

Consulta data/hora atual, pesquisa atualizações do Cursor e AIOS, avalia relevância, atualiza artefatos e valida integridade.

## Arquitetura

```
                      ┌────────────────┐
                      │  aios-oracle   │
                      │ (Orquestrador) │
                      └───────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
      ┌───────┴──────┐ ┌─────┴──────┐ ┌──────┴───────┐
      │aios-architect│ │ aios-forge  │ │aios-sentinel │
      │(Estrategista)│ │  (Criador)  │ │  (Guardião)  │
      └───────┬──────┘ └─────┬──────┘ └──────┬───────┘
              │               │               │
      ┌───────┴──────┐ ┌─────┴──────┐ ┌──────┴───────┐
      │aios-catalyst │ │ aios-nexus  │ │  aios-scout  │
      │(Otimizador)  │ │(Integrador) │ │(Pesquisador) │
      └──────────────┘ └────────────┘ └──────────────┘
```

## Estrutura

```
squads/aios-forge-squad/
├── squad.yaml                          # Manifesto
├── README.md
├── config/
│   ├── coding-standards.md             # Padrões de codificação
│   ├── tech-stack.md                   # Stack tecnológica
│   ├── source-tree.md                  # Mapa do squad
│   ├── operation-state.json            # Estado das operações
│   ├── routing-log.md                  # Log de roteamento
│   ├── knowledge-base.md               # Base de conhecimento
│   ├── update-log.md                   # Histórico de atualização
│   ├── ecosystem-status.md             # Estado do ecossistema
│   └── last-check.json                 # Última checagem
├── SQUAD_LOG.md                        # Log macro executivo do squad
├── logs/
│   ├── template.md                     # Template obrigatório de detalhamento
│   └── task-YYYYMMDD-identificador.md  # Detalhamento técnico por tarefa macro
├── scripts/                            # Scripts de validação
│   └── validate-cross-references.js
├── agents/                             # 7 agentes
│   ├── aios-oracle.md
│   ├── aios-architect.md
│   ├── aios-forge.md
│   ├── aios-sentinel.md
│   ├── aios-catalyst.md
│   ├── aios-nexus.md
│   └── aios-scout.md
├── tasks/                              # 14 tasks
│   ├── analyze-aios-component.md
│   ├── create-agent.md
│   ├── create-task.md
│   ├── create-workflow.md
│   ├── create-skill.md
│   ├── create-squad.md
│   ├── create-template.md
│   ├── validate-artifact.md
│   ├── audit-framework.md
│   ├── optimize-component.md
│   ├── modernize-component.md
│   ├── integrate-configuration.md
│   ├── research-updates.md
│   └── self-update-knowledge.md
└── workflows/                          # 3 workflows
    ├── forge-artifact.yaml
    ├── optimize-framework.yaml
    └── self-update.yaml
```

## Requisitos

- Node.js 18+
- AIOS Core >= 2.1.0
- Cursor (Fev 2026+)
- Git 2.30+

## Geração e Gates

- Regras versionadas de geração: `config/generation-constitution.md` (`v3`)
- Shell padrão para ambiente Windows: **PowerShell**
- Registro de instalação controlado por `.squad-lock.json` (`draft` ou `installed`)
- Publicação bloqueada se gates críticos falharem (referências cruzadas e handoff)
- Validação consolidada: `scripts/validate-all.js` (estrutura + cross-references + handoff + shell + docs)

## Governança e Logs (Padrão de Squad)

- Arquitetura de logs em 2 camadas:
  - `SQUAD_LOG.md`: visão macro de execução, sem poluição técnica.
  - `logs/*.md`: detalhamento técnico por tarefa macro.
- O `SQUAD_LOG.md` deve registrar somente: data/hora, tarefa macro, agentes envolvidos, status e link do detalhamento.
- Cada tarefa macro deve possuir um arquivo dedicado em `logs/` no padrão `task-YYYYMMDD-identificador.md`.
- `logs/template.md` é base obrigatória para todos os detalhamentos.

### Modelo Operacional com Coordenador

- Somente o coordenador lê e atualiza os logs (`SQUAD_LOG.md` + `logs/*.md`).
- Agentes especialistas executam tarefas delegadas e retornam resultado técnico para o coordenador.
- Em ausência de agente apto, o coordenador deve declarar explicitamente: `gap de capacidade do time`, seguido de plano de evolução.

## Runbook semanal (~10 passos)

1. Ler changelog oficial do Cursor e anotar mudanças relevantes (data + link).
2. Verificar releases AIOS/AIOX (ex.: API `SynkraAI/aiox-core`) e registrar última tag.
3. Atualizar `config/ecosystem-status.md` (Cursor, AIOS, MCP/Tools).
4. Preencher `config/last-check.json` com timestamp e fontes consultadas.
5. Consolidar achados em `config/knowledge-base.md`.
6. Registrar o ciclo em `config/update-log.md` (escopo, fontes, ações).
7. Registrar rota em `config/routing-log.md` e fechar estado em `config/operation-state.json`.
8. Rodar `node scripts/validate-all.js` dentro de `squads/aios-forge-squad`.
9. Meta semanal: manter `.squad-lock.json` como **`installed`** (zero findings high).
10. Se sair **`candidate`** ou **`draft`**, corrigir findings e revalidar antes de publicar.

## Autor

**Luiz Gustavo Vieira Rodrigues** — [@gutomec](https://github.com/gutomec)

## Licença

MIT
