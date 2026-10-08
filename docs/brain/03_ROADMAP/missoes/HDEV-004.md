---
id: HDEV-004
titulo: HI-04 — Forecast Engine
fase: HI-04
status: BACKLOG
prioridade: 3
dependencias: [HDEV-002]
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-004 — HI-04: Forecast Engine

## Objetivo

Projeções com intervalo de confiança e método declarado, sempre com natureza PROJEÇÃO:
- fechamento do mês (faturamento e CMV);
- ruptura de estoque por produto;
- caixa dos próximos 30 dias.

Sem histórico suficiente: DADOS INSUFICIENTES, nunca uma linha reta inventada.

## Critério de pronto

- [ ] Métodos simples e testáveis primeiro (média móvel com sazonalidade semanal); erro medido em backtest
- [ ] Cada projeção mostra base, período usado, método, intervalo e confiança
- [ ] Testes determinísticos com séries conhecidas

## Arquivos afetados

`app/lib/intelligence/forecast/*` (novo), métricas, agentes, UI da Central.

## Testes obrigatórios

`npm run test:intelligence` · build.

## Resultado

## Evidências

## Histórico
