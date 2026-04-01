---
task: optimizeComponent()
responsavel: "Catalyst"
responsavel_type: Agente
atomic_layer: Organism

Entrada:
  - nome: componentPath
    tipo: string
    descricao: "Caminho do componente AIOS a ser otimizado"
    obrigatorio: true
  - nome: metric
    tipo: string
    descricao: "Mtrica alvo da otimizao: tokens|speed|quality|context"
    obrigatorio: true
  - nome: preserveBackwardCompat
    tipo: boolean
    descricao: "Se true, preserva compatibilidade retroativa (default: true)"
    obrigatorio: false

Saida:
  - nome: optimizedComponent
    tipo: file
    descricao: "Verso otimizada do componente"
    obrigatorio: true
    formato_esperado: "Arquivo otimizado com ganhos mensurveis na mtrica alvo"
  - nome: optimizationReport
    tipo: file
    descricao: "Relatrio com mtricas antes/depois e detalhes das otimizaes aplicadas"
    obrigatorio: true
    formato_esperado: "Markdown com baseline, resultado e delta percentual"

Checklist:
  pre-conditions:
    - "[ ] Componente existe e  acessvel no caminho especificado"
    - "[ ] Mtrica  uma das 4 vlidas: tokens, speed, quality, context"
    - "[ ] Backup do componente original criado antes de qualquer modificao"
    - "[ ] Componente  de camada mutvel (L3 ou L4) ou possui autorizao explcita"
  post-conditions:
    - "[ ] Verso otimizada passa em todas as validaes do validateArtifact()"
    - "[ ] Mtricas da mtrica alvo apresentam melhoria mensurvel"
    - "[ ] Compatibilidade retroativa preservada (se preserveBackwardCompat = true)"
    - "[ ] Relatrio inclui delta quantitativo (antes/depois)"
    - "[ ] Nenhuma funcionalidade removida sem autorizao"
    - "[ ] Referncias cruzadas intactas"

Performance:
  duration_expected: "3-8 minutos"
  cost_estimated: "~5000 tokens"
  cacheable: false
  parallelizable: false
  skippable_when: "Quando componente j est no estado timo para a mtrica alvo"

Error Handling:
  strategy: rollback
  fallback: "Retornar componente original com relatrio de sugestes de otimizao para aplicao manual"
  notification: "orchestrator"

Metadata:
  story: "Como framework, preciso que componentes sejam otimizados para mtricas especficas sem perda de funcionalidade"
  version: "1.0.0"
  dependencies:
    - analyzeAiosComponent()
    - validateArtifact()
  author: "AIOS Forge Squad"
  created_at: "2026-02-24T00:00:00Z"
  updated_at: "2026-02-24T00:00:00Z"
---

# optimizeComponent()

## Pipeline Diagram

```
     
 componentPath       Catalyst        
 metric                 (aios-catalyst)   
 backwardCompat       
              
                         
                            Backup      
                            Original    
                         
                                 
                    
                                            
                
                Measure   Optimize   Measure  
                BEFORE     Apply     AFTER    
                
                                            
                    
                                
                       
                                        
                    
                  optimized      optimization
                  Component      Report.md   
                    
```

## Descrio

A task `optimizeComponent()`  a **ferramenta de otimizao cirrgica** do AIOS Forge Squad. Recebe um componente e uma mtrica alvo, mede o estado atual, aplica otimizaes especficas e verifica a melhoria, seguindo o padro measure  optimize  verify.

### Responsabilidades

1. **Criao de Backup**  Antes de qualquer modificao, cria cpia de segurana do componente original em memria para possvel rollback.

2. **Medio BEFORE**  Coleta mtricas do componente no estado original:

   | Mtrica | O que Mede | Como Mede |
   |---------|-----------|-----------|
   | `tokens` | Contagem de tokens do artefato | Estimativa via caracteres/4 |
   | `speed` | Indicadores de performance | Lazy loading, caching, paralelismo |
   | `quality` | Score de qualidade | Error handling, docs, cobertura |
   | `context` | Uso de context window | Tamanho de personas, handoffs |

3. **Aplicao de Otimizaes por Mtrica**:

   #### Mtrica: `tokens`
   - Comprimir descries verbose mantendo semntica
   - Eliminar redundncias e repeties
   - Consolidar sees similares
   - Remover whitespace excessivo
   - Simplificar tabelas e listas sem perder informao

   #### Mtrica: `speed`
   - Identificar operaes sequenciais que podem ser paralelas
   - Adicionar lazy loading onde aplicvel
   - Sugerir caching para dados frequentemente acessados
   - Otimizar order de execuo em workflows
   - Reduzir nmero de transies em pipelines

   #### Mtrica: `quality`
   - Adicionar error handling onde ausente
   - Completar documentao incompleta
   - Adicionar pre/post-conditions faltantes
   - Melhorar mensagens de erro e feedback
   - Adicionar validaes de input

   #### Mtrica: `context`
   - Compactar handoff artifacts
   - Minimizar tamanho de personas sem perder identidade
   - Reduzir greeting_levels a essencial
   - Comprimir listas de dependncias
   - Eliminar sees no essenciais para operao

4. **Medio AFTER**  Coleta as mesmas mtricas aps otimizao e calcula delta.

5. **Verificao de Integridade**  Garante que:
   - Componente otimizado  sintaticamente vlido
   - Referncias cruzadas permanecem intactas
   - Funcionalidade core no foi afetada
   - Backward compatibility preservada (se flag ativa)

### Formato do Relatrio de Otimizao

```markdown
# Optimization Report  {componentName}

**Date:** ISO-8601
**Metric:** {metric}
**Backward Compatible:** {yes/no}

## Summary
| Aspecto | Before | After | Delta | Melhoria |
|---------|--------|-------|-------|----------|
| {mtrica principal} | {valor} | {valor} | {diff} | {%} |

## Otimizaes Aplicadas
1. {Descrio da otimizao 1}  Impacto: {delta}
2. {Descrio da otimizao 2}  Impacto: {delta}
...

## Otimizaes No Aplicadas (preservao de compatibilidade)
1. {Descrio}  Motivo: {razo}
...

## Validation
- Format compliance: PASSED/FAILED
- Cross-references: PASSED/FAILED
- Backward compatibility: PASSED/FAILED/N/A
```

### Regras de Rollback

- Se a otimizao causar falha na validao  rollback automtico ao original
- Se a mtrica piorar aps otimizao  rollback automtico ao original
- Se backward compatibility quebrar e flag est ativa  rollback automtico
- Em qualquer caso de rollback, relatrio  gerado com sugestes para otimizao manual

### Integrao com Pipeline

- **optimize-framework workflow**: optimizeComponent()  a Fase 4 principal
- **forge-artifact workflow**: optimizeComponent()  a Fase 5 opcional
- Ps-otimizao, o componente  enviado para validateArtifact() para verificao
- Se a validao falhar, rollback  executado e Oracle  notificado
