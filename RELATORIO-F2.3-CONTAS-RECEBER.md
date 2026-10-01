# RELATÓRIO F2.3 — CONTAS A RECEBER, RECEBIMENTOS E CARTÕES

Data: 2026-10-01 · Branch `fase-f2-3/contas-receber`, a partir de `main` `518bf57` (produção atual).

**Sem:**
- migration;
- SQL executado;
- deploy.

**Contas a Pagar (F2.2) não foi reestruturado.** Só o teste do menu foi atualizado.

## ⚠ Antes do deploy

Rodar `db/diagnosticos/F2_3_AUDITORIA_RECEBER.sql` (somente leitura, um resultado) e devolver o resultado.

**O que ele confere em produção:**
- colunas reais;
- RLS;
- **todas** as policies, com USING/CHECK;
- privilégios de anon e authenticated;
- views `security_invoker`;
- RPCs: dono, definer, quem executa e se checam a unidade.

**Esperado** (é o que o mesmo SQL devolve no banco simulado com a F2.1 real):
- uma policy por tabela, `*_unidade_f21`, com `pode_ver_todas() OR unidade_id = auth_unidade_id()` no USING **e** no CHECK;
- anon sem nenhum privilégio;
- `fin_recebimentos`: só SELECT para authenticated;
- RPCs de recebimento com `definer=true`, `anon=false` e checagem de unidade `true`.

**Se aparecer qualquer policy `USING true` ou sem unidade: PARAR antes do deploy** (a lição de `contas_pagar`).

## 1. Estrutura encontrada (F2.1, aplicada em produção em 01/10)

A F2.1 foi aplicada pelo arquivo `db/F2_1_FUNDACAO_FINANCEIRA.sql` desta mesma linha. O diagnóstico pós-migration confirmou:
- 13 tabelas;
- RLS em todas;
- 13 policies;
- anon sem acesso;
- dono das RPCs com BYPASSRLS.

**O que ainda não foi conferido:** as colunas exatas destas 4 tabelas em produção. A auditoria acima fecha isso antes do deploy.

| Necessidade da F2.3 | Na F2.1? | Como foi usado |
|---|---|---|
| Recebível com bruto, taxa e líquido | ✅ `fin_contas_receber`: `valor_bruto`, `valor_taxa_previsto`, `valor_liquido_previsto` (gerado) | Taxa nula = "não informada", e o líquido previsto fica nulo |
| Datas: venda (competência), previsão, recebimento real | ✅ `data_venda`, `data_prevista`; `fin_recebimentos.recebido_em` | — |
| Forma canônica | ✅ CHECK do banco: dinheiro, pix, debito, credito, voucher, boleto, transferencia, delivery_marketplace, outro | Código canônico + rótulo amigável (`MEIOS`) |
| Cartão: adquirente, bandeira, modalidade, parcelas, NSU, autorização | ✅ | — |
| Recebimento parcial e histórico | ✅ RPC `fin_registrar_recebimento` (bruto baixado × líquido creditado; taxa efetiva gerada) | — |
| Estorno sem DELETE | ✅ RPC `fin_estornar_recebimento` (motivo, quem, quando; imutável) | — |
| Idempotência no banco | ✅ `chave_idempotencia` única por unidade (recebível e recebimento); `(origem_tipo, origem_id, parcela)` único | Chave nasce quando o formulário ou modal abre |
| Taxas cadastráveis, nenhuma inventada | ✅ `fin_taxas_meio_pagamento` (vazia) | Cadastro/encerramento na tela Caixa e Contas |
| Contas financeiras + saldo | ✅ `fin_contas_financeiras` (saldo inicial obrigatório) + `vw_fin_saldo_contas_financeiras` | Saldo gerencial = inicial + recebimentos − pagamentos |
| Fluxo realizado × previsto | ✅ `vw_fin_fluxo_caixa` | Tela Caixa e Contas |
| Parcelamento da venda × do recebimento | ✅ N recebíveis ligados por `origem_id`, ou 1 consolidado | — |
| **Cliente** | ❌ não há coluna | Não exibido. Pode ir na descrição/observação (texto livre), sem fingir cadastro |
| **Categoria de receita** | ❌ `fin_categorias` só tem despesas/naturezas de custo; `fin_contas_receber` não tem categoria | A origem (MANUAL/VENDA/…) faz o papel de classificação por enquanto |
| **Centro de custo** | ❌ não há coluna em `fin_contas_receber` | — |
| **Cancelamento por RPC** | ❌ não há `fin_cancelar_conta_receber` | Update guardado (§4) |
| **Acréscimo/juros recebidos** | ❌ a RPC exige líquido ≤ bruto baixado | Não suportado; a tela avisa |
| **Desconto ao cliente ≠ taxa** | ❌ `valor_taxa_efetiva` = bruto − líquido (tudo vira "taxa") | Limitação registrada |

### O que falta no banco (NÃO criei SQL, como pedido)

Proposta para aprovação, aditiva, nos mesmos moldes da F2.1:
1. `fin_contas_receber`: colunas `cliente_nome text`, `categoria_codigo text` e `centro_custo_codigo text → fin_centros_custo`.
2. Categorias de **receita**: ampliar o CHECK de `fin_categorias.grupo/natureza` (ex.: grupo `RECEITA`, natureza `receita_operacional` / `receita_nao_operacional`) e semear algumas categorias (vendas salão/delivery, eventos, aluguel, serviços, outras). **Exige alterar os CHECKs** da F2.1.
3. RPC `fin_cancelar_conta_receber(id, motivo)`, que só cancela sem recebimento ativo, e um trigger que impeça mudar `valor_bruto`/taxa/`status` fora das RPCs. Hoje o `authenticated` pode dar UPDATE direto em `fin_contas_receber` da própria unidade, igual a `contas_pagar`.
4. Opcional: `valor_acrescimo` e `valor_desconto` em `fin_recebimentos`, para separar juros recebidos, desconto concedido e taxa do adquirente.

Nada disso bloqueia o que foi implementado. Fica para sua decisão.

## 2. Telas

| Rota | O quê |
|---|---|
| `/dashboard/financeiro/receber` (**nova**) | Contas a Receber (§3) |
| `/dashboard/financeiro/caixa` (**nova**) | Caixa e Contas: **Fluxo de caixa** (realizado × previsto), **Contas financeiras** (saldo gerencial, cadastro, ativar/desativar), **Taxas** (cadastro, encerramento) |
| `/dashboard/financeiro` (Central) | Bloco **Posição financeira** no topo (§6). O bloco antigo que somava o **extrato** (`lancamentos`) virou "Movimento do extrato — Parcial, não é DRE". Cálculo inalterado, só o nome honesto. "Fluxo de Caixa" nas ações rápidas → Caixa e Contas |
| Menu Financeiro | Visão Geral · Contas a Pagar · **Contas a Receber** · **Caixa e Contas** · DRE Gerencial |
| `/dashboard/vendas` ("Vendas e Recebimentos") | **Substituída** por redirecionamento para Contas a Receber |
| `/dashboard/financeiro/recebiveis`, `/conciliacao` | Telas antigas, sem link, **substituídas** por redirecionamento |

**Decisão sobre "Vendas e Recebimentos" (item 16):** substituir, não reaproveitar. A tela antiga:
- gravava `valor_liquido`, coluna que não existe;
- usava `user_metadata` com fallback para a unidade falsa `00000000-…-0001`;
- listava `vendas` sem filtro de unidade;
- tratava o pagamento como "venda".

Reaproveitar exigiria reescrever tudo. Deixá-la mostraria números incompatíveis. A rota continua viva como redirecionamento (links salvos, perfil "caixa").

## 3. Contas a Receber — como funciona

**Nova receita (sempre ORIGEM: MANUAL, indicado no formulário):**
- descrição, forma, valor bruto, data da venda/origem (competência), previsão, conta financeira prevista;
- cartão/plataforma: adquirente, bandeira, modalidade, parcelas da venda, NSU, autorização;
- **como o dinheiro entra:** 1 recebível consolidado ou N recebíveis (um por parcela, mês a mês);
- **taxa:**
  - *não informada* (padrão): líquido "não apurado";
  - *pelo cadastro*: usa a regra mais específica e vigente; se não houver, **recusa** em vez de assumir;
  - *informar valor*.
- A tela mostra bruto − taxa = líquido previsto. Com regra cadastrada, sugere a previsão (D+N).

**Lista:**
- cartões legíveis no celular: situação, descrição, origem, forma, adquirente, datas, bruto, líquido previsto ou "taxa não informada", saldo;
- filtros: período (hoje, semana, mês, personalizado) **por previsão ou por data da venda**, situação, forma, busca;
- a URL aceita `?situacao=` e `?periodo=`.

**Situações:** pendente (`previsto`), parcial, recebido, cancelado. **Atrasado** é derivado da previsão; o status gravado não muda só porque venceu.

**Detalhe:**
- resumo no topo: bruto, taxa prevista, líquido previsto, bruto baixado, líquido recebido, saldo;
- seção recolhível com os detalhes;
- **histórico de recebimentos:** data, líquido, bruto baixado, taxa efetiva, conta, referência, quem, quando; estornos com quem, quando e motivo;
- botões no rodapé fixo: Registrar recebimento, Editar, Cancelar.

**Recebimento** (modal, RPC):
- data real (não futura), bruto baixado (padrão: saldo), líquido que entrou, conta financeira;
- referência de conciliação e observação ficam recolhidas;
- mostra a taxa efetiva e se a conta fica parcial ou recebida.

**Estorno:** RPC, com motivo obrigatório. A conta volta ao saldo anterior e o registro fica visível como ESTORNADO.

**Cancelamento:** só sem recebimento ativo, com motivo. Sem RPC na F2.1, então é um update que só vale se o status gravado ainda for `previsto`; o CHECK do banco exige data e motivo. Nada é apagado.

**Edição:**
- grava só o que mudou;
- bruto e taxa travados depois de haver recebimento;
- nunca mexe em status.

## 4. Bruto / taxa / líquido (a regra fundamental)

| Conceito | Onde | Data |
|---|---|---|
| **Receita bruta** | `fin_contas_receber.valor_bruto` | `data_venda` (competência) |
| **Taxa prevista** | `valor_taxa_previsto` (regra cadastrada ou informada; nula = não informada) | — |
| **Líquido previsto** | `valor_liquido_previsto` = bruto − taxa (nulo se a taxa é nula) | `data_prevista` |
| **Entrada real** | `fin_recebimentos.valor_liquido_recebido` | `recebido_em` (caixa) |
| **Taxa efetiva** | `valor_taxa_efetiva` = bruto baixado − líquido | `recebido_em` |

Exemplo testado: venda R$ 100 no crédito Visa/Stone, regra 3% D+30.
- Taxa R$ 3, líquido previsto R$ 97, previsão 30/10.
- No recebimento: bruto baixado R$ 100, líquido R$ 97, taxa efetiva R$ 3.
- **O fluxo de caixa registra R$ 97. A receita lançada continua R$ 100.**

## 5. Contas financeiras e fluxo de caixa

- **Conta financeira:** o saldo inicial é obrigatório e informado (pode ser 0,00, se for a verdade), com data.
  - Saldo inicial e data não mudam depois. Só nome e ativa/inativa.
  - **Saldo gerencial** = saldo inicial + recebimentos − pagamentos ligados à conta, depois da data inicial.
  - Testado: 0 + 97 − 40 = **57**.
  - Rotulado "não é saldo conciliado do banco".
- **Fluxo de caixa:** pela **data do movimento financeiro**.
  - **Realizado:** entradas, saídas e saldo do período.
  - **Previsto:** a receber líquido e a pagar do período.
  - Os dois **nunca são somados**.
  - Pagamentos antigos sem histórico aparecem sinalizados.
  - O extrato antigo (`lancamentos` do PDV) **não entra**: o realizado mostra só o financeiro novo. Está avisado na tela.

## 6. Central Financeira

Novo bloco **Posição financeira** (visão completa):

| Card | Origem |
|---|---|
| A pagar (em aberto), vencido, próximos 7 dias | `vw_fin_contas_pagar` |
| A receber (bruto), atrasado, próximos 7 dias | `vw_fin_contas_receber` |
| Entradas / saídas / saldo do mês (caixa) | `vw_fin_fluxo_caixa` (realizado) |
| Saldo gerencial | `vw_fin_saldo_contas_financeiras`, ou "Não apurado" sem contas cadastradas |
| **Faturamento** | **Não apurado** (não há fonte completa de vendas) |

DRE e CMV não foram tocados.

## 7. RPCs e acesso usados

| Ação | Mecanismo |
|---|---|
| Criar/editar recebível | `fin_contas_receber` (insert/update com RLS por unidade) |
| Receber | RPC `fin_registrar_recebimento` |
| Estornar | RPC `fin_estornar_recebimento` |
| Cancelar | Update guardado (`status = 'previsto'` → `cancelado`, data, motivo) |
| Taxas | `fin_taxas_meio_pagamento` (insert; encerrar = `ativa=false` + `vigente_ate`) |
| Contas financeiras | `fin_contas_financeiras` (insert; update de nome/ativa) |
| Leituras | `vw_fin_contas_receber` + campos de detalhe de `fin_contas_receber`, `fin_recebimentos`, `vw_fin_saldo_contas_financeiras`, `vw_fin_fluxo_caixa` |

**Auditoria de cada recebimento:**
- quem registrou (`criado_por`) e quando (`created_at`);
- data efetiva, bruto, líquido, taxa e conta;
- origem (via conta a receber);
- estorno: quem, quando, motivo.

## 8. Autorização por cargo (documentado, não implementado)

Ações que vão precisar de permissão própria na fase de autorização financeira:
- registrar recebimento;
- estornar recebimento;
- cancelar conta a receber;
- criar/editar conta a receber;
- cadastrar/encerrar taxas;
- criar/editar/desativar contas financeiras.

**Como fazer:** checagem dentro das RPCs (servidor) e RPCs também para cancelar, taxas e contas financeiras. Hoje qualquer usuário ativo da unidade consegue tudo isso, igual a Contas a Pagar.

## 9. Testes

`PGLITE=<caminho> node app/lib/contas-receber.test.mjs` → **69/69**. A camada roda contra o SQL real da F2.1 em PGlite, com RLS, `auth.uid()` e papel `authenticated`.

| Pedido | Resultado |
|---|---|
| Conta R$ 1.000 → receber 400 | PARCIAL, recebido 400, saldo 600 |
| Receber 600 | RECEBIDO, recebido 1.000, saldo 0 |
| Estornar 600 | PARCIAL, saldo 600. Os 2 recebimentos continuam no histórico; o estornado com motivo e autor; não estorna duas vezes |
| Recebimento com taxa / bruto ≠ líquido | 100 → taxa 3 → líquido 97, taxa efetiva 3 |
| Taxa pelo cadastro | Regra específica vence a genérica; sem regra → recusado (não inventa); taxa encerrada não vale |
| Juros/acréscimos | Líquido > bruto → recusado (não suportado pela estrutura) |
| PIX, dinheiro, débito, crédito, voucher, boleto, transferência, delivery, outros | Aceitos (códigos canônicos); "cheque" → recusado |
| Conta financeira | Sem saldo inicial → recusada; nome repetido → recusado; saldo gerencial 0 + 97 − 40 = 57; desativar |
| Data prevista × efetiva | Previsão antes da venda → recusada; data futura → recusada; data efetiva gravada |
| Parcelamento | 300 em 3x → 3 recebíveis de 100 (taxa 3 cada), mês a mês, mesma origem. Consolidado → 1 de 300, registrando "venda em 3x" |
| Receita × dinheiro | Receita lançada no dia = bruto (700); recebido no dia = líquido 497 (bruto 500, taxas 3); a receber líquido "não apurado" com taxa desconhecida |
| Fluxo | Realizado (entradas 497, saídas 40) separado do previsto |
| Cancelamento | Sem motivo → recusado; sem recebimento → CANCELADO e continua existindo; com recebimento → recusado; cancelada não recebe |
| Edição | Só o que mudou; bruto travado após recebimento |
| Retry / duplo clique | Criação com a mesma chave → idempotente; dois recebimentos simultâneos → 1 registro (o outro idempotente) |
| Erro de banco | Criar, receber, estornar e cancelar → erro, nunca sucesso |
| Isolamento | Outra unidade não vê recebíveis, recebimentos, contas financeiras nem taxas; não recebe, estorna, cria nem cancela na unidade alheia; app não grava recebimento direto; anon sem acesso |
| Estáticos | Telas antigas redirecionam; sem UUID falso; nenhum percentual de taxa no código; faturamento "Não apurado" na Central; abrir a tela não grava nada |

**Outros resultados:**
- **Contas a Pagar:** `contas-pagar.test.mjs` 74/74.
- **Suíte:** 39/40. A falha é `navegacao.test.mjs`, a mesma de antes (link antigo de eventos).
- **Imports:** todos os nomes importados das bibliotecas alteradas existem.
- **Compilação local (`next dev`):** `/dashboard/financeiro/receber`, `/caixa`, `/financeiro`, `/contas`, `/vendas`, `/recebiveis` e `/conciliacao` dão HTTP 200, sem erro no servidor.
- **Não verificado:**
  - visual com login (eu não faço login);
  - build de produção (é feito na Vercel no deploy).

## 10. Limitações

- **Sem cliente, categoria de receita e centro de custo** em recebíveis (§1, depende de migration aprovada).
- **Cancelamento sem RPC:** a integridade depende do status gravado. O `authenticated` ainda pode dar UPDATE direto em `fin_contas_receber` da própria unidade (§1, item 3).
- **Acréscimos e descontos** de recebimento não são separados da taxa.
- **Venda parcelada consolidada:** o número de parcelas da venda vai para a observação (não há coluna).
- **Vendas do PDV/Saipos/iFood não geram recebíveis automaticamente** (fase de integração). A tela diz isso quando está vazia.
- **"Quem":** mostra "você" ou o início do id. Nomes exigem rota de servidor.
- **Transferências** entre contas financeiras e **conciliação bancária** não existem ainda.
- **Extrato antigo (`lancamentos`)** fora do fluxo novo.

## 11. Arquivos

**Novos:**
- `app/lib/contas-receber.mjs`;
- `app/lib/contas-receber.test.mjs`;
- `app/lib/teste-banco-f21.mjs` (apoio de teste: PGlite + adaptador);
- `app/components/ModalRecebimentoConta.js`;
- `app/components/navigation/PosicaoFinanceira.js`;
- `app/dashboard/financeiro/receber/page.js`;
- `app/dashboard/financeiro/caixa/page.js`;
- `db/diagnosticos/F2_3_AUDITORIA_RECEBER.sql`;
- `RELATORIO-F2.3-CONTAS-RECEBER.md`.

**Alterados:**
- `app/lib/financeiro.js` (acessos F2.3);
- `app/components/layout/TopNavigation.js` (menu);
- `app/components/navigation/FinanceiroHub.js` (Posição financeira, rótulos do extrato, atalho de fluxo);
- `app/dashboard/vendas/page.js`, `app/dashboard/financeiro/recebiveis/page.js`, `app/dashboard/financeiro/conciliacao/page.js` (redirecionamento);
- `app/lib/contas-pagar.test.mjs` (menu).

**Parado aqui.** Sem SQL novo, sem migration, sem deploy.
