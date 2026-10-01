# F2.4B — COMPRAS → CUSTO MÉDIO → CONTA A PAGAR

Data: 2026-10-01 · Branch `fase-f2-4b/compras-custo-medio`. **Migration proposta, NÃO executada. Nada publicado.**

## 1. Auditoria do banco real (01/10)

Fonte: `db/diagnosticos/F2_4B_AUDITORIA_COMPRAS.sql`, rodada pelo dono.

| O que | Situação em produção |
|---|---|
| `compras`, `compras_itens`, `estoque_custos` (F2.1) | Existem, **vazias**, com RLS por unidade |
| `pedidos_compra`, `recebimentos_compra`, devoluções, `estoque_movimentos` | **Não existem** |
| `fornecedores` | **0 cadastrados** |
| `notas_fiscais` | 16 notas, de 14/06 a 24/07; nenhum uso desde julho |
| `insumos_precos_historico` | 453 registros; em uso (27 nos últimos 30 dias). É o histórico de preço do cadastro de Produtos |
| Entradas do Controle de Estoque (`estoque_movimentacoes_multi`, tipo entrada) | Jul: 119 entradas, soma **R$ 11.140.628,90**. Ago: 92, soma R$ 2.188.352,30. Set: 42, sem valor |
| Contas a pagar de mercadoria / CMV | 1, de R$ 9 |

**Fluxo antigo de pedidos:** a tela "Cotações e Compras" chama tabelas e uma RPC do fluxo antigo que **não existem** em produção. Essa parte não funciona hoje.

**"Compras do mês":** a tela soma as **entradas** do Controle de Estoque. Os valores de julho e agosto são de milhões, o que só se explica por unidade errada (por exemplo, ml × preço da garrafa). **Esses números não servem para CMV.**

**Decisão:** o registro oficial de compras passa a ser `compras` e `compras_itens`, da F2.1. Nada do legado foi alterado.

**Regras abertas, só registradas:**
- `estoque_movimentacoes_multi`, `insumos_fornecedores`, `insumos_precos_historico` e `notas_fiscais` usam USING true;
- `notas_fiscais` e `insumos_precos_historico` valem para o papel public.

Ficam para uma etapa própria de segurança, a SEC-EST-2.

## 2. O que a F2.4B faz

### Banco (`db/F2_4B_COMPRAS_CUSTO_MEDIO.sql`)

Uma transação, que aborta sem mudar nada se a F2.1 estiver incompleta.

**Colunas novas:**
- **compra:** `data_recebimento`, `forma_pagamento` e `data_vencimento`;
- **item:** `quantidade_pedida_embalagens` e `valor_pedido`, para comparar pedido × recebido;
- **`estoque_custos`:** `unidade_base`.

**Tabela nova `estoque_custos_historico`:** guarda cada compra, contagem e estorno, com custo médio antes e depois, quantidade, valor e custo da entrada. O app só lê, por unidade.

**`compras_confirmar(compra, gerar_conta, vencimento)`:** grava tudo de uma vez, ou nada.
- **Compra:** fica confirmada, com quando e quem.
- **Custo médio de cada produto:** usa a fórmula **única** já existente, `estoque_custo_medio_novo`. Frete e desconto entram no custo, rateados pelo valor dos itens.
- **Histórico:** grava o custo antes e depois de cada produto.
- **Conta a pagar** (opcional):
  - valor total, vencimento, fornecedor e NF;
  - competência no mês da compra;
  - origem `COMPRA`, categoria `mercadoria_insumos`, que **não é despesa nem CMV**;
  - o texto legado da categoria é "cmv", que o DRE antigo já tira das despesas;
  - uma conta por compra, mesmo com clique duplo.
- **Recusas:** data futura, desconto maior que o valor, vencimento ausente quando gera conta, e unidade incompatível com o custo já existente (por exemplo, custo em g e entrada em "un").

**`compras_cancelar(compra, motivo)`:**
- **Rascunho:** cancela.
- **Confirmada:** só se for a **última movimentação de custo** de cada produto dela e a conta a pagar não tiver pagamento. O custo volta ao anterior, com histórico de estorno, e a conta é cancelada com motivo. **Nada é apagado.**

**Inventário fechado → custo:**
- **Saldo de referência:** um gatilho no fechamento da contagem da unidade inteira ajusta o saldo para a quantidade contada, mais as compras recebidas depois da data da contagem.
- **Custo inicial:** produto sem custo médio começa com o **custo congelado na contagem**.
- **Inventário já fechado antes da migration:** inicializa o custo na hora de aplicar.

**Método periódico:** o consumo entre contagens não é estimado. A quantidade da fórmula do custo médio é "o que foi contado + o que foi comprado depois".

**Permissões:**
- o app chama só as duas RPCs; as funções internas não são chamáveis;
- o anon não executa nada;
- `compras_itens` ganha DELETE só para tirar item de **rascunho**, porque o trigger da F2.1 recusa em compra confirmada ou cancelada.

**Rollback:** no fim do arquivo. Volta a estrutura da F2.1.

### Tela `/dashboard/operacao/estoque/compras`

No menu: Operacional → **Compras e Custo Médio**.

- **Compras:**
  - período: esta semana, este mês ou personalizado;
  - total comprado (só confirmadas), número de compras, fornecedores e rascunhos;
  - produtos com maior valor comprado e ranking de fornecedores;
  - lista com detalhe: itens, preço por kg / L / un, pedido × recebido, custo médio antes → depois;
  - cancelar com motivo.
- **Nova compra:**
  - **cabeçalho:** fornecedor (cadastro na hora), NF, data da compra, data do recebimento, forma de pagamento, gerar conta + vencimento, frete, desconto e observação;
  - **itens:** busca por nome ou código e local (sugerido pelo departamento);
  - **quantidade:** na unidade do cadastro ou em embalagens × conteúdo;
  - **valor e preço:** valor total cobrado e preço por unidade **comparado ao custo médio atual** (variação %);
  - **pedido:** quantidade e valor pedidos opcionais, com a diferença;
  - "Salvar rascunho" e "Confirmar compra", com resumo do que será gravado.
- **Custo médio:** custo por produto, saldo de referência, data e origem, mais o histórico: último custo de compra, variação contra a compra anterior e cada movimento.
- **Antes da migration** a tela avisa que o banco ainda não foi atualizado e não quebra.
- **Permissão própria** `estoque.purchases` (view, create, confirm, cancel, view_costs). Quem só conta estoque não entra.

### O que NÃO faz

- **Não mexe no saldo do Controle de Estoque** nem nas entradas antigas.
- **Não altera** a tela "Cotações e Compras" nem "Recebimento de Notas".
- **Não calcula CMV.** Isso é a F2.4C: estoque inicial + compras − estoque final, NÃO APURADO se faltar dado.

## 3. Testes

| Suíte | Resultado |
|---|---|
| `app/lib/compras-estoque.test.mjs` (PGlite: F2.1 + SEC-FIN-2 + esta migration) | **46/46** |
| `app/lib/contagem-estoque.test.mjs` com e sem a migration (`F24B=1`) | 53/53 e 53/53 |
| Permissões | ok (comprador × contador) |
| F2.3 | 104/104 |
| Contas a Pagar | 74/74 |
| SEC-EST-1 | 20/20 |
| SEC-FIN-2 | 24/24 |
| Suíte do repositório | 41/42; a falha é a de navegação, que já existia |

**Cenários cobertos:**
- **Seu exemplo:**
  - 20 kg a R$ 45/kg, depois 10 kg por R$ 500, dá **R$ 46,6667/kg**;
  - o histórico mostra antes e depois de cada compra.
- **Conta a pagar:** R$ 900, pendente, categoria `mercadoria_insumos`, origem COMPRA, NF e vencimento.
- **Duplicidade e alteração:**
  - clique duplo não duplica nem a conta nem o custo;
  - a mesma NF do mesmo fornecedor é recusada com aviso;
  - compra confirmada é imutável.
- **Rascunho e custo:**
  - o rascunho é editável e não mexe no custo;
  - o app não escreve no custo direto;
  - frete entra no custo: R$ 50 + R$ 5 sobre 10 kg dá R$ 5,50/kg.
- **Recusas:**
  - desconto maior que o valor;
  - conta sem vencimento;
  - unidade incompatível, sem que nada mude.
- **Cancelamento:**
  - o da última compra volta o custo e cancela a conta;
  - depois disso, a anterior também pode ser cancelada;
  - é recusado se houver compra posterior do mesmo produto ou se a conta tiver pagamento.
- **Inventário:**
  - inventário fechado ajusta o saldo e cria o custo inicial;
  - a compra seguinte usa esse custo: óleo de R$ 9/L com +14 L por R$ 140 dá R$ 9,50/L;
  - inventário fechado **antes** da migration inicializa o custo na aplicação.
- **Acesso:**
  - outra unidade não confirma nem vê;
  - anônimo bloqueado;
  - funções internas inacessíveis.
- **Migration:** a conferência pós-aplicação passa, rodar duas vezes não quebra e o rollback remove o que ela cria.

**Verificação visual:** não foi feita. Não consigo logar no app; a página compila com o compilador do Next.

## 4. Ordem para publicar

1. Aprovar e rodar `db/F2_4B_COMPRAS_CUSTO_MEDIO.sql`.
2. Rodar a conferência que está no fim do arquivo.
3. Publicar a branch.

Se a tela for publicada antes do SQL, ela só mostra o aviso de "banco ainda não atualizado".

## 5. Próximos passos

- **F2.4C, CMV real:**
  - em R$ e em %, por mês e por intervalo entre inventários;
  - receita = vendas − cancelamentos − descontos, nunca o líquido do banco;
  - **NÃO APURADO** com o motivo quando faltar dado;
  - saída física apurada, rankings e médias.
- **Perdas, transferências e ajustes com motivo:** movimentos próprios.
- **Integrar com o Controle de Estoque:** a entrada da compra no saldo operacional, depois de conferir as unidades do controle antigo.
- **SEC-EST-2:** as tabelas legadas com USING true.
- **"Compras do mês" antiga:** marcar como não confiável, ou passar a ler das compras novas.
