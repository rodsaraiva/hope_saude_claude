# Códigos de Erro — Validation Gates

## Estrutura (P0)

| Código | Severidade | Regra |
|--------|------------|-------|
| `STR_AGT_001` | critical | Agente deve conter frontmatter válido |
| `STR_AGT_002` | critical | Agente deve conter chaves obrigatórias no frontmatter |
| `STR_AGT_003` | critical | Agente deve conter `command_loader` |
| `STR_AGT_004` | critical | Agente deve conter `CRITICAL_LOADER_RULE` |
| `STR_AGT_005` | high | Agente deve conter seções markdown obrigatórias |
| `STR_TSK_001` | critical | Task deve conter frontmatter válido |
| `STR_TSK_002` | critical | Task deve conter chaves obrigatórias no frontmatter |
| `STR_TSK_003` | critical | Task deve conter `formato_esperado` em Saida |
| `STR_TSK_004` | high | Task deve conter seção `Pipeline Diagram` |
| `STR_WRK_001` | critical | Workflow deve conter chaves obrigatórias |
| `STR_WRK_002` | critical | Workflow deve conter transições completas |
| `STR_WRK_003` | critical | Workflow deve usar `key_commands` no formato objeto |
| `STR_MAN_001` | critical | `squad.yaml` deve conter chaves obrigatórias |
| `STR_MAN_002` | high | `squad.yaml` deve declarar `generation.constitutionVersion` |

## Referências cruzadas e handoff

Esses erros são reportados pelo `validate-cross-references.js` e agregados pelo `validate-all.js`.

| Código | Severidade | Regra |
|--------|------------|-------|
| `XRF_001` | critical | Comando de workflow deve existir em algum agente |
| `XRF_002` | critical | `manual_command` deve existir em agente |
| `XRF_003` | critical | `next_steps.args` deve referenciar output válido |
| `XRF_004` | critical | Todo arquivo listado no `squad.yaml` deve existir |

## Handoff

| Código | Severidade | Regra |
|--------|------------|-------|
| `HND_001` | critical | Transition deve ter `from` e `to` |
| `HND_002` | critical | `to` deve existir em `agent_sequence` (ou ser terminal) |
| `HND_003` | critical | `next_steps.command` deve existir no agente de destino |
| `HND_004` | critical | Placeholders em args devem referenciar outputs conhecidos |
| `HND_005` | critical | Placeholder deve seguir contrato `{name}` ou `{name.output}` |
| `HND_006` | critical | Tipo de output deve ser compatível com tipo esperado no input |

## Shell compatibility

| Código | Severidade | Regra |
|--------|------------|-------|
| `SHL_001` | high | Comando não-portável para o profile de shell alvo |

## Consistência documental

| Código | Severidade | Regra |
|--------|------------|-------|
| `DOC_001` | high | Versão de badge no README deve casar com `squad.yaml` |
| `DOC_002` | high | README deve mencionar `constitutionVersion` atual |
| `DOC_003` | high | Contagem total em source-tree deve casar com total real |
| `DOC_004` | high | Contagem de scripts em source-tree deve casar com scripts reais |
