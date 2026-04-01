# AIOS Forge Squad

> Development, optimization, and evolution squad for the AIOS framework.

[![Version](https://img.shields.io/badge/version-1.0.2-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![AIOS](https://img.shields.io/badge/AIOS-%3E%3D%202.1.0-orange)]()
[![Validation](https://img.shields.io/badge/validation-100%2F100-brightgreen)]()

## What is it

AIOS Forge Squad is the AIOS ecosystem's meta-tool: a squad that creates, validates, optimizes, and modernizes the framework itself. With 7 specialized agents, 14 tasks, and 3 workflows, it covers the entire lifecycle of AIOS artifacts — from agents to full squads.

## Installation

```bash
npx squads add gutomec/squads-sh-aios/aios-forge-squad
```

## Agents

| Agent | ID | Role |
|-------|-----|------|
| Oracle | `aios-oracle` | Orchestrator — routes requests, coordinates agents, manages pipelines |
| Architect | `aios-architect` | Strategist — designs improvements with 4-layer awareness (L1-L4) |
| Forge | `aios-forge` | Creator — generates any AIOS artifact with perfect format adherence |
| Sentinel | `aios-sentinel` | Guardian — validates against constitution, quality gates, and IDS |
| Catalyst | `aios-catalyst` | Optimizer — context compaction, AgentDropout, performance tuning |
| Nexus | `aios-nexus` | Integrator — MCP, deploy, configuration, rules |
| Scout | `aios-scout` | Researcher — self-update via web, monitors for updates |

## Commands

### Creation

```bash
@aios-forge *create-agent       # New agent with full persona
@aios-forge *create-task        # New task with I/O contracts
@aios-forge *create-workflow    # New multi-agent workflow
@aios-forge *create-skill       # New Cursor skill
@aios-forge *create-squad       # New complete squad (7 phases)
@aios-forge *create-template    # New annotated template
```

### Validation & Audit

```bash
@aios-sentinel *validate-artifact    # Validates format + constitution + IDS
@aios-sentinel *audit-framework      # Full project audit
```

### Optimization

```bash
@aios-catalyst *optimize-component    # Measure, optimize, verify
@aios-catalyst *modernize-component   # Migrate to current standards
```

### Integration

```bash
@aios-nexus *integrate-config    # Configure MCP, rules, settings, deploy
```

### Research & Self-Update

```bash
@aios-scout *research-updates         # Research updates (Cursor, AIOS)
@aios-scout *self-update-knowledge    # Update knowledge base
```

### Orchestration

```bash
@aios-oracle *analyze-component    # Deep analysis of any component
```

## Workflows

### forge_artifact

Full creation pipeline — from request to deploy.

```
Oracle → Architect → Forge → Sentinel → Catalyst → Nexus
```

Analyzes the request, designs the structure, creates the artifact, validates against standards, optimizes, and integrates into the system.

### optimize_framework

Optimization pipeline — full audit through improvement deploy.

```
Oracle → Architect → Scout → Catalyst → Sentinel → Nexus
```

Audits current state, researches best practices, applies optimizations, validates compliance, and deploys.

### self_update

Self-update pipeline — research, evaluate, and apply updates.

```
Scout → Scout → Oracle → Forge → Sentinel
```

Checks current date/time, researches Cursor and AIOS updates, evaluates relevance, updates artifacts, and validates integrity.

## Architecture

```
                      ┌────────────────┐
                      │  aios-oracle   │
                      │ (Orchestrator) │
                      └───────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
      ┌───────┴──────┐ ┌─────┴──────┐ ┌──────┴───────┐
      │aios-architect│ │ aios-forge  │ │aios-sentinel │
      │ (Strategist) │ │  (Creator)  │ │  (Guardian)  │
      └───────┬──────┘ └─────┬──────┘ └──────┬───────┘
              │               │               │
      ┌───────┴──────┐ ┌─────┴──────┐ ┌──────┴───────┐
      │aios-catalyst │ │ aios-nexus  │ │  aios-scout  │
      │ (Optimizer)  │ │(Integrator) │ │ (Researcher) │
      └──────────────┘ └────────────┘ └──────────────┘
```

## Structure

```
squads/aios-forge-squad/
├── squad.yaml                          # Manifest
├── README.md
├── config/
│   ├── coding-standards.md             # Coding standards
│   ├── tech-stack.md                   # Technology stack
│   ├── source-tree.md                  # Squad map
│   ├── operation-state.json            # Operations state
│   ├── routing-log.md                  # Routing log
│   ├── knowledge-base.md               # Knowledge base
│   ├── update-log.md                   # Update history
│   ├── ecosystem-status.md             # Ecosystem status
│   └── last-check.json                 # Last update check
├── scripts/                            # Validation scripts
│   └── validate-cross-references.js
├── agents/                             # 7 agents
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

## Requirements

- Node.js 18+
- AIOS Core >= 2.1.0
- Cursor (Feb 2026+)
- Git 2.30+

## Generation and Gates

- Versioned generation rules: `config/generation-constitution.md` (`v3`)
- Default shell for Windows targets: **PowerShell**
- Installation state controlled by `.squad-lock.json` (`draft` or `installed`)
- Publishing is blocked when critical gates fail (cross-references and handoff integrity)
- Full validation: `scripts/validate-all.js` (structure + cross-references + handoff + shell + docs)

## Weekly runbook (~10 steps)

1. Read the official Cursor changelog; note relevant changes (date + link).
2. Check AIOS/AIOX releases (e.g. `SynkraAI/aiox-core` API) and record the latest tag.
3. Update `config/ecosystem-status.md` (Cursor, AIOS, MCP/Tools).
4. Fill `config/last-check.json` with timestamp and sources used.
5. Merge findings into `config/knowledge-base.md`.
6. Log the cycle in `config/update-log.md` (scope, sources, actions).
7. Add routing in `config/routing-log.md` and finalize `config/operation-state.json`.
8. Run `node scripts/validate-all.js` inside `squads/aios-forge-squad`.
9. Weekly goal: keep `.squad-lock.json` **`installed`** (no high-severity findings).
10. If status is **`candidate`** or **`draft`**, fix findings and revalidate before publishing.

## Author

**Luiz Gustavo Vieira Rodrigues** — [@gutomec](https://github.com/gutomec)

## License

MIT
