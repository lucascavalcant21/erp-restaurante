---
name: hefisto-estoque
description: Estoque do Héfisto (entrada, retirada, transferência, estorno, inventário/contagem, saldo, unidades garrafa/caixa/ml/kg, áreas Cozinha/Bar/Salão/Limpeza, painel de situação, duplicados de produto). Use ao mexer em app/dashboard/operacao/estoque, estoque-*.mjs, estoque_movimentar ou em qualquer dado de estoque_itens/insumos.
---

# Estoque

Antes de banco ou migração, siga `hefisto-seguranca-supabase`. Para testar e publicar, `hefisto-entrega`.

## Fonte da verdade (uma só)

- `insumos`: cadastro mestre (unidade do saldo, embalagem, `unidade_compra`/`fator_compra` quando existirem).
- `estoques`: locais. `estoque_itens.quantidade_atual`: saldo **na unidade base** (ml, g, kg, L, un).
- `estoque_movimentacoes_multi`: histórico **imutável**. Erro se corrige com estorno, nunca com UPDATE/DELETE.
- Escrita só pelas RPCs: `estoque_movimentar`, `estoque_transferir` (atômica, duas linhas ligadas), `estoque_estornar`, `estoque_ajustar_inventario`. Compra entra pelo `compras_confirmar` (veja `hefisto-compras-cmv`), nunca pela tela de estoque.
- Legado, **não use como fonte**: `estoque_atual`, `cervejas`, `operacao_embalagens`, `inventario_itens`, e as RPCs/tabelas que não existem mais no banco (`registrar_movimento_estoque`, `estoque_movimentos`, `pedidos_compra`, `recebimentos_compra`). Detalhe em `docs/brain/02_ARQUITETURA/ESTOQUE_AUDITORIA.md`.

## Unidades (onde mais dá erro)

Toda conversão passa por `app/lib/estoque-unidades.mjs`:
- 24 garrafas de Corona 330 ml = 7.920 ml no banco, mostrado como "24 garrafas". Nunca grave "24" como 24 ml.
- 2 caixas × 12 = 24 garrafas (exige `fator_compra`; sem fator, recusa).
- `estoque_minimo` está na unidade operacional (garrafas): compare com `minimoNoSaldo`.
- Embalagem de 1 kg/1 L sem nome aparece em kg/L.

Testes: `node --test app/lib/estoque-unidades.test.mjs app/lib/estoque-areas.test.mjs` e, com PGlite, `estoque-movimento.test.mjs`, `contagem-estoque.test.mjs` e `estoque-migracoes.test.mjs`.

## Telas

- `/dashboard/operacao/estoque`: tela única `MovimentarEstoque` (Entrada/Retirada → área → busca → saldo → registro). Não existe mais Modo Quiosque nem Modo Operação. Não crie outra versão de estoque.
- Abas (`app/components/navigation/EstoqueAbas.js`): Movimentar · Inventário · Histórico · Painel · Produtos e locais.
- Painel: situações Não conferido / Zerado / Abaixo do mínimo / Normal / Inativo. Nunca diga "estoque seguro" com item não conferido. Custo só com permissão (`overview`).
- Áreas e categorias: `app/lib/estoque-areas.mjs`.

## Precisa do dono, sempre

- Unificar produtos duplicados (Heineken, Corona, "Coroa zero"). A tabela de correspondência está em `docs/brain/02_ARQUITETURA/ESTOQUE_DUPLICADOS.md`. Não junte nada automaticamente.
- Estornar movimento real, zerar saldo, aplicar `db/EST_UNI_1_*.sql` ou `db/EST_LOCAL_1_SALAO.sql`.
- Confirmar um movimento de teste em produção. Para validar, preencha a tela e **não confirme**.

Missão de referência: `docs/brain/03_ROADMAP/missoes/HDEV-EST-001.md`.
