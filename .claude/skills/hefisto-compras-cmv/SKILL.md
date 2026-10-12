---
name: hefisto-compras-cmv
description: Compras, custo médio, fornecedores, fichas técnicas e CMV do Héfisto. Use ao mexer em registro/confirmação/cancelamento de compra, custo de insumo, preço de prato, ficha técnica, CMV real, custo diário ou lacunas de custo.
---

# Compras, custo e CMV

Antes de banco ou migração, siga `hefisto-seguranca-supabase`. Para testar e publicar, `hefisto-entrega`.

## Fluxo oficial da compra (`app/lib/compras-estoque.mjs`)

1. **Rascunho:** `compras` (status `rascunho`) + `compras_itens`, editável.
2. **Confirmar:** RPC `compras_confirmar`. Numa transação só, faz a entrada no estoque (pelo motor de estoque), o custo médio, o histórico de custo e a conta a pagar.
3. **Cancelar:** RPC `compras_cancelar`. O rascunho sai direto. Compra confirmada só com administrador + PIN, e desfaz estoque, custo e conta juntos.

- O custo médio é calculado **só no banco** (`estoque_custo_medio_novo`). No JS, só prévia.
- Quantidades em unidade base (g/ml/un), com a mesma conversão do estoque (`app/lib/estoque-unidades.mjs`).
- `app/lib/compras.mjs` ainda tem caminhos legados (`pedidos_compra`, `recebimentos_compra`, `estoque_movimentos`) que **não existem no banco**. Não construa nada em cima deles.

## CMV (`app/lib/cmv-real.mjs`)

- CMV R$ = estoque inicial + compras do período − estoque final. CMV % = CMV R$ ÷ faturamento × 100.
- Dado ausente nunca vira zero. Sem inventário fechado nas duas pontas: **NÃO APURADO**, com o motivo.
- Compra ≠ CMV. Conta a pagar não entra na fórmula.

## Fichas e preço

- Custo de prato: `app/lib/ficha-calculos.mjs` e `custo-rendimento.mjs` (perda, porções, subfichas). Eventos e cardápio reusam essas funções. Não crie fórmula paralela.
- Composição de preço: `app/lib/composicao-preco.mjs`.

## Testes

`node --test app/lib/compras-estoque.test.mjs app/lib/cmv-real.test.mjs app/lib/custo-diario.test.mjs app/lib/lacunas-custo.test.mjs app/lib/ficha-calculos.test.mjs` (os de SQL precisam de `PGLITE`).

## Precisa do dono

- Cancelar compra confirmada, ou limpar compra de teste (ex.: Açaí R$ 9,00).
- Alterar custo de insumo em produção.
