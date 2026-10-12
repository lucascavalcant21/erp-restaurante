---
name: hefisto-pdv-kds
description: Vendas, PDV, mesas, pedidos, cozinha (KDS), delivery e impressão térmica/etiquetas do Héfisto. Use ao mexer em app/dashboard/vendas, kds, mesas, delivery, salao, vendas*.js, kds.js, impressao*.js ou etiquetas.
---

# PDV, KDS e impressão

Para testar e publicar, siga `hefisto-entrega`. Se mexer em banco, `hefisto-seguranca-supabase`.

## Onde está

| O quê | Onde |
|---|---|
| Totais do PDV (desconto, acréscimo, taxa) | `app/lib/vendas-pdv-utils.mjs`: função pura, fonte única da conta |
| Vendas e pedidos | `app/lib/vendas.js`, `vendas-domain.js`; tabelas `vendas`, `venda_itens`, `pedidos`, `pedidos_itens` |
| Cozinha | `app/lib/kds.js`, tela `app/dashboard/kds` |
| Mesas e delivery | `app/lib/mesas.js`, `delivery.js` |
| Impressão | `app/lib/impressaoTermica.js`, `impressaoMdk022.js`, `impressaoBluetooth.js`, `etiqueta-*.mjs` |

## Regras

- **A tela da cozinha é usada com pressa, em tablet e celular.** Botões grandes, sem rolagem lateral em 390 px e 820 px. Confira com `hefisto-auditoria-ui`.
- `vendas.js` ainda lê `estoque_atual` e `operacao_embalagens` (legado). A baixa de estoque por venda tem que ir para o motor oficial (`estoque_movimentar`, veja `hefisto-estoque`), nunca para uma tabela paralela.
- Conta de total e taxa só em `vendas-pdv-utils.mjs`, com teste.
- Impressora física: o agente não tem acesso. Teste o conteúdo gerado (TSPL/ESC-POS) e marque a impressão como **NÃO VALIDADO**.

## Testes

`node --test app/lib/vendas-pdv-utils.test.mjs app/lib/etiqueta-centralizada.test.mjs app/lib/etiqueta-financeiro.test.mjs` · `node scripts/test_hardware_tspl_validation.mjs`

## Precisa do dono

Cancelar ou estornar venda real, mexer em taxa de serviço ou meio de pagamento em produção.
