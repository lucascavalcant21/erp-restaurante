---
id: HDEV-005
titulo: HI-04 — Decision / What-if
fase: HI-04
status: BACKLOG
prioridade: 3
dependencias: [HDEV-004]
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-005 — HI-04: Decision / What-if

## Objetivo

Simular decisões antes de tomar ("e se eu subir o preço do prato X em 8%?", "e se eu cortar um turno?") com o efeito em margem, CMV, CMO e caixa.
- Natureza SIMULAÇÃO.
- Premissas explícitas.
- Nada é executado.

## Critério de pronto

- [ ] Motor de simulação determinístico reaproveitando métricas e forecast
- [ ] Premissas editáveis e registradas; resultado comparado com o cenário base
- [ ] Testes com cenários conhecidos

## Arquivos afetados

`app/lib/intelligence/simulacao/*` (novo), comandos, UI.

## Testes obrigatórios

`npm run test:intelligence` · build.

## Resultado

## Evidências

## Histórico
