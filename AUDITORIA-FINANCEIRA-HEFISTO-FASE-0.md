# AUDITORIA FINANCEIRA HÉFISTO — FASE 0

Data: 2026-09-30 · Base auditada: branch `main`, commit `3c53bec` (árvore limpa) · Modo: somente leitura.

Nada foi implementado, migrado ou alterado. Nenhum arquivo do projeto foi modificado; este relatório é o único arquivo criado.

## Como ler este relatório

- Toda afirmação cita arquivo e linha (ou função). Linhas referem-se ao commit `3c53bec`.
- **NÃO COMPROVADO** = não dá para provar pelo repositório. Motivo recorrente: o repo não tem fonte canônica do schema (tabelas centrais como `contas_pagar`, `insumos`, `fichas_tecnicas`, `fichas_ingredientes`, `estoque_atual`, `pedidos`, `pedidos_itens`, `produtos`, `cardapio`, `colaboradores`, `inventario_itens`, `operacao_embalagens` não têm `CREATE TABLE` em nenhum `.sql`), e não há registro de quais migrations o dono já rodou no Supabase de produção. Não tive acesso ao banco.
- Um relatório antigo (`RELATORIO_FINANCEIRO_INTEGRADO_HEFISTO.md`) declara o módulo "CONCLUÍDO E VALIDADO" com "status padronizados" e "CMV no consumo real". **O código atual contradiz as duas afirmações** (ver P-2 e C-1). Não usei relatórios antigos como evidência; só código e SQL.

---

## 1. Resumo executivo

1. **Existe muita peça, mas elas não se conectam.** Há compras com recebimento atômico, estoque multi-depósito com lotes/FEFO, produção com baixa por ficha em SQL, fichas com fator de correção e sub-receitas, contas a pagar com parcelamento/pagamento/estorno, contas a receber com taxa de adquirente e conciliação, um simulador de preço/equilíbrio bem feito (Pizza do Lucro). Cada uma grava num lugar diferente e nenhuma alimenta um DRE confiável.
2. **Existem cinco coisas diferentes chamadas "CMV"** no sistema, e nenhuma é o CMV real (EI + Compras − EF). Ver C-1.
3. **Faturamento vem de cinco fontes diferentes** conforme a tela (`lancamentos`, `vendas`, `pedidos`, `vendas`+`venda_pagamentos`, valor digitado). Cada tela mostra um faturamento diferente para o mesmo período. Ver C-3.
4. **O DRE gerencial (`/dashboard/financeiro/dre`) está matematicamente errado hoje:** soma o faturamento de todos os tempos, soma todas as contas a pagar de todos os tempos (inclusive não pagas), coloca CMV = 0 e o seletor Semanal/Mensal/Anual só muda o rótulo. Ver M-5.
5. **O copiloto de IA legado inventa números.** `hefisto-analytics.js` e `hefisto-insights.js` devolvem CMV 31,2% → 28,7%, faturamento R$ 42.500, "Camarão 40/60 +16,7%", perdas "R$ 650 + R$ 25 por item", tudo fixo no código e marcado como `EVIDENCIA_SUFICIENTE`. O `hefisto-insights` roda na automação agendada (`/api/hefisto/automation/cron`). Isto viola diretamente a regra "não inventar dados". Ver R-1. É o item mais urgente.
6. **Há erros de caixa-alta em status que zeram números:** o banco foi normalizado para `PAGA`/`PENDENTE`, mas quatro fluxos ainda gravam `pago`/`pendente` e três telas filtram por minúsculo. Resultado: despesas pagas somem do resultado do caixa, contas vencidas não aparecem no Hub. Ver M-2/M-3.
7. **Tipo de `unidade_id` inconsistente:** o ERP usa ids de unidade em texto (`unid_xxxxxxxxxxxx`, gerados em `db/migracao_control_plane_saas.sql:127`), mas as migrations do financeiro, compras e recebíveis criam `unidade_id uuid` e RPCs com `p_unidade_id uuid`. Se aplicadas assim, essas RPCs não aceitam a unidade real — e o front cai em "fallback" que marca conta como paga com valor 0. Ver R-3 e M-4.
8. **Custos fixos, taxa de cartão e imposto têm quatro a sete cadastros cada**, incluindo `localStorage` do navegador. Ver D-3/D-4.
9. **Não existem:** CMV real por inventário valorizado, DRE por competência com classificação fixo/variável, encargos no CMO, depreciação, balanço patrimonial, engenharia de cardápio funcional (a atual lê um campo que nunca é gravado), IA financeira com dados reais.

Conclusão: antes de qualquer tela nova, a Fase 1 precisa ser **fundação** — um vocabulário único de conceitos, uma fonte única de faturamento, de custo de insumo e de parâmetros, correção dos bugs de status/tipo, e remoção dos números inventados.

---

## 2. Mapa da arquitetura financeira atual

```
                  (manual)                (PDV mesa/balcão/delivery)          (tela Vendas)         (integrações)
                     │                              │                               │                     │
 FechamentoMes   registrarVendaManual        pedidos + pedidos_itens        vendas + venda_pagamentos   iFood/Saipos
 (digitado,      → vendas (sem itens,        + lancamentos(entrada)*        + contas_receber         → vendas / contas_receber
  não salva)       sem lançamento)           * delivery NÃO gera lançamento   (sem lançamento)
                                                    │
                                   processarBaixaEstoqueECMV (JS, no navegador)
                                     ├─ estoque_atual (read-modify-write)
                                     ├─ operacao_embalagens(+_consumo)
                                     └─ contas_pagar  categoria 'cmv' status 'pago'   ← "CMV teórico" vira conta paga

 Compras:  pedidos_compra → confirmar_recebimento_integrado (SQL)
             ├─ recebimentos_compra(_itens)
             ├─ estoque_atual + estoque_movimentos (tabela A)
             ├─ estoque_lotes (colunas incompatíveis — ver R-4)
             ├─ insumos.custo_unitario = último preço  + insumos_precos_historico
             └─ contas_pagar  categoria 'cmv' status 'pendente' venc. +30d
           registrarCompra (estoque.js) → estoque_atual + contas_pagar 'Compra:%'
           movimento manual multi → estoque_itens + estoque_movimentacoes_multi (tabela B, com valor)

 Produção: confirmar_producao_integrada (SQL) → producao_diaria (custo_total + snapshot)
             → estoque_movimentacoes_multi + estoque_itens + estoque_atual

 Perdas:   etiquetas → etiqueta_financeiro_pendente → contas_pagar 'inventarios' 'pago'
           inventario_itens/inventario_movimentos (patrimônio: quebra/perda/descarte, só quantidade)

 Financeiro:
   contas_pagar ──registrar_pagamento_conta──► contas_pagar_pagamentos + contas_financeiras.saldo_atual + lancamentos(saida)
   contas_receber ──conciliar──► conciliacao_financeira
   lancamentos  = "extrato" misto (manual + PDV + pagamentos)

 Leitura (cada tela calcula por conta própria, no navegador):
   DRE page ........ lancamentos + contas_pagar + cmo.mjs          (montarDREGerencial)
   FechamentoMes ... digitado + fichas + colaboradores + contas     (fórmula própria)
   Financeiro page . vendas + contas_pagar + entradas de estoque   (fórmula própria, "cmv" = compras)
   FinanceiroHub ... lancamentos + estoque_atual                   ("cmv" = estoque/receita)
   CMV page ........ produtos + fichas                             (custo ficha / preço)
   Pizza ........... fichas + produtos + config_sistema.params     (motor bom, parâmetros manuais)
   Relatórios ...... pedidos / contas_pagar / fichas               (fórmula própria)
   IA legada ....... fetchDRE + números fixos no código
```

---

## 3. O que já existe (e funciona como descrito)

| Item | Evidência |
|---|---|
| Custo de ficha com sub-receitas, conversão g/kg, ml/L e fator de correção | `app/lib/ficha-calculos.mjs:238-269` `custoDeProduzirFicha`; teste `ficha-calculos.test.mjs` |
| Custo de ficha e consumo físico em SQL (com conversão, ciclo, trava de outra unidade) | `db/migracao_operacao_integrada.sql:34-124` (`operacao_converter`, `operacao_custo_insumo`, `operacao_custo_ficha`, `operacao_consumo_ficha`) |
| Produção integrada atômica com idempotência e snapshot de custo/receita | `db/migracao_operacao_integrada.sql:185-240` `confirmar_producao_integrada` → `producao_diaria.custo_total`, `receita_snapshot` |
| Preço por CMV-meta (custo / CMV%) | `ficha-calculos.mjs:398-405` `precoSugerido`; usado em `fichas/page.js:3090` |
| Preço por markup divisor (custo direto / (1 − variável% − margem%)) | `app/lib/pizza-do-prato.mjs:275-284` `precoSugerido` |
| Margem de contribuição unitária e ponto de equilíbrio por prato e do cardápio | `app/lib/custo-diario.mjs:429-458` `simularMes`, `477-502` `equilibrioDoCardapio`, `519-560` `simularCardapio` |
| Média de itens/dia medida nas vendas (fuso local) | `custo-diario.mjs:574-597` `mediaItensPorDia` |
| Parcelamento exato de contas a pagar | `app/lib/financeiro-domain.js:7-43` |
| Pagamento/estorno atômico com contas financeiras e histórico | `db/migracao_financeiro_integrado.sql` `registrar_pagamento_conta` / `estornar_pagamento_conta`; tabelas `contas_pagar_pagamentos`, `contas_financeiras` |
| Contas a receber com taxa de adquirente, D+N e conciliação com tolerância | `app/lib/vendas-domain.js:106-227`, `257+`; `app/lib/recebiveis.js`; tabelas `contas_receber`, `configuracoes_adquirentes`, `lotes_repasses`, `conciliacao_financeira` (`db/migracao_vendas_recebiveis_conciliacao.sql:40-133`) |
| Decomposição da venda (taxa de serviço equipe x empresa, comissão marketplace, imposto) | `vendas-domain.js:36-72` `calcularDecomposicaoVenda` |
| Pedido de compra → recebimento → estoque → preço → conta a pagar (atômico, idempotente) | `db/migracao_compras_recebimento.sql:129-358` `confirmar_recebimento_integrado` |
| Divergência de preço no recebimento (≥ 5%) | mesma RPC, bloco "Cálculo de Divergência" |
| Histórico de preço de insumo com fornecedor e variação % | tabela `insumos_precos_historico` (`docs/ingredientes-catalogo.sql:38-60`), `app/lib/insumo-fornecedores.js:64` |
| Preço por fornecedor por insumo | `insumos_fornecedores` (`db/migracao_insumo_fornecedor_precos.sql`) |
| Estoque multi-depósito com lotes por validade (FEFO), contagem e transferência | `docs/estoques-multiplos.sql:4-61`, `db/migracao_estoque_lotes.sql:24-424` |
| Valor carimbado no movimento de estoque | `estoque_movimentacoes_multi.valor_unitario/valor_total` (`db/migracao_movimento_valor.sql`), carimbo em `app/lib/estoques-multiplos.js:492-505` |
| Fila idempotente perda de etiqueta → financeiro | `db/etiquetas/0001_saldo_e_linhagem.sql:1333-1352`, `app/lib/etiqueta-financeiro.js` |
| CMO = folha contratados + diárias pagas de extras, proporcional ao período | `app/lib/cmo.mjs:34-51` |
| Custo por dia de operação (contas e pessoas) | `custo-diario.mjs:371-414` |

## 4. O que existe parcialmente

| Item | O que falta | Evidência |
|---|---|---|
| CMV teórico | É calculado na venda, mas: gravado como conta paga em `contas_pagar`, sem vínculo com a venda, sem conversão de unidade, e `vendas.cmv_teorico` nunca é preenchido | `app/lib/vendas.js:272-438`; `integracoes-externas.js:86` passa `p_cmv_teorico: 0` |
| DRE gerencial | Estrutura existe (`montarDREGerencial`), mas sem período, sem CMV, sem fixo/variável, sem competência | `financeiro-domain.js:116-166`; `dre/page.js:47-59` |
| Fluxo de caixa | Previsto só de contas a pagar; recebíveis ignorados (`entradasPrevistas` sempre 0) | `financeiro-domain.js:171-208` |
| Inventário (contagem) | Contagem física existe e grava movimento `contagem`, mas não há fechamento de período nem estoque valorizado numa data | `registrar_contagem_estoque_multi` (`db/migracao_estoque_lotes.sql:318`) |
| Perdas operacionais | Há três registros separados (etiqueta, patrimônio, saída com motivo em texto) e nenhum tipo `perda` no estoque de insumos | ver seção 11 |
| Rendimento | Fator de correção na ficha (percentual acrescido) e ganho do empanado; produção não registra rendimento real | `ficha-calculos.mjs:88-116`; `custoUnitarioEfetivoInsumo` `:218-235` |
| CMO | Sem encargos (INSS, FGTS, 13º, férias), benefícios parciais (só vale-alimentação), setor inferido por texto | `cmo.mjs:9-13`; `app/lib/equipe-area.mjs` |
| Custos fixos | Lista de 6 campos fixos em parâmetros; sem vínculo com contas a pagar reais | `app/lib/parametros.js:20-34` |
| Taxas de cartão | Recebível calcula taxa, mas a tabela padrão está fixa no código e a tela Vendas não passa a configuração da unidade | `vendas-domain.js:17-25`; `app/dashboard/vendas/page.js:145-151` |
| Patrimônio | `inventario_itens` tem `valor_unitario` (somado em Relatórios), sem data de aquisição, vida útil ou depreciação | `app/dashboard/relatorios/page.js:110` |
| Compras (perguntas "quanto de alface em 2026") | Respondível só para o que passou por `recebimentos_compra_itens`; entradas manuais de estoque não guardam fornecedor nem nota | ver seção 10 |
| Simulador financeiro | Por prato e por cardápio (Pizza); não simula folha, contratação, taxa, imposto no nível da empresa | `custo-diario.mjs` |

## 5. O que não existe

- CMV real do período (EI + Compras − EF) — nenhuma função, tabela ou tela. Não há estoque valorizado por data.
- Comparação CMV real x CMV teórico.
- Classificação estruturada fixo x variável de despesas (há só `categoria` texto livre; ver seção 5 do pedido).
- DRE por competência usando `contas_pagar.competencia` (a coluna existe e ninguém lê).
- Encargos trabalhistas, provisões (13º, férias), CMO por setor com vínculo estruturado.
- Custo médio ponderado de estoque (o custo é sempre o último preço pago).
- Rendimento real de produção (peso obtido x esperado) e perda de processamento registrada.
- Tipo de movimento `perda`/`descarte`/`vencimento` no estoque de insumos.
- Depreciação, vida útil, balanço patrimonial gerencial, passivos além de contas a pagar.
- Engenharia de cardápio funcional com período, vendas reais e margem de contribuição.
- Tools financeiras no Agent Core (as 11 tools READ da branch `fase-2b2/estabilizacao` são de estoque, compras-preço, ficha, reservas, eventos, RH, checklists — nenhuma de DRE/CMV/caixa).
- Registro de quais migrations estão aplicadas em produção.

---

## 6. Estruturas que podem ser reaproveitadas

1. `ficha-calculos.mjs` (custo de ficha, conversões, FC, CMV %, preço por CMV-meta) — é a referência correta no front; tem testes.
2. Funções SQL `operacao_*` e `confirmar_producao_integrada` — melhor candidato a motor único de consumo teórico (já resolve pré-preparo estoqueável sem dupla baixa).
3. `custo-diario.mjs` + `pizza-do-prato.mjs` — motor de margem de contribuição, markup divisor e equilíbrio conceitualmente correto; falta alimentar com dados reais em vez de parâmetros digitados.
4. `estoque_movimentacoes_multi` com `valor_unitario/valor_total` — base para livro-razão de estoque e CMV real.
5. `confirmar_recebimento_integrado` — base para compras; precisa corrigir tipo de unidade, lotes e custo médio.
6. `contas_pagar` + `contas_pagar_pagamentos` + `contas_financeiras` + RPCs de pagamento — base de A/P e caixa.
7. `contas_receber` + `vendas-domain.js` — base de recebíveis/cartões/conciliação.
8. `etiqueta_financeiro_pendente` — padrão de fila idempotente estoque → financeiro, bom modelo para outros eventos.
9. `producao_diaria.receita_snapshot/custo_total` e `fichas_custo_historico` (`db/migracao_ficha_custo_historico.sql`) — base para custo histórico.
10. `insumos_precos_historico` e `insumos_fornecedores` — base para análise de preço de compra.
11. `cmo.mjs` — base de CMO.
12. Agent Core (branch não mergeada `fase-2b2/estabilizacao`, `app/lib/server/agent/`) — infraestrutura correta para IA financeira (registry, executor, auditoria), faltam tools financeiras.

## 7. Estruturas duplicadas

| ID | O que está duplicado | Onde |
|---|---|---|
| D-1 | Custo de ficha (5 implementações) | `ficha-calculos.mjs:238` (referência); `dre/FechamentoMes.js:12-25` (cópia sem conversão de unidade); `vendas.js:298-313` `gastarReceita` (sem conversão); `db/migracao_operacao_integrada.sql:67` (SQL); `fichas/page.js` usa a referência mas recalcula margem/markup em `:3087-3091` e `:4081+` |
| D-2 | "Porções da ficha" (5 cópias, regras diferentes) | `cmv/page.js:36-43`, `FechamentoMes.js:26-33`, `vendas.js:287-294`, `relatorios/page.js:23-30` devolvem `rendimento` quando falta peso; `pizza-do-prato.mjs:195-202` devolve **0** → custo por porção diferente entre telas |
| D-3 | Custos fixos (4 cadastros) | `config_sistema.params.custo_*_mes` (Pizza, `parametros.js:20-26`); `config_sistema.params.custos_fixos` (`custos-fixos.js`, **não usado por nenhuma tela**); `localStorage ponto_equilibrio_params_<unidade>` (`financeiro.js:352-370`, usado em `financeiro/page.js:131-135`); `contas_pagar` categoria `custo_fixo` |
| D-4 | Taxa de cartão (7 fontes) e imposto (6 fontes) | `fichas_tecnicas.taxa_maquininha/imposto_pct`; `produtos.taxa_cartao/aliquota_imposto`; `params.taxa_cartao_pct/imposto_pct`; `localStorage taxaCartaoPct/impostoPct`; `FechamentoMes.js:41-43` (3,5% / 6% digitados); padrão 2,5% / 4% em `ficha-calculos.mjs:625-628` e `pizza-do-prato.mjs:255-256`; `configuracoes_adquirentes` + `CONFIGURACOES_ADQUIRENTES_PADRAO` |
| D-5 | Ponto de equilíbrio (3) | `financeiro/page.js:142-203` `calculoPE`; `custo-diario.mjs:477` `equilibrioDoCardapio`; `simularMes` por prato. (A tela `/financeiro/equilibrio` já redireciona para a Pizza.) |
| D-6 | DRE (4) | `dre/page.js` (montarDREGerencial); `dre/FechamentoMes.js` (outra fórmula, **na mesma página**); `fetchDRE` `financeiro.js:299-322` (usada só pela IA); `financeiro/page.js:205-262` "resultado" |
| D-7 | Faturamento (5 fontes) | `lancamentos` (DRE, Hub, fluxo); `vendas` (financeiro/page, fetchDRE, central de comando); `pedidos` (relatórios, engenharia); `vendas`+`venda_pagamentos` (tela Vendas); digitado (FechamentoMes) |
| D-8 | Catálogo de produto vendido (2 + espelhos) | `cardapio` (+ `fichas_tecnicas.prato_id` + `ficha_itens`, `app/lib/cardapio.js:74-150`) e `produtos` (`ficha_id`/`composicao`, `vendas.js:6-95`); `venda_itens.cardapio_id` aponta para `cardapio`, `pedidos_itens.produto_id` para `produtos`; `drinks`, `cervejas` à parte; `insumos.ficha_tecnica_id` espelha pré-preparo |
| D-9 | Ingredientes da ficha (2 tabelas) | `fichas_ingredientes` (atual) e `ficha_itens` (legado, ainda gravada por `cardapio.js:140-150`) |
| D-10 | Saldo de estoque (7 lugares) | `estoque_atual`, `estoque_itens`, `estoque_lotes`, `operacao_embalagens.quantidade_atual`, `inventario_itens`, `suprimentos_unidades`, `suprimentos_catalogo.estoque_central` (+ RPCs de bebidas) |
| D-11 | Movimentação de estoque (5 tabelas) | `estoque_movimentos` (recebimento/legado), `estoque_movimentacoes` (fallback legado em `estoques-multiplos.js`), `estoque_movimentacoes_multi`, `inventario_movimentos`, `operacao_embalagens_consumo`, `suprimentos_historico` |
| D-12 | Registro de compra (3 caminhos) | `confirmar_recebimento_integrado`; `registrarCompra` (`estoque.js:152-182`); entrada manual multi-estoque |
| D-13 | Venda (4 caminhos) | `lancarVendaBalcao`/`fecharContaDaMesa`/`fecharPedidoOnline` (pedidos); `registrarVenda` (`vendas.js:732-784`, vendas+venda_itens); `registrarVendaManual` (`financeiro.js:372-384`, vendas sem itens); tela `/dashboard/vendas` (vendas+venda_pagamentos) |
| D-14 | Duas funções `precoSugerido` com semânticas diferentes | `ficha-calculos.mjs:398` (CMV-meta) e `pizza-do-prato.mjs:275` (markup divisor com fixo rateado) |
| D-15 | Duas `unidadeNormalizada` | `ficha-calculos.mjs:50` e `ingredientes-utils.mjs` (comentário de alerta em `pizza-do-prato.mjs:32-36`) |
| D-16 | Duas stacks de IA | Copiloto legado client-side (`hefisto-*.js`) e Agent Core servidor (branch não mergeada) |

---

## 8. Problemas conceituais

**C-1. Cinco "CMVs" diferentes, nenhum é o CMV real.**
| Tela | O que chama de CMV | Evidência |
|---|---|---|
| `/financeiro/cmv` | custo da ficha ÷ preço de venda, média **simples** entre pratos (comentário chama de "CMV real") | `cmv/page.js:98-131` |
| `/financeiro/dre` → FechamentoMes | CMV médio da carta × faturamento digitado | `FechamentoMes.js:61-79` |
| `/financeiro` (tabela) | **compras do período** (entradas de estoque valorizadas) | `financeiro/page.js:216-221` |
| FinanceiroHub | **valor do estoque atual ÷ receita**, com 28,4% fixo quando não há receita | `FinanceiroHub.js:180-189` |
| PDV | consumo teórico da venda gravado em `contas_pagar` | `vendas.js:422-438` |
Nenhum usa EI + Compras − EF. O DRE "oficial" usa CMV = 0.

**C-2. `contas_pagar` virou depósito de eventos que não são contas a pagar.** CMV teórico (`vendas.js:427-433`, status `pago`), perdas de etiqueta (`etiqueta-financeiro.mjs:22-35`, categoria `inventarios`, status `pago`) e compras (`categoria 'cmv'`) entram na mesma tabela. Consequências: a lista de contas mostra "contas" que não são obrigações; o DRE exclui `cmv` (`financeiro-domain.js:142`) e com isso **exclui também o CMV**; perdas entram como despesa operacional e, quando existir CMV real por inventário, serão **contadas duas vezes** (a perda já reduz o estoque final).

**C-3. Faturamento sem fonte única** (D-7). Exemplos concretos: venda de delivery fechada em `fecharPedidoOnline` (`vendas.js:711-722`) não gera `lancamento` → não aparece no DRE; `registrarVendaManual` grava em `vendas` sem `lancamento` → aparece em `/financeiro` mas não no DRE; `lancarVendaBalcao` grava `pedidos`+`lancamentos` mas não `vendas` → aparece no DRE mas não em `/financeiro`.

**C-4. Markup, margem e CMV%.** `markup()` = preço ÷ custo (multiplicador) (`ficha-calculos.mjs:391-396`), exibido como "2,50×" (`fichas/page.js:3401`) — correto como multiplicador. **Não existe** percentual de acréscimo sobre o custo. Nos cards, "margem" = 100 − CMV% (`fichas/page.js:3089`), que é margem bruta, não margem de contribuição. Em `/financeiro/margem` o rótulo "MC" (margem de contribuição) é preço − custo manual do `cardapio` (`margem/page.js:338-343`), ignorando imposto, cartão, embalagem, comissão — é margem bruta com nome errado. `calculateFichaFinanceiro` chama de "margem líquida" um valor que não desconta custo fixo (`ficha-calculos.mjs:568-569`). O preço por CMV-meta é chamado corretamente de "CMV desejado" (não de markup).

**C-5. Custo do insumo = último preço pago.** A RPC de recebimento sobrescreve `insumos.custo_unitario/custo_compra` (`migracao_compras_recebimento.sql`, bloco "Atualizar Preço do Insumo"). Todo custo de ficha, CMV teórico e "Consumo de estoque" muda retroativamente. `db/migracao_movimento_valor.sql` fez backfill de movimentos antigos com o **custo atual** (retroagindo o preço de hoje para compras antigas). Não há custo médio ponderado.

**C-6. DRE e caixa misturados.** `lancamentos` é tratado ora como extrato de caixa (fluxo), ora como receita por competência (DRE, Hub). `competencia` existe em `contas_pagar` e nunca é lida; o DRE usa todas as contas, pagas ou não, sem data.

**C-7. Taxa de serviço.** FechamentoMes soma a taxa de serviço inteira à receita (`FechamentoMes.js:75`); a tela Vendas separa 80% equipe / 20% empresa mas grava `total = vendaBruta` com a parte da equipe dentro (`vendas/page.js:100-120`). A parte da equipe é passivo, não receita.

**C-8. Perda de processamento x perda operacional não são separadas.** FC da ficha representa só a perda de processamento teórica; não há registro de perda real de processamento; perdas operacionais estão em três lugares (seção 11).

**C-9. CMO tratado de três jeitos.** Na Pizza entra como custo "fixo" rateado por prato (`pizza-do-prato.mjs:56-74`); no DRE como linha própria; no equilíbrio de `financeiro/page.js` como fixo somando **todos os recibos de extras de sempre** (`:153-155`). Não há encargos.

**C-10. Ponto de equilíbrio com CMV-meta.** Os três cálculos usam meta de CMV (ou média de `cmv_meta` das fichas, `financeiro/page.js:144-150`), não CMV realizado. É válido como simulação, mas não deve ser apresentado como equilíbrio real.

## 9. Problemas matemáticos

| ID | Problema | Evidência | Efeito |
|---|---|---|---|
| M-1 | Custo de ficha sem conversão de unidade | `FechamentoMes.js:18` e `vendas.js:302-312` multiplicam `quantidade` da receita (ex.: g) por `custo_unitario` (ex.: R$/kg) | Custo até 1000× maior quando unidades diferem; no PDV a **baixa de estoque** também sai na unidade errada |
| M-2 | Filtro `status === "pago"` depois da normalização para `PAGA` | `financeiro/page.js:236`; `relatorios/page.js:77-79`; normalização em `db/migracao_financeiro_integrado.sql:29-34` | Despesas pagas = 0 no "resultado" do caixa e nos relatórios |
| M-3 | Filtro `status === "pendente"` no Hub | `FinanceiroHub.js:99-117`, `:192` | Vencidas, vence hoje, impostos e próximos vencimentos vazios para contas `PENDENTE` |
| M-4 | "Marcar paga" sem valor | `financeiro/page.js:300` chama `pagarConta(conta.id)` sem opções → `valorPago = 0`, `unidadeId` indefinido (`financeiro.js:227-236`); RPC falha e o fallback grava `PAGA`, `valor_pago 0`, `saldo 0` (`:254-259`) sem movimentar conta financeira | Conta "paga" com R$ 0; caixa não baixa |
| M-5 | DRE da página sem período | `dre/page.js:49` soma todas as entradas de `lancamentos`; `montarDREGerencial` soma todas as contas não canceladas, pagas ou não (`financeiro-domain.js:136-147`); CMO é do mês corrente; CMV não é passado (=0); botões Semanal/Mensal/Anual só mudam texto (`:80-87`) | Resultado sem significado econômico |
| M-6 | `fetchDRE` | `financeiro.js:302-312`: vendas e recibos de todos os tempos; folha de `colaboradores.salario_base` (o campo do colaborador é `salario`; `salario_base` é do cadastro de cargos, `PlanoCargos.js:74`) | Folha provavelmente 0 (NÃO COMPROVADO no banco); é a função usada pela IA |
| M-7 | CMV médio da carta = média simples | `cmv/page.js:127`, `FechamentoMes.js:69`, `relatorios/page.js:103` | Prato que não vende pesa igual ao campeão de vendas |
| M-8 | Equilíbrio em `financeiro/page.js` | margem mínima forçada em 1% (`Math.max(1, …)`), escondendo margem negativa; sem aluguel; custos padrão inventados (luz 1200, gás 800…); CMV padrão 32% | Meta diária otimista/fictícia |
| M-9 | Parcelas de recebível sem ajuste de centavos e prazo fixo de 30 dias | `vendas-domain.js:187-196` | Soma das parcelas ≠ total; data diverge do calendário do adquirente |
| M-10 | Valor do movimento = preço da **embalagem** × quantidade | `estoques-multiplos.js:499` e `compras.mjs:40-48` preferem `custo_compra` (preço por embalagem, conforme a RPC de recebimento) a `custo_unitario` | Superavalia se a quantidade estiver em unidade-base (RISCO; depende do cadastro) |
| M-11 | CMV no Hub = estoque / receita, fallback 28,4 | `FinanceiroHub.js:187` | Número sem relação com CMV |
| M-12 | Engenharia de cardápio lê `pedidos_itens.nome_item` | `engenharia.js:28-35`; nenhum código grava `nome_item` | Volume 0 para todos, ou erro em `.trim()` de indefinido |
| M-13 | Porções divergentes | D-2 | Mesmo prato com custo por porção diferente em Pizza x CMV |
| M-14 | Read-modify-write de saldo no navegador | `vendas.js:358-379`, `estoque.js:152-168`, `compras.mjs:249-260` | Duas vendas simultâneas perdem uma baixa |
| M-15 | `calculoPE` soma todos os recibos de extras (pagos ou não, de sempre) como CMO mensal | `financeiro/page.js:153-155` | CMO inflado |
| M-16 | Consumo do mês limitado a 500 movimentos por estoque | `cmv/page.js:61` | Total subestimado em meses movimentados |

Fórmulas verificadas como **corretas**: `custoIngrediente`/`custoSubreceita`, FC PB/PL ↔ percentual acrescido, `cmvPercentual`, `precoSugerido` (CMV-meta), `precoSugerido` markup divisor, `simularMes`, `equilibrioDoCardapio` (contribuição = 100 − variável%), `simularCardapio` (fixo descontado uma vez), `dividirParcelasExatas`, `calcularValoresPagamento`, `calcularRecebivelFinanceiro` (imposto não retido não reduz recebível), `calcularCMO` (proporcional).

## 10. Dados reais x mocks

| Local | Situação | Evidência |
|---|---|---|
| `hefisto-analytics.js` | **Números inventados**: CMV 31,2/28,7; receita 42.500/40.780; custos 31.800/28.440; "Camarão 40/60 +16,7%"; "Pescados R$ 3.400"; perdas "650 + 25/item", anterior "R$ 480"; simulação com 45.000 | `:130-131`, `:140-143`, `:184-189`, `:290-296`, `:386-388` |
| `hefisto-insights.js` | Camarão fixo; `reduce(..., 2840.00)` somando valor inventado às vencidas; CMV 31,2/28,7 | `:178`, `:311`, `:350-351`; roda via cron |
| `FinanceiroHub.js` | "Variação de CMV: Estável (p.p.)" fixo; CMV 28,4 fallback | `:475-476`, `:187` |
| `financeiro/page.js` | Custos padrão do equilíbrio inventados, CMV 32 | `:94-96`, `:144` |
| `financeiro/documentos` | **Stub**: `fetchDocumentos/inserirDocumento/...` retornam vazio/sucesso sem gravar | `financeiro.js:415-418`; `documentos/page.js:65,82` — usuário acha que salvou |
| `vendas-domain.js` | Taxas de adquirente padrão fixas (Stone 1,8/2,8/3,8, PIX 0,9, iFood 15…) usadas quando a unidade não configurou | `:17-25` |
| `parametros.js` | `pratos_por_dia: 100`, `dias_operacao_mes: 26` como padrão | `:32-33` (a Pizza avisa e sugere a média medida) |
| `rh.js` | Plano de cargos exemplo com salários | `:237-250` (é semente de configuração, não entra em cálculo — NÃO COMPROVADO que não é usado como dado) |
| `lib/mock.js` | Existe; uso não auditado em detalhe | — |
| Demais telas financeiras | Leem Supabase (dados reais), cálculo 100% no navegador | seção 12 |

---

## 11. Mapa das tabelas

Legenda: "sem CREATE" = tabela usada pelo código sem definição no repo (colunas NÃO COMPROVADAS).

| Tabela | Finalidade | PK / FKs | Tenant | Campos financeiros | Qtd | Datas | Status | Origem | Telas / RPC | Riscos |
|---|---|---|---|---|---|---|---|---|---|---|
| `contas_pagar` (sem CREATE) | A/P + (indevidamente) CMV, compras, perdas | id; `fornecedor_id`, `conta_financeira_id` | `unidade_id` | valor, valor_original, valor_pago, saldo, juros, multa, desconto | parcela_numero/total | data_vencimento, data_pagamento, competencia | PAGA/PENDENTE **e** pago/pendente | manual, recorrente, recebimento, PDV, etiqueta, `registrarCompra` | contas, financeiro, dre, fluxo, hub, relatórios; `registrar_pagamento_conta`, `estornar_pagamento_conta` | C-2, M-2..M-4; RPC recebimento não preenche `fornecedor_id`/`origem_tipo` |
| `contas_pagar_pagamentos` | Pagamentos/estornos | id; conta_pagar_id, conta_financeira_id | `unidade_id uuid` | valor_pago, juros, multa, desconto, valor_efetivo_saida | — | data_pagamento | estornado | RPC | contas | R-3 (uuid) |
| `contas_financeiras` | Bancos/caixas | id | `unidade_id uuid` | saldo_inicial, saldo_atual | — | — | ativo | manual / RPC | fluxo, conciliação | saldo mutável sem razão contábil; R-3 |
| `lancamentos` | "Extrato" misto | id | `unidade_id` | valor | — | data | tipo entrada/saida | manual, PDV, RPC pagamento | dre, fluxo, hub, rh, rede | usado como receita e como caixa (C-6) |
| `vendas` | Venda (3 caminhos) | id; pedido_id, lancamento_id | `unidade_id text` + `empresa_id` | subtotal, desconto, total, taxa_servico_*, comissao_marketplace, impostos_venda, valor_bruto/liquido, **cmv_teorico (sempre 0)** | — | created_at, data_venda, data_operacional | concluida / CONCLUIDA / cancelada | registrarVenda, venda manual, tela Vendas, integrações | financeiro, vendas, central | status em duas caixas; C-3 |
| `venda_itens` | Itens de `vendas` | id; venda_id, `cardapio_id` | unidade_id | preco_unit, **custo_unit** (snapshot) | quantidade | — | — | registrarVenda | — | aponta para `cardapio`, não `produtos` (D-8) |
| `venda_pagamentos` | Split de pagamento | id; venda_id | `unidade_id uuid` | valor, parcelas, adquirente | — | — | — | tela Vendas | — | R-3 |
| `contas_receber` | Recebíveis | id; venda_id, venda_pagamento_id | `unidade_id uuid` | valor_bruto, taxa_percentual, taxa_valor, comissao, retencao, valor_liquido_esperado, valor_recebido | parcela | data_venda, data_prevista_repasse, data_real_repasse | PREVISTO/RECEBIDO/… | tela Vendas, iFood, Saipos | recebíveis, conciliação, central | não gerado pelo PDV nem pelo delivery |
| `configuracoes_adquirentes`, `lotes_repasses`, `conciliacao_financeira` | Taxas/repasses/conciliação | — | uuid | taxas, valores | — | datas | — | manual | conciliação | taxa padrão do código se vazio |
| `pedidos` / `pedidos_itens` (sem CREATE) | Comanda/PDV/delivery | id; mesa_id / pedido_id, produto_id | `unidade_id` | valor_total / valor_unitario | quantidade | created_at | aberto/pago/… | PDV, delivery, público | relatórios, engenharia, KDS | engenharia lê `nome_item` inexistente |
| `produtos` (sem CREATE) | Produto vendável | id; ficha_id, composicao (json), embalagens (json) | `unidade_id` | preco_venda, taxa_cartao, aliquota_imposto | — | — | — | produtos page | CMV, pizza, PDV | concorre com `cardapio` |
| `cardapio` (sem CREATE) | Catálogo legado | id | `unidade_id` | preco, **custo (manual)** | — | — | status | cardápio público/legado | margem, engenharia, rede | custo digitado, não vem da ficha |
| `fichas_tecnicas` (sem CREATE) | Ficha (prato, pré-preparo, produto pronto) | id; prato_id (legado) | `unidade_id` | preco_venda, cmv_meta, custo_embalagem, custo_embalagens_total, taxa_maquininha, imposto_pct | rendimento_porcoes, peso_porcao_g | — | eh_base, tipo_base, estoqueavel | fichas | todas | nome usado como chave de ligação com produto (fallback por nome) |
| `fichas_ingredientes` (sem CREATE) | Composição | id; ficha_id, insumo_id, subficha_id | via ficha | — | quantidade, fator_correcao (%), unidade | — | — | fichas | custo, consumo | `unidade` nula na maioria (NÃO COMPROVADO) |
| `ficha_itens` | Composição legada | — | — | — | — | — | — | `cardapio.js` | — | D-9 |
| `fichas_custo_historico`, `fichas_versoes` | Histórico de custo/versão | — | text | custos | — | created_at | — | migração | — | uso não auditado a fundo |
| `insumos` (sem CREATE) | Ingrediente/produto de estoque | id; fornecedor_atual_id, ficha_tecnica_id | `unidade_id` | custo_compra (embalagem), custo_unitario, preco_normalizado, tamanho_embalagem, ganho_pct, custo_empanado_kg | — | preco_atualizado_em | — | cadastro, recebimento | tudo | custo = último preço (C-5) |
| `insumos_precos_historico` | Mudanças de preço | id; insumo_id, fornecedor_id | text | valor/preço normalizado antes/depois, diferença % | **sem quantidade** | created_at | — | cadastro, recebimento | CMV (limit 400) | só registra mudança, não compra |
| `insumos_fornecedores` | Preço por fornecedor | — | text | preco, preco_normalizado | tamanho_embalagem | atualizado_em | — | ingredientes | — | — |
| `pedidos_compra` / `_itens` | Pedido de compra | id; fornecedor_id / pedido_id, insumo_id | `unidade_id uuid` | valores estimado/real | pedida/recebida | created_at | RASCUNHO…RECEBIDO | compras | compras | R-3; RLS aberta (R-5) |
| `recebimentos_compra` / `_itens` | Recebimento/NF | id; pedido_id, fornecedor_id / insumo_id | `unidade_id uuid` | valor_total_nota, preco_unitario_pago, preco_esperado, divergencia_preco_pct | qtd embalagem, tamanho, base | data_recebimento, data_validade | divergencia_detectada | RPC | compras | **melhor fonte para "quanto compramos de X"** |
| `devolucoes_fornecedor` / `_itens` | Devolução | — | uuid | valores | qtd | — | — | compras.mjs | compras | não estorna conta a pagar |
| `estoque_atual` (sem CREATE) | Saldo legado por insumo | (unidade_id, insumo_id) | text | — | quantidade_atual | updated_at | — | PDV, compras, produção, sync | hub, relatórios, central | diverge de `estoque_itens` (PDV só baixa aqui) |
| `estoques` / `estoque_itens` | Depósitos e saldo por depósito | id; estoque_id, insumo_id | `unidade_id text` | custo_unitario | quantidade_atual, mínimo, máximo | validade | status | estoque multi | estoque, CMV | — |
| `estoque_lotes` | Lote por validade (FEFO) | id; estoque_id, insumo_id | text | — | quantidade | validade | — | RPCs de lote | estoque | RPC de compras usa outras colunas (R-4) |
| `estoque_movimentacoes_multi` | Razão de estoque multi | id; estoque_id, destino, insumo_id, producao_id | text | valor_unitario, valor_total | quantidade, saldos | data_movimento | tipo entrada/saida/contagem/transferência | UI, produção | CMV (consumo), financeiro | sem fornecedor/nota; sem tipo perda |
| `estoque_movimentos` | Razão legado | — | text/uuid | — | quantidade_base, saldos | data_movimento | tipo | recebimento, legado | IA legada | D-11 |
| `producao_diaria` | Produção | id; ficha_id, colaborador_id | text | custo_total | quantidade_produzida | created_at, validade | — | RPC | produção | sem rendimento real |
| `operacao_embalagens` (+`_consumo`) | Embalagens | — | text | preco_unitario | quantidade_atual | — | — | PDV | embalagens | D-10 |
| `etiqueta_financeiro_pendente` | Fila perda → financeiro | id; etiqueta_id, evento_id | text | valor | — | competencia | pendente/lancado/dispensado | etiquetas | validade | destino errado (C-2) |
| `inventario_itens` / `inventario_movimentos` (sem CREATE) | Patrimônio físico | — | text | valor_unitario | quantidade | — | tipo entrada/quebra/perda/descarte/ajuste | gestão/inventário | relatórios | sem depreciação |
| `config_sistema.params` (JSON) | Parâmetros | — | text | custos fixos, %, meta CMV, margem alvo | pratos/dia | — | — | pizza, configurações | pizza, CMV | D-3 |
| `colaboradores` (sem CREATE) | Equipe (canônica) | — | text | salario, vale_alimentacao, taxa_servico_mes | — | — | status, tipo_contrato | RH | CMO | sem encargos; setor por texto |
| `rh_recibos_prestacao` | Diárias de extras | — | text | valor_total | — | data_trabalho, data_pagamento | pagamento_realizado | RH extras | CMO | — |
| `holerites` (rh-portal) | Folha fechada | func_id → id do colaborador por convenção | text | líquido, detalhes | — | mes/ano | — | `fecharFolhaMensal` | RH | fonte melhor que salário cadastrado; vínculo fraco (ver memória RH) |
| `producao_dia`, `compras_pedidos` | Usadas por `central-comando.js:45-46` e `migracao_central_comando.sql:100-108` | — | — | — | — | — | — | — | Central de Comando | **nunca criadas no repo** — nomes provavelmente errados (NÃO COMPROVADO no banco) |

## 12. Mapa das páginas

Todas são componentes cliente ("use client") com cálculo no navegador; nenhuma tem agregação no backend, exceto onde indicado.

| Rota | Componente / lib | Fonte de dados | Estado | Real/mock | Cálculo | Duplica |
|---|---|---|---|---|---|---|
| `/dashboard/financeiro` (hub) | `components/navigation/FinanceiroHub.js` | contas_pagar, lancamentos, estoque_atual, colaboradores, recibos | Ativa | Real + fixos (M-11, "Estável") | local | D-6, D-7 |
| `/dashboard/financeiro?view=tabela` | `financeiro/page.js` | vendas, contas_pagar, entradas estoque, fichas, RH, localStorage | Ativa | Real + padrões inventados | local | D-3, D-5, D-6 |
| `/financeiro/dre` | `dre/page.js` + `FechamentoMes.js` | lancamentos, contas_pagar, RH, fichas, produtos, digitação | Ativa | Real, cálculo errado | local | D-1, D-6 |
| `/financeiro/cmv` | `cmv/page.js` | produtos, fichas, histórico preços, movimentos multi | Ativa | Real | local | D-1(ok), D-2 |
| `/financeiro/margem` | `margem/page.js` | `cardapio` (custo manual) | Ativa | Real | local | C-4 |
| `/financeiro/pizza` | `pizza/page.js` + `pizza-do-prato.mjs`, `custo-diario.mjs` | fichas, produtos, params, RH, vendas | Ativa, melhor tela | Real + parâmetros manuais | local | absorveu equilíbrio e custos fixos |
| `/financeiro/equilibrio` | redireciona → pizza | — | Redirect | — | — | — |
| `/financeiro/custos-fixos` | redireciona → pizza | — | Redirect | — | — | — |
| `/financeiro/contas` | `contas/page.js` | contas_pagar, fornecedores, pagamentos | Ativa | Real | local + RPC | — |
| `/financeiro/fluxo` | `fluxo/page.js` | lancamentos, contas_pagar, contas_financeiras | Ativa | Real | local | ignora recebíveis |
| `/financeiro/recebiveis` | `recebiveis/page.js` | contas_receber | Ativa | Real | local | — |
| `/financeiro/conciliacao` | `conciliacao/page.js` | contas_receber, contas_financeiras | Ativa | Real | local + lib | — |
| `/financeiro/documentos` | `documentos/page.js` | **stub** | Quebrada silenciosamente | Mock | — | — |
| `/dashboard/vendas` | `vendas/page.js` | vendas, venda_pagamentos, contas_receber (supabase direto) | Ativa | Real | local | D-13 |
| `/operacao/fichas`, `/operacao/fichas/[id]` | `fichas/page.js` (4.531 linhas) | fichas, insumos, produtos | Ativa | Real | local (ficha-calculos) | recalcula margem/markup inline |
| `/operacao/produtos` | `produtos/page.js` | produtos, fichas, embalagens | Ativa | Real | local | D-8 |
| `/operacao/engenharia` | `engenharia/page.js` + `lib/engenharia.js` | cardapio, pedidos, pedidos_itens | Ativa, volume inválido | Real | local | M-12 |
| `/operacao/compras` | `compras/page.js` | pedidos_compra, recebimento RPC, insumos_fornecedores | Ativa | Real | RPC SQL | D-12 |
| `/operacao/estoque` (+tablet, calendário) | `estoque/page.js` (2.791 linhas) | estoques, estoque_itens, lotes, movimentos | Ativa | Real | RPC SQL + local | D-10 |
| `/operacao/producao` | `producao/page.js` | fichas, producao_diaria, RPC produção | Ativa | Real | RPC SQL | — |
| `/operacao/validade` | `validade/page.js` | etiquetas | Ativa | Real | local | "Perdas (R$)" só de etiquetas |
| `/operacao/ingredientes` | `ingredientes/page.js` | insumos, fornecedores, preços | Ativa | Real | local | — |
| `/operacao/orcamento` | `orcamento/page.js` | fichas, produtos | Ativa | Real | local (multiplicador de margem de evento) | fórmula própria |
| `/operacao/notas` | `notas/page.js` | notas_fiscais | Ativa | Real | local | não gera compra/estoque (NÃO COMPROVADO) |
| `/gestao/inventario` | `gestao/inventario/page.js` | inventario_itens | Ativa | Real | local | patrimônio sem valor contábil |
| `/dashboard/relatorios` | `relatorios/page.js` | pedidos, contas, fichas, estoque, inventário, RH | Ativa | Real | local | D-2, M-2 |
| `/dashboard/rede` | `rede/page.js` | estoque, RH, cardapio, lancamentos | Ativa | Real | local | — |
| `/dashboard` (Central de Comando) | `central-comando.js` | estoque_atual, **producao_dia**, **compras_pedidos**, contas, recebíveis, vendas | Ativa | Parcialmente vazia (tabelas inexistentes) | local | — |

## 13. Mapa das APIs/RPCs

| RPC / rota | Onde | Usada por | Observação |
|---|---|---|---|
| `registrar_pagamento_conta`, `estornar_pagamento_conta` | `db/migracao_financeiro_integrado.sql` | `financeiro.js:239`, `:268` | SECURITY DEFINER; `p_unidade_id uuid` (R-3); fallback JS inseguro (M-4) |
| `confirmar_recebimento_integrado` | `db/migracao_compras_recebimento.sql:129` | `compras.mjs:203` | SECURITY DEFINER; uuid; colunas de lote incompatíveis (R-4) |
| `confirmar_producao_integrada`, `prever_producao_integrada`, `operacao_*` | `db/migracao_operacao_integrada.sql` | `estoque.js:132,145` | Melhor motor de consumo; `revoke` de anon/authenticated (execução via RPC exposta deve ser conferida — NÃO COMPROVADO grants finais) |
| `registrar_movimento_estoque_multi`, `registrar_contagem_estoque_multi`, `transferir_item_entre_estoques`, lotes | `db/migracao_estoque_lotes.sql` | `estoques-multiplos.js` | — |
| `registrar_movimento_estoque` | legado | `estoque.js:231` | com fallback direto nas tabelas |
| `bebida_*` | — | `estoque-bebidas.js` | CREATE não localizado nesta auditoria (NÃO COMPROVADO) |
| `merge_config_sistema_params` | — | `parametros.js:71`, `custos-fixos.js:266` | — |
| `etiqueta_financeiro_marcar_*` | `db/etiquetas/0001` | `etiqueta-financeiro.js` | — |
| `/api/etiquetas/financeiro/drenar` | rota | fila de perdas | — |
| `/api/ifood/poll`, `/api/ifood/webhook`, `/api/integrations/*` | rotas | `integrations/ifood/adapter.mjs` (comissão/repasse `:373-390`) | gera recebíveis |
| `/api/hefisto` | rota | parser de intenção (não executa) | — |
| `/api/hefisto/automation/cron` | rota | `hefisto-automations.js` → `hefisto-insights.js` | dados inventados (R-1); segredo com valor padrão no código (R-6) |
| `/api/agent/chat` + tools | **só na branch** `fase-2b2/estabilizacao` | — | não está na `main` |

---

## 14. Fluxo atual: Compra → Estoque → Ficha → Venda → Financeiro

1. **Compra.** Três portas (D-12). Só a RPC de recebimento grava item, quantidade, preço pago, fornecedor e nota de forma estruturada. Ela sobrescreve o custo do insumo com o último preço, grava saldo em `estoque_atual` e movimento em `estoque_movimentos` (não em `estoque_movimentacoes_multi`, que é a que o CMV e o financeiro leem), e cria uma conta a pagar `cmv`/`pendente`/+30 dias sem `fornecedor_id`.
2. **Estoque.** Dois saldos principais que não se reconciliam: `estoque_itens` (multi, com lotes) e `estoque_atual` (legado). A produção atualiza os dois; o PDV e a compra atualizam só `estoque_atual`.
3. **Ficha.** Custo calculado corretamente em `ficha-calculos.mjs` e em SQL; preço vem do `produtos` (ou do nome da ficha como fallback).
4. **Venda.** Quatro portas (D-13). Só o PDV dispara baixa de estoque e "CMV", no navegador, sem transação, sem conversão de unidade, sem gravar movimento no razão multi, e lança o custo como conta paga.
5. **Financeiro.** Cada tela recompõe faturamento, custos e resultado com sua própria fórmula e sua própria fonte. Não há fechamento de período.

Resultado: o elo **Venda → Estoque → CMV → DRE** está quebrado em três pontos (baixa errada, CMV fora do DRE, faturamento sem fonte única).

## 15. O que falta para: Compra → Estoque → Perdas → Ficha → Precificação → Venda → CMV teórico → CMV real → DRE → Caixa → Resultado → IA

| Elo | Falta |
|---|---|
| Compra | Porta única (recebimento); `fornecedor_id` e competência na conta; unidade `text`; entrada manual também com fornecedor/nota ou marcada como "ajuste" |
| Estoque | Um saldo e um razão (movimentos multi); valor no movimento pelo custo de entrada; custo médio ponderado por insumo/estoque |
| Perdas | Tipos de movimento `perda_processamento`, `perda_operacional` (vencimento, queda, erro, sobra, devolução) com motivo estruturado e valor; etiqueta alimentando o mesmo razão, não `contas_pagar` |
| Ficha | Uma função de custo (a SQL ou a `ficha-calculos`, com teste de paridade); rendimento real registrado na produção |
| Precificação | Um cadastro de parâmetros por unidade/canal (imposto, cartão por bandeira/adquirente, iFood, embalagem, comissão); motor markup divisor com CMV-meta, margem de contribuição-alvo e lucro-alvo |
| Venda | Porta única (`vendas` + `venda_itens` com `produto_id`, preço e **custo snapshot**), canal, forma de pagamento; delivery e PDV gerando o mesmo registro |
| CMV teórico | Σ(qtd vendida × custo snapshot) por período/produto/setor, persistido; baixa por `operacao_consumo_ficha` em SQL |
| CMV real | Fechamento de inventário valorizado (EI e EF por data) + compras do período pelo recebimento |
| DRE | Por competência, com período, plano de contas fixo/variável, CMV real, CMO com encargos, taxas e impostos reais |
| Caixa | `lancamentos` como extrato de caixa apenas; previsto = contas a pagar + contas a receber; recebíveis gerados por toda venda |
| Resultado | Fechamento mensal gravado (snapshot) para comparar períodos |
| IA | Tools READ financeiras no Agent Core sobre as funções acima; remover o copiloto que inventa números |

---

## 16. GAP ANALYSIS

| Área | Classificação | Resumo |
|---|---|---|
| CMV real | [NÃO EXISTE] | Sem inventário valorizado por período |
| CMV teórico | [EXISTE MAS PRECISA CORRIGIR] [RISCO] | PDV no navegador, sem conversão, em contas_pagar, fora do DRE |
| Custo da ficha | [EXISTE] [DUPLICADO] | Referência correta; 4 cópias divergentes |
| Precificação por CMV-meta | [EXISTE] | `precoSugerido` fichas |
| Markup divisor completo | [PARCIAL] | Pizza cobre imposto/cartão/embalagem/fixo/margem; faltam comissão, iFood, delivery por canal |
| Markup % acréscimo | [NÃO EXISTE] | Só multiplicador |
| Margem / MC | [EXISTE MAS PRECISA CORRIGIR] | Nomes trocados (C-4) |
| Compras | [PARCIAL] [DUPLICADO] | Recebimento bom; 3 portas; uuid |
| Estoque | [EXISTE] [DUPLICADO] | Multi + lotes bons; 7 saldos |
| Lotes / FEFO | [EXISTE] [RISCO] | RPC de compras incompatível |
| Inventário (contagem) | [PARCIAL] | Sem fechamento de período |
| Perdas | [PARCIAL] [DUPLICADO] | 3 registros, destino errado |
| Rendimento | [PARCIAL] | Só teórico (FC) |
| Produção | [EXISTE] | Motor SQL atômico, sem rendimento real |
| Custos fixos | [DUPLICADO] | 4 cadastros |
| Custos variáveis | [PARCIAL] | Só percentuais digitados |
| CMO | [PARCIAL] | Sem encargos/setor estruturado |
| DRE | [EXISTE MAS PRECISA CORRIGIR] [DUPLICADO] | 4 versões, errada |
| Fluxo de caixa | [PARCIAL] | Sem recebíveis |
| Cartões / recebíveis | [PARCIAL] | Só tela Vendas e integrações geram |
| Ponto de equilíbrio | [DUPLICADO] | 3 cálculos, 1 com dados inventados |
| Patrimônio | [PARCIAL] | Quantidade + valor unitário |
| Depreciação | [NÃO EXISTE] | — |
| Engenharia de cardápio | [EXISTE MAS PRECISA CORRIGIR] | Volume sempre 0 |
| Simulações | [PARCIAL] | Por prato/cardápio |
| IA financeira | [RISCO] | Copiloto inventa números; agent sem tools financeiras |
| Multi-tenant financeiro | [RISCO] | uuid x text; RLS aberta |

### Riscos registrados (sem alteração nesta fase)

- **R-1 (crítico)** Números fabricados em respostas e alertas da IA legada (seção 10). Mesmo que o painel `HefistoCopilotPanel` não esteja montado em nenhuma rota da `main` (não é importado por outro arquivo), `hefisto-insights` é usado por `/api/hefisto/automation/cron` e por `/dashboard/configuracoes/automacoes`.
- **R-2** Conta marcada como paga com valor 0 (M-4).
- **R-3** `unidade_id uuid` nas tabelas/RPCs de financeiro, compras e recebíveis (`migracao_financeiro_integrado.sql`, `migracao_compras_recebimento.sql`, `migracao_vendas_recebiveis_conciliacao.sql`, `migracao_central_comando.sql`) contra ids de unidade em texto. Estado real no banco: NÃO COMPROVADO.
- **R-4** `confirmar_recebimento_integrado` insere em `estoque_lotes` colunas (`quantidade_inicial`, `quantidade_atual`, `numero_lote`, `data_validade`, `setor`) que não existem na definição de `db/migracao_estoque_lotes.sql:24-33` (`estoque_id`, `validade`, `quantidade`). Recebimento com lote informado deve falhar. NÃO COMPROVADO no banco.
- **R-5 (segurança, só registro)** Políticas `for all to authenticated using (true) with check (true)` em `pedidos_compra*`, `recebimentos_compra*`, `devolucoes_*`, `contas_financeiras`, `contas_pagar_pagamentos`, `vendas`, `venda_itens`; RPCs SECURITY DEFINER recebem `p_unidade_id` do cliente sem checar vínculo do usuário. Pode já ter sido substituído pelo trabalho de RLS em andamento — NÃO COMPROVADO. Não alterado.
- **R-6 (segurança, só registro)** `app/api/hefisto/automation/cron/route.js:14` tem valor padrão de segredo no código (repo público) quando a variável de ambiente falta, aceita o segredo por query string e escolhe o tenant por cabeçalho `x-tenant-id`. Não alterado.
- **R-7** Tela de documentos financeiros finge salvar (seção 10).
- **R-8** Central de Comando consulta tabelas inexistentes no repo (`producao_dia`, `compras_pedidos`).

---

## 17. Proposta de fases seguintes

Ordem pensada para não construir tela sobre número errado. Cada fase em branch própria, migração idempotente rodada pelo dono, preview antes de produção.

| Fase | Objetivo | Entregas principais | Depende de |
|---|---|---|---|
| **F1 — Verdade mínima** | Parar de mostrar número falso ou zerado | Remover números fixos do copiloto/insights (responder "sem dados" com rastreabilidade); normalizar leitura de status (`PAGA`/`pago`); corrigir `pagarConta` sem valor; DRE com período real; documentos: esconder ou implementar; tirar padrões inventados do equilíbrio antigo | nada (só front) |
| **F2 — Fundação de dados** | Uma fonte por conceito | Schema baseline (pg_dump do dono) versionado; decisão `unidade_id text` nas tabelas financeiras; dicionário de conceitos (CMV real, CMV teórico, custo ficha, MC, markup) no código; parâmetros financeiros por unidade num lugar só (migrar localStorage e `custos_fixos`) | dono rodar dump |
| **F3 — Venda única + CMV teórico** | Toda venda no mesmo registro | `vendas`/`venda_itens` com `produto_id` e custo snapshot para PDV, delivery, iFood; baixa por `operacao_consumo_ficha` em SQL (transacional); CMV teórico por período/produto/setor; tirar CMV de `contas_pagar` | F2 |
| **F4 — Estoque valorado + perdas** | Um razão, custo médio, perdas tipadas | Razão único (`estoque_movimentacoes_multi`), custo médio ponderado, tipos de perda, etiqueta no razão, rendimento real na produção, compras só pelo recebimento (corrigir lotes) | F2 |
| **F5 — Inventário de fechamento + CMV real** | EI + C − EF | Fechamento mensal valorizado (snapshot), CMV real, comparação real x teórico com decomposição do desvio (perdas registradas, ajustes de contagem, diferença não explicada) | F3, F4 |
| **F6 — DRE gerencial + CMO** | Eficácia econômica | Plano de contas com natureza fixo/variável, competência, CMO com encargos e por setor (colaboradores canônico), impostos/taxas reais, fechamento mensal gravado | F5 |
| **F7 — Caixa, cartões e recebíveis** | Caminho do dinheiro | Recebível para toda venda, taxa por adquirente/bandeira/parcela configurada, previsto x realizado, conciliação | F3 |
| **F8 — Precificação, engenharia, simulador** | Decisão | Motor único de preço (CMV-meta, markup divisor, MC-alvo, canal), engenharia de cardápio com vendas reais (popularidade × MC × volume × resultado), simulador de cenários sobre o DRE | F5, F6 |
| **F9 — Patrimônio** | Balanço gerencial | Ativos com aquisição/vida útil/depreciação, estoque valorado, caixa/bancos, recebíveis, contas a pagar, PL gerencial | F6, F7 |
| **F10 — IA financeira** | Insights rastreáveis | Tools READ financeiras no Agent Core (após merge das fases 2), detectores sobre fechamentos gravados, todo alerta com "Por quê?" e link para o dado | F5–F8 |

Decisões que são do dono antes da F2: (a) `vendas` como fonte única de faturamento; (b) `produtos` como catálogo canônico (aposentar `cardapio`); (c) custo médio ponderado como método de custeio; (d) se `lancamentos` vira só extrato de caixa.

---

## Tabela final

| ÁREA | SITUAÇÃO | EVIDÊNCIA | GAP | PRIORIDADE |
|---|---|---|---|---|
| CMV real | NÃO EXISTE | nenhuma função EI+C−EF; 5 "CMVs" (C-1) | Inventário valorizado por período | Alta (F5) |
| CMV teórico | EXISTE MAS PRECISA CORRIGIR | `vendas.js:272-438`; `vendas.cmv_teorico` sempre 0 | Snapshot por venda, SQL, fora de contas_pagar | Alta (F3) |
| Ficha técnica | EXISTE / DUPLICADO | `ficha-calculos.mjs:238`; cópias em `FechamentoMes.js:12`, `vendas.js:298` | Função única, paridade JS×SQL | Alta (F2) |
| Precificação | PARCIAL | `ficha-calculos.mjs:398`; `pizza-do-prato.mjs:275` | Motor único por canal | Média (F8) |
| Markup | PARCIAL | `ficha-calculos.mjs:391` (multiplicador) | % acréscimo; nomenclatura | Baixa (F8) |
| Margem | EXISTE MAS PRECISA CORRIGIR | `margem/page.js:338` "MC" = margem bruta; `fichas/page.js:3089` | MC real com variáveis | Média (F6/F8) |
| Compras | PARCIAL / DUPLICADO | RPC `confirmar_recebimento_integrado`; `estoque.js:152`; uuid | Porta única, fornecedor na conta | Alta (F4) |
| Estoque | EXISTE / DUPLICADO | `estoques-multiplos.js`; 7 saldos (D-10) | Saldo e razão únicos, custo médio | Alta (F4) |
| Inventário | PARCIAL | `registrar_contagem_estoque_multi` | Fechamento valorizado | Alta (F5) |
| Perdas | PARCIAL / DUPLICADO | etiqueta→`contas_pagar` (`etiqueta-financeiro.mjs:22-35`); `gestao/inventario`; motivo texto | Tipos de perda no razão | Alta (F4) |
| Rendimento | PARCIAL | FC em `ficha-calculos.mjs:103`; produção sem peso real | Rendimento real registrado | Média (F4) |
| Produção | EXISTE | `confirmar_producao_integrada` | Rendimento/perda de processo | Média (F4) |
| Custos fixos | DUPLICADO | params, `custos_fixos` (morto), localStorage, contas_pagar | Plano de contas + um cadastro | Alta (F2/F6) |
| Custos variáveis | PARCIAL | % digitados em 6-7 lugares (D-4) | Parâmetros por canal/adquirente | Alta (F2) |
| CMO | PARCIAL | `cmo.mjs:34-51`; `fetchDRE` usa `salario_base` | Encargos, setor, holerites | Média (F6) |
| DRE | EXISTE MAS PRECISA CORRIGIR / DUPLICADO | `dre/page.js:47-59`; 4 versões | Período, competência, CMV, fixo/variável | Crítica (F1 correção, F6 completo) |
| Fluxo de caixa | PARCIAL | `financeiro-domain.js:171-208` | Recebíveis no previsto | Média (F7) |
| Cartões | PARCIAL | `vendas-domain.js:17-25,155-227` | Gerar para toda venda; taxas configuradas | Média (F7) |
| Ponto de equilíbrio | DUPLICADO / RISCO | `financeiro/page.js:142-203` (inventado); `custo-diario.mjs:477` (correto) | Manter só o correto com dado real | Alta (F1) |
| Patrimônio | PARCIAL | `inventario_itens.valor_unitario` (`relatorios/page.js:110`) | Ativo com aquisição | Baixa (F9) |
| Depreciação | NÃO EXISTE | nenhuma ocorrência no código/SQL | Vida útil, método | Baixa (F9) |
| Engenharia de cardápio | EXISTE MAS PRECISA CORRIGIR | `engenharia.js:28-35` (`nome_item` nunca gravado) | Vendas reais + MC + período | Média (F8) |
| Simulações | PARCIAL | `simularMes`, `simularCardapio`; `simulation.whatIf` inventada | Simulador sobre DRE real | Média (F8) |
| IA financeira | RISCO | `hefisto-analytics.js:130,184-189,386`; `hefisto-insights.js:178,311,350` | Remover números fixos; tools reais | Crítica (F1 remoção, F10 construção) |
| Granularidade (empresa/unidade/setor/período) | PARCIAL / RISCO | `unidade_id` em tudo mas uuid×text; setor por texto/regex; `empresa_id` só em `unidades`/`vendas` | Tipos únicos, setor estruturado, consolidação por empresa | Alta (F2) |

---

Fim da Fase 0. Nada foi implementado. Aguardando análise e decisões do dono (seção 17) antes de qualquer fase seguinte.
