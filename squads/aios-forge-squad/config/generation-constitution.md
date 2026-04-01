# Constituição de Geração — AIOS Forge Squad

## Versão

- `v3`

## Regras obrigatórias (gates)

1. **Agentes**
   - Todo agente deve conter `command_loader`.
   - Todo agente deve conter bloco `CRITICAL_LOADER_RULE`.

2. **Tasks**
   - Toda task deve conter `Entrada` e `Saida`.
   - Todo item em `Saida` deve conter `formato_esperado`.

3. **Workflows**
   - `key_commands` deve ser objeto com `command`, `agent`, `description`.
   - Toda transição deve conter: `from`, `to`, `trigger`, `confidence`, `greeting_message`, `next_steps`.

4. **Referências cruzadas**
   - Todo arquivo listado em `squad.yaml` deve existir.
   - `manual_command` do workflow deve existir em algum agente.
   - `next_steps.args` deve referenciar outputs existentes em tasks.
   - Placeholders devem seguir o contrato: `{name}` ou `{name.output}`.
   - Quando mapeável, tipo de output deve ser compatível com tipo esperado no input.

5. **Compatibilidade de ambiente**
   - Windows deve usar PowerShell por padrão.
   - Comandos POSIX não portáveis devem ser evitados em guias para Windows.

6. **Publicação**
   - Squad só pode ser marcado como `installed` após passar todos os gates críticos.
   - Em falha crítica, status obrigatório: `draft`.
   - Sem críticos e com findings high: status `candidate`.
   - Histórico de validação deve ser persistido em `reports/validation-history/`.

## Migração v2 -> v3

1. Executar `scripts/validate-all.js`.
2. Corrigir findings críticos de handoff (`HND_005`, `HND_006`) para sair de `draft`.
3. Corrigir findings high de documentação (`DOC_*`) para promover `candidate` -> `installed`.
4. Atualizar `generation.constitutionVersion` para `v3` no `squad.yaml`.
