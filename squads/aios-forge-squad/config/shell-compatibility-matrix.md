# Shell Compatibility Matrix

## Perfis suportados

| Profile | Sistema alvo | Shell padrão |
|---------|---------------|--------------|
| `windows-powershell` | Windows | PowerShell |
| `linux-bash` | Linux | bash |
| `macos-zsh` | macOS | zsh |

## Regras de portabilidade

### windows-powershell

- **Evitar:** `mkdir -p`, `ls -la`, `touch`.
- **Preferir:** `New-Item -ItemType Directory -Force`, `Get-ChildItem -Force`, `New-Item -ItemType File -Force`.

### linux-bash / macos-zsh

- Permitir comandos POSIX padrão.
- Evitar comandos exclusivos de PowerShell em exemplos de execução shell.

## Política do squad

- O `aios-forge-squad` usa `generation.shellProfileDefault: "powershell"` no manifesto.
- Artefatos com passos acionáveis devem ser compatíveis com o profile alvo.
