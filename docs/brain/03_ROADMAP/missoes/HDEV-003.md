---
id: HDEV-003
titulo: HI-03 — Conciliação Financeira
fase: HI-03
status: BACKLOG
prioridade: 2
dependencias: [HDEV-001]
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-08
---

# HDEV-003 — HI-03: Conciliação Financeira

## Objetivo

Mostrar onde o dinheiro informado não bate com o registrado:
- faturamento informado × vendas/recebíveis;
- contas pagas × saídas de caixa;
- recebíveis × repasses.

Cada diferença vem com valor, período e causa provável (HIPÓTESE).

Reusar: `contas-pagar.mjs`, `contas-receber.mjs`, `recebiveis.js`, as views `vw_fin_*` (F2.1), `conciliar_lote_repasses`.

## Critério de pronto

- [ ] Conciliação determinística por período e unidade, com SQL real em PGlite
- [ ] DADOS INSUFICIENTES quando faltar fonte (ex.: sem extrato bancário)
- [ ] Nenhuma execução financeira real. Só leitura e proposta; baixa ou estorno sempre pela tela, com confirmação
- [ ] Isolamento entre unidades testado

## Arquivos afetados

`app/lib/intelligence/metrics/financeiro.mjs` e novos módulos de conciliação; testes.

## Testes obrigatórios

`npm run test:intelligence` (com PGLITE) · testes financeiros existentes (`app/lib/contas-*.test.mjs`) · build.

## Resultado

## Evidências

## Histórico
