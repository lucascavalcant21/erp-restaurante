---
id: HDEV-006
titulo: HI-05 — Proatividade / Autonomia
fase: HI-05
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

# HDEV-006 — HI-05: Proatividade / Autonomia

## Objetivo

O Héfisto avisa **antes** do problema, no momento certo, e propõe a ação. A pessoa só confirma. Exemplos:
- ruptura prevista amanhã → proposta de compra;
- conta vencendo → lembrete;
- desvio de CMV → pergunta à equipe.

Rotinas agendadas com limites e auditoria.

## Critério de pronto

- [ ] Agendador de rotinas (reusar o cron do Vercel / `api/etiquetas/financeiro/drenar` como padrão) com idempotência e auditoria
- [ ] Preferências de alerta e sensibilidade respeitadas (já existem em `memory/preferencias.mjs`)
- [ ] Nenhuma ação sem confirmação; nada de "piloto automático" financeiro
- [ ] Testes de idempotência e de silêncio (sem dado = sem alerta inventado)

## Arquivos afetados

`app/lib/intelligence/rotinas/*` (novo), `vercel.json` (cron), insights.

## Testes obrigatórios

`npm run test:intelligence` · build.

## Resultado

## Evidências

## Histórico
