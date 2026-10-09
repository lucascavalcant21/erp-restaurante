---
id: HDEV-002
titulo: HI-03 — CMV Real × Teórico + Estoque Real × Esperado
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

# HDEV-002 — HI-03: CMV Real × Teórico + Estoque Real × Esperado

## Objetivo

Por produto e por período, mostrar quanto **deveria** ter sido consumido e quanto **foi**, quanto vale a diferença e qual a causa provável (como HIPÓTESE).

- **CMV teórico:** vendas (ou produção) × ficha técnica × custo médio.
- **CMV real:** estoque inicial + compras − estoque final, com inventários fechados.
- **Estoque esperado:** saldo inicial + entradas − saídas teóricas. Comparar com o contado.

Usar o que existe:
- `app/lib/cmv-real.mjs`, `cmv-*.mjs`, fichas, `estoque_contagens`;
- `app/lib/intelligence/metrics/custos.mjs`, `estoque.mjs`.

Nada de lógica paralela.

## Critério de pronto

- [ ] Métrica determinística, testada com SQL real em PGlite, com natureza REAL / ESTIMATIVA / HIPÓTESE corretas
- [ ] DADOS INSUFICIENTES com motivo quando faltar venda integrada ou inventário fechado (é o caso atual da produção)
- [ ] Pergunta "Por que meu CMV subiu?" e cartão na Central com top desvios em R$
- [ ] Sem vazamento entre unidades (teste de isolamento)
- [ ] Evidência: TESTADO LOCAL + leitura real sob RLS (como no HI-02) quando houver dado

## Arquivos afetados

`app/lib/intelligence/metrics/*`, `agents/*`, `insights/*`, testes.

## Testes obrigatórios

`npm run test:intelligence` (com PGLITE) · build.

## Resultado

## Evidências

## Histórico
