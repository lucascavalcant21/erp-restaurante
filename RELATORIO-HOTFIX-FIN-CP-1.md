# HOTFIX FIN-CP-1 — RESTAURAR CONTAS A PAGAR

Data: 2026-10-01 · Branch `hotfix/fin-cp-1`, criada a partir da `main` `3c53bec` (o que está em produção), para poder ser publicada sem depender da F1.

**Sem:**
- migration, coluna nova ou tabela nova;
- alteração nas 7 contas históricas;
- push e deploy.

**Fora do escopo, intocados:** Saipos/iFood, CMV/DRE, mesa, KDS.

## 1. Contrato mínimo

Toda escrita em `contas_pagar` destes fluxos passa por **uma única camada**: `app/lib/contas-pagar.mjs`. Ela usa só as colunas reais:

`id, unidade_id, descricao, valor, data_vencimento, data_pagamento, categoria, status, created_at, updated_at, recorrente`

| Ação | O que grava | Proteções |
|---|---|---|
| Criar | `unidade_id, descricao, valor, data_vencimento, categoria, recorrente`, `status='pendente'`, `data_pagamento=null` | Bloqueia:<br>• descrição vazia;<br>• valor ≤ 0;<br>• vencimento vazio/inválido;<br>• unidade vazia, `todas` ou o UUID falso;<br>• categoria `cmv`.<br>Insert com `select("id")`: sem id de volta = erro. |
| Editar | `descricao, valor, data_vencimento, categoria, recorrente, updated_at` | **Nunca** envia `status`/`data_pagamento`. Filtra por `id` **e** `unidade_id`. Nenhuma linha afetada = erro. |
| Marcar como paga | `status='pago'`, `data_pagamento=<data real>`, `updated_at` | A tela pede a data, sem permitir data futura. O update filtra "ainda não paga" (`not status in (pago, paga, Pago, Paga, PAGO, PAGA)`).<br>Um segundo envio (clique duplo, duas abas) **não altera nada** e devolve erro. |
| Estornar | `status='pendente'`, `data_pagamento=null`, `updated_at` | Só altera conta paga. A conta não é apagada. Não grava movimentação. |
| Lote (fechamento de folha) | Igual a "criar", numa única gravação | Tudo ou nada: um item inválido bloqueia o lote, e o erro cita o item. |

**Não grava** `valor_pago`, `saldo`, `juros`, `multa`, `desconto` nem `forma_pagamento`: as colunas não existem. A tela também deixou de pedir esses dados.

**Status:**
- Novas gravações usam só `pendente` e `pago`.
- A leitura tolera `PENDENTE`, `PAGO`, `PAGA` e `paga`.
- **"Vencida" é derivada** (pendente com vencimento passado). Não é gravada.

## 2. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `app/lib/contas-pagar.mjs` (novo) | Camada única: validação, criar, editar, pagar, estornar, lote, lançamento com pagamento declarado; categorias; status/situação |
| `app/lib/contas-pagar.test.mjs` (novo) | 64 verificações (§4) |
| `app/components/ModalPagamentoConta.js` (novo) | Modal único de pagamento (data real), usado pelas duas telas |
| `app/lib/financeiro.js` | Ver detalhe abaixo |
| `app/dashboard/financeiro/contas/page.js` | Ver detalhe abaixo |
| `app/dashboard/financeiro/page.js` (hub) | Ver detalhe abaixo |
| `app/dashboard/rh/page.js` | 3 lançamentos (folha da aba RH, salário, desmembramento de extra) pela camada única; mostram as falhas |
| `app/lib/rh.js` | `fecharFolhaMensal` grava pelo lote da camada única |
| `app/lib/manutencao.js` + `app/dashboard/gestao/manutencao/page.js` | Pela camada única; a tela avisa quando a conta ou o pagamento não foram gravados |
| `app/lib/estoque.js` | `registrarCompra` explicitamente indisponível (§7) |

**`app/lib/financeiro.js`:**
- `fetchContas` lê com `select("*")`. O embed `fornecedor:fornecedores(...)` saiu: sem `fornecedor_id` ele derrubava a consulta inteira.
- `salvarConta`, `pagarConta` e `estornarPagamento` delegam à camada única.
- `lancarConta` é nova.
- `gerarContasRecorrentes` foi desativada.
- `fetchHistoricoPagamentos` devolve vazio (não existe histórico).
- `removerConta` confirma a exclusão.
- `CATEGORIAS_CUSTO` passa a vir da camada única (+ `manutencao`).

**`app/dashboard/financeiro/contas/page.js`** (reescrita no contrato mínimo):
- lista com situação, data de pagamento e as ações editar, pagar e estornar;
- aviso de recorrência indisponível;
- erro de leitura visível;
- trava contra clique duplo;
- não chama mais nada ao abrir.

**`app/dashboard/financeiro/page.js` (hub):**
- "Nova despesa" envia só os campos do contrato e não oferece `cmv`;
- "Marcar como paga" abre o modal de data;
- trava contra clique duplo;
- lê o status com tolerância a legado.

**Também nesta entrega:** `RELATORIO-HOTFIX-FIN-CP-1.md` (este arquivo).

**Branch da F1:** commit `1be79ce` aplica a mesma correção do `registrarCompra` (§7).

## 3. Fluxos corrigidos

| Fluxo | Antes (produção desde 23/09) | Agora |
|---|---|---|
| Listar contas (`/financeiro/contas`, hub, relatórios, copiloto, RH) | Provável lista vazia: embed de fornecedor sem FK | `select("*")` só com colunas reais |
| Criar conta (Contas e hub) | Falhava: 15 colunas inexistentes | Cria `pendente` |
| Editar conta | Falhava. A tela de Contas nem tinha botão de editar | Botão Editar; não toca no pagamento |
| Marcar como paga | Falhava: RPC inexistente e colunas inexistentes | `pago` + data real |
| Estornar | Falhava: RPC e tabela inexistentes | `pendente` + data nula, por conta |
| Abrir a tela de Contas | Tentava gerar recorrentes (insert) a cada abertura | Só leitura |
| Mensagens | O estorno e algumas criações mostravam sucesso sem checar | Sucesso só depois de o banco confirmar a linha afetada |

## 4. Testes executados

`node app/lib/contas-pagar.test.mjs`: **64/64 ok**.

O banco falso em memória **recusa coluna que não existe** no schema real, como o PostgREST faz. Assim, qualquer volta de `valor_pago`/`saldo` quebraria o teste.

| Cenário pedido | Resultado |
|---|---|
| Criar conta válida | `pendente`, `data_pagamento` nula, exatamente 8 colunas enviadas |
| Valor zero (e negativo, descrição vazia, vencimento vazio, unidade vazia ou `todas`) | Bloqueado, **nenhuma chamada ao banco** |
| Marcar pendente como paga | `pago` + data informada; data futura recusada; payload sem `valor_pago`/`saldo`/`juros`/`forma` |
| Estornar | `pendente` + data nula; conta continua existindo; estornar uma pendente dá erro; aceita `PAGA` legado |
| Editar conta paga | Descrição e valor mudam; continua `pago` com a mesma data; payload sem `status`/`data_pagamento` |
| Editar em outra unidade | Erro (nenhuma linha afetada) |
| Falha do Supabase | Erro repassado, `data` nula. Nunca sucesso |
| Update sem linha afetada (id errado / RLS) | Erro |
| Abrir tela | A tela não chama `gerarContasRecorrentes`, e a função não tem `.from`/`.insert` |
| Clique duplo | Duas chamadas simultâneas de pagamento: **exatamente uma** tem efeito. Na interface, um `useRef` impede a segunda chamada e os botões ficam desabilitados |
| Unidade | O UUID falso é recusado; `seldeestrela` é aceita; nenhum arquivo do fluxo contém o UUID falso |
| CMV | Não é oferecido nem aceito em conta nova. A conta histórica `cmv` pode ser editada mantendo a categoria. Trocar **para** `cmv` é bloqueado |
| Lote da folha | Um item com valor 0 bloqueia o lote inteiro, citando o nome; lote válido grava tudo `pendente` |
| Manutenção declarada paga | Insert `pendente` e depois update `pago` na data do serviço |

**Suíte do repositório:** 38 de 39 arquivos de teste passam. A única falha é `app/lib/navegacao.test.mjs`, que **já falha na `main`**, sem relação com o hotfix.

**Compilação:** `next dev` local compilou `/dashboard/financeiro/contas`, `/dashboard/financeiro`, `/dashboard/rh` e `/dashboard/gestao/manutencao` (HTTP 200, sem erro no servidor). No navegador, sem credenciais, a tela para no guard de autenticação. O único erro no console é a ausência da configuração do Supabase, que é esperada.

**Não verificado:**
- uso real com login e banco de produção;
- build de produção (regra do repositório: sem build local).

## 5. Recorrência

- **Geração automática desativada.** `gerarContasRecorrentes` não grava nada e a tela não a chama.
- A tela mostra o aviso "temporariamente indisponível: lance cada mês manualmente".
- O campo `recorrente` continua sendo gravado, como **marcação**.
- **Por quê:** sem uma chave de recorrência no banco (conta-origem + mês), recriar no cliente pode duplicar contas, já que duas abas abertas geram duas. Volta na F2 com idempotência no banco.

## 6. RH e Manutenção

| Fluxo | Decisão |
|---|---|
| RH › Fechamento de folha (`rh.js fecharFolhaMensal`) | Adaptado. Lote único, `pendente`, `cmo`. **Mudança:** um colaborador com valor líquido 0 ou inválido agora **bloqueia o lote** e o erro diz quem (antes gravaria conta de R$ 0). |
| RH › Lançar folha do mês (aba RH) | Adaptado. `pendente`, `cmo`. Agora informa quais **não** foram lançadas (antes falhava em silêncio). |
| RH › Lançar salário individual | Adaptado, **com mudança de comportamento**: antes gravava a conta já `pago` com a data de hoje, sem perguntar se foi pago. Agora entra `pendente`, e o pagamento é registrado em Contas a Pagar com a data real. |
| RH › Desmembramento de extra (Diária/INSS/FGTS/Taxa) | Adaptado igual: `pendente`, falhas informadas. **Risco registrado, não alterado:** o desmembramento usa percentuais fixos no código (INSS 5%, FGTS 8%, taxa 10% do total). É regra de RH e fica para a trilha de RH. |
| Manutenção › Finalizar serviço | Adaptado. A conta nasce `pendente`, `manutencao`. Se o serviço declara forma de pagamento diferente de "A pagar", o pagamento é registrado **na data do serviço**, numa segunda operação verificada. A tela avisa se a conta ou o pagamento falharam. Antes, falha na conta passava calada. |

Nenhum fluxo precisou ser bloqueado: todos cabem no contrato mínimo.

`manutencao` entrou na lista de categorias. Ela era usada pela Manutenção e não aparecia em lugar nenhum.

**Gravações em `contas_pagar` que continuam fora da camada única, por decisão de escopo:**
- **Perda por etiqueta** (`etiquetas.js`, `etiqueta-financeiro.js`, `api/etiquetas/financeiro/drenar`): estoque → financeiro, tratado na F4.
- **"Baixa CMV" do PDV** (`vendas.js`, na `main`): o pedido diz não mexer em CMV. A branch da F1 já remove.
- **Gerador de dados fictícios** (`mock.js`): sem botão na tela.

## 7. `registrarCompra`

- **Decisão:** fica **explicitamente indisponível**. Devolve erro e não grava nada, nem estoque nem conta.
- **Por quê:**
  - a versão da `main` lançava compra como **`cmv`** e mexia só no saldo legado;
  - a da F1 gravava colunas inexistentes;
  - compra correta exige compra + itens + entrada no razão + conta ligada, e nada disso cabe no schema atual.
- **Impacto: nenhum.** A função não tem chamador.
- **Onde foi aplicado:**
  - no hotfix;
  - na branch da F1 (commit `1be79ce`), com texto idêntico, o que fecha a regressão antes do merge.
- Testes da F1 após a correção: integração 11/11, sem nova falha.

## 8. Limitações temporárias (até a F2)

- **Pagamento só integral.** Não há parcial, juros, multa, desconto, forma nem conta de origem. A tela avisa isso.
- **Sem histórico de pagamentos.** Uma conta = um pagamento, em `status` + `data_pagamento`.
  - O estorno apaga a data do pagamento estornado. A trilha fica só em `updated_at`.
  - Não há registro de **quem** pagou ou estornou.
- **Sem campos fora do schema atual:** fornecedor, nº de documento, competência, centro de custo, observação, anexo e parcelamento. Para parcelar, lance cada parcela como conta.
- **Recorrência automática desligada.**
- **Excluir conta** (hub do Financeiro) continua sendo exclusão física. Não foi pedido mexer; registrado para a F2 (cancelamento por status).
- **Datas.** Data de pagamento e de vencimento usam o dia local do navegador.
- **Idempotência.** Fora o "só paga se ainda não está paga", não há chave de idempotência no banco (não criar constraint neste hotfix). Dois envios de **criação** idênticos geram duas contas se escaparem da trava da tela.

## 9. Branches e merge

- **`hotfix/fin-cp-1`:** commit local, sem push. Parte da `main` e é independente da F1.
- **`fase-f1/saneamento-financeiro`** também mexe em `financeiro.js` (`pagarConta`, leitura) e nas telas do financeiro. **Ordem recomendada:**
  1. hotfix;
  2. rebase da F1 sobre ele, resolvendo os conflitos em `financeiro.js` e `financeiro/page.js` a favor do contrato mínimo do hotfix.

  Eu faço esse rebase quando você autorizar.
- O worktree do hotfix usa uma junção de `node_modules`. Antes de remover o worktree: `cmd /c rmdir` na junção.

**O hotfix termina aqui.** Sem SQL, sem push, sem deploy. A F2.1 (SQL + plano, sem executar) é entregue em separado, na sua ordem: hotfix primeiro.
