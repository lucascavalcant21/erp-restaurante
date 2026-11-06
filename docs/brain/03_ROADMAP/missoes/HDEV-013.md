---
id: HDEV-013
titulo: Sistema de comandas: garçom lança por pessoa, caixa recebe
status: BACKLOG
prioridade: 3
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-11-06
---

# HDEV-013 — Sistema de comandas: garçom lança por pessoa, caixa recebe

## Objetivo

Uma só comanda, ligada à cozinha, ao bar e ao caixa.

Decisões do dono (06/11/2026): conta por mesa, dividindo por pessoa. Garçom lança no celular. Pedido chega por tela e impressora. Garçom pede a conta, caixa recebe.

## Critério de pronto

- Etapa 1: tela do garçom em `/dashboard/mesas` (`pedidos` e `pedidos_itens`), `COM_1`, conta rápida Garçom, por pessoa no caixa.
- Etapa 2: fechamento em uma só transação, venda registrada, entrada no financeiro oficial e baixa por `estoque_movimentar`.
- Etapa 3: limpar comandas e pedidos de teste, com aprovação do dono.

## Estado

- Etapa 1: telas TESTADO EM MOCK. `COM_1` aplicada em 06/11/2026, com aprovação do dono. Fluxo do garçom TESTADO NO SUPABASE REAL em transação desfeita.
- Etapa 3: feita em 06/11/2026 com aprovação do dono (`db/comandas/COM_2_LIMPEZA_DE_TESTES.sql`). Nada apagado.
- Impressão na cozinha e no bar: NÃO VALIDADO em impressora física.
- `fecharContaDaMesa` grava em etapas, ignora erros, usa `lancamentos` e não cria `vendas`. A tabela `vendas` está vazia: nenhuma conta foi fechada de verdade.
- A tela antiga usava `comandas` (itens em JSON). Essa tabela fica no banco, sem uso.
