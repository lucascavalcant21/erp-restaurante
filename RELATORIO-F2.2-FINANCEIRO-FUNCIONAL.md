# RELATÓRIO F2.2 — FINANCEIRO FUNCIONAL (CONTAS A PAGAR)

Data: 2026-10-01 · Branch `fase-f2-2/financeiro-funcional`
- A branch está sobre `fase-f2-1/fundacao-financeira`, que está sobre `hotfix/fin-cp-1`, que está sobre `origin/main` `b9d76b1`.
- Depende da F2.1, **já aplicada em produção** (verificada pelo diagnóstico pós-migration).

**Sem:**
- SQL em produção;
- migration nova;
- alteração de dados;
- deploy.

Esta branch **não foi enviada** ao GitHub. A única branch enviada nesta etapa foi a `hotfix/fin-cp-1`, antes da mensagem da F2.2 (§10).

## Atualização 01/10/2026: SEC-FIN-1 aplicada, bloqueio de segurança resolvido

- **Auditoria:** as 3 policies antigas de `contas_pagar` liberavam acesso entre unidades (`USING true` / `auth.role() = authenticated`).
- **Correção:** aplicada pelo dono com `db/security/SEC_FIN_1_CONTAS_PAGAR_POR_UNIDADE.sql` (branch `sec/fin-1-contas-pagar-rls`).
  - Antes, a prévia mostrou que 0 dos 16 usuários perderiam acesso.
  - Hoje existe só `contas_pagar_unidade` (`pode_ver_todas() OR unidade_id = auth_unidade_id()`, no USING e no CHECK).
  - As 3 antigas ficaram guardadas em `sec_backup_policies_contas_pagar`.
  - 7 contas visíveis.
- **Ainda pendente:**
  - retirar DELETE/TRUNCATE do `authenticated` (depois da F2.2 no ar);
  - controle por cargo;
  - revisar cerca de 12 usuários ativos com cara de conta de teste.

## Resultado de segurança (auditoria original, antes da SEC-FIN-1)

A auditoria pedida no item 15 precisa do texto real das policies. **Isso só sai do banco.** Deixei a consulta pronta e somente leitura: `db/diagnosticos/F2_2_AUDITORIA_POLICIES_CONTAS_PAGAR.sql`. Ela devolve `USING`, `WITH CHECK`, papéis, tipo e comando de cada policy.

O que já se sabe sem rodar:
- **Do diagnóstico pós-F2.1:** as três policies valem para **todos** os comandos (ALL). Duas delas (`contas_autenticados`, `Acesso Total Contas`) valem para o papel **`public`**, que inclui `anon`.
- **Por que o `anon` está barrado:** não por elas, mas porque a SEC-DADOS-2 tirou os privilégios dele.
- **O que isso significa:** se qualquer uma for `USING (true)` (o padrão dos SQL antigos do repo, `docs/seguranca-rls.sql`), **qualquer usuário logado lê e altera contas de qualquer unidade**. Policies PERMISSIVE se somam: basta uma aberta.
- **Reproduzi isso no teste:** com uma policy `using(true)` em `contas_pagar`, um usuário da unidade "outra" **lê as contas de `seldeestrela` pela view nova**. A view é `security_invoker` e herda o RLS da tabela.
- **O que já está isolado:** as tabelas novas (pagamentos) e as RPCs (pagar, estornar, cancelar). As RPCs checam a unidade e recusam a outra unidade (testado).

**Conclusão:** pela regra do item 15, **não publicar a F2.2** enquanto o resultado de `F2_2_AUDITORIA_POLICIES_CONTAS_PAGAR.sql` não mostrar que nenhuma das três libera acesso entre unidades.
- Se liberar, a correção é da trilha de segurança: trocar as três por uma policy por unidade, como a das tabelas F2.1. Isso fica para você aprovar depois.
- **Não removi nem alterei nenhuma policy.**

**Proposta (não implementada) de controle por função** para registrar pagamento, estornar e cancelar:
- O sistema de permissões já existe em `perfis_acesso` / `usuario_permissoes` (rota `/api/admin/access-control`).
- **Proposta:**
  - criar as permissões `financeiro.pagamento.registrar`, `financeiro.pagamento.estornar` e `financeiro.conta.cancelar`;
  - checá-las **dentro** das RPCs (servidor), com uma função `security definer` que lê o perfil do `auth.uid()`;
  - esconder os botões na tela pela mesma permissão (o botão é só conveniência; quem decide é o banco).
- **Pré-requisito:** confirmar em produção quais tabelas de permissão estão aplicadas (`perfis_acesso` e `usuario_permissoes` existem? as funções `hefisto_user_has_permission` estão aplicadas?).
- Fica para uma fase de segurança própria. Não improvisei cargo no código.

---

## 1. O que mudou para o usuário

**Contas a Pagar (`/dashboard/financeiro/contas`)**, reescrita sobre a F2.1:
- **Nova conta:**
  - campos: fornecedor (opcional), descrição, categoria (do plano `fin_categorias`, agrupada), centro de custo, valor, **competência** (mês), vencimento, documento, observação;
  - **parcelamento:** N contas 1/N…N/N, mensais, mesmo grupo;
  - **recorrente** (marcação).
- **Edição:**
  - grava **só os campos alterados**;
  - nunca mexe em pagamento nem em situação;
  - o valor fica travado se já houve pagamento.
- **Pagamento** (pela RPC `fin_registrar_pagamento`):
  - data real, valor (parcial ou integral), juros, multa, desconto, forma, conta financeira, observação;
  - a tela mostra o saldo antes e depois, e se a conta fica PARCIAL ou PAGA.
- **Estorno** (`fin_estornar_pagamento`) e **cancelamento** (`fin_cancelar_conta_pagar`):
  - com motivo obrigatório;
  - nada é apagado e o histórico continua visível.
- **Detalhe da conta:**
  - valor original, pago, saldo, saída de caixa;
  - fornecedor, categoria (marca "lida do lançamento antigo" quando inferida), centro de custo, competência (marca "inferida"), vencimento, documento, parcela, origem, observação;
  - quem criou e quando; última alteração;
  - **cada pagamento:** data, valor, juros/multa/desconto, saída, forma, conta, quem registrou e quando;
  - **estornos:** quem, quando, motivo.
- **Filtros:**
  - período: todo, hoje, semana, mês, personalizado;
  - **por vencimento ou por competência**;
  - situação: pendente, parcial, pago, vencido, cancelado;
  - categoria, centro de custo, fornecedor, busca.
- **Resumo no topo** (não é DRE):
  - "A pagar (em aberto)", "Vencido" e "Próximos 7 dias": saldos por vencimento;
  - "Pago no período (caixa)": saídas dos pagamentos no período, sinalizando quando inclui pagamento antigo sem histórico.
- **Recorrentes:**
  - botão explícito: escolhe a competência, mostra o que será criado e gera;
  - **nunca ao abrir a tela**;
  - o índice único do banco impede duplicar.

**Contas antigas:** aparecem pela view, sem reescrita.
- As 2 pagas: **"Pago antigo"**, sem botão de pagar ou cancelar, sem pagamento fictício. O detalhe explica que não há histórico.
- As pendentes/vencidas recebem pagamento normalmente.

**Hub do Financeiro (`/dashboard/financeiro`):**
- "Adicionar" leva ao formulário completo de Contas a Pagar.
- "Registrar pagamento" abre o mesmo modal (RPC).
- A lixeira virou **"Cancelar conta" com motivo**, só para pendentes. O delete foi removido.
- Contas canceladas saem dos totais do hub.
- **Uma implementação só:** o modal antigo de "Nova despesa" do hub foi removido.

**RH e Manutenção:** usam a mesma camada.

| Fluxo | Categoria | Competência | Origem | Chave de idempotência |
|---|---|---|---|---|
| Lançar folha (aba RH) | `pessoal_salarios` | mês | `FOLHA` | por colaborador + mês |
| Fechamento de folha (`rh.js`) | `pessoal_salarios` | mês da folha | `FOLHA` | por colaborador + mês; lote tudo-ou-nada |
| Salário individual | `pessoal_salarios` | mês | `RH` | — |
| Desmembramento de extra | Diária → `pessoal_extras`; INSS/FGTS → `pessoal_encargos`; Taxa → `pessoal_taxa_servico` | mês | `RH` | — |
| Manutenção | `manutencao` | data do serviço | `MANUTENCAO` | pelo serviço: finalizar de novo não duplica conta nem pagamento |

Na Manutenção declarada paga, o pagamento é feito **pela RPC** na data do serviço.

## 2. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `app/lib/contas-pagar.mjs` | Camada definitiva (detalhe abaixo). Substitui o contrato mínimo do hotfix |
| `app/lib/financeiro.js` | `fetchContasPagar` / `fetchContaPagar` (view), `fetchReferenciasContas`, `fetchPagamentosDaConta`, `fetchPagamentosPeriodo`, `usuarioAtualId`, `salvarConta`, `lancarConta`, `lancarContasEmLote`, `pagarConta`, `estornarPagamento`, `cancelarContaPagar`, `gerarContasRecorrentes`. **`removerConta` (delete) removida.** `fetchContas` antiga mantida para os leitores atuais (hub, relatórios, copiloto) |
| `app/components/ModalPagamentoConta.js` | Modal único de pagamento: parcial, juros, multa, desconto, forma, conta financeira, observação; chave de idempotência por abertura |
| `app/dashboard/financeiro/contas/page.js` | Tela reescrita (§1) |
| `app/dashboard/financeiro/page.js` | Hub: nova conta → formulário completo; pagar → modal/RPC; excluir → cancelar com motivo; cancelados fora dos totais |
| `app/dashboard/rh/page.js`, `app/lib/rh.js` | Categoria, competência, origem e chaves |
| `app/lib/manutencao.js` | Categoria, competência, origem, chave por serviço, pagamento por RPC |
| `app/lib/contas-pagar.test.mjs` | 69 testes de ponta a ponta contra o SQL real da F2.1 (§4) |
| `db/diagnosticos/F2_2_AUDITORIA_POLICIES_CONTAS_PAGAR.sql` | Auditoria das policies, só leitura |
| `RELATORIO-F2.2-FINANCEIRO-FUNCIONAL.md` | Este relatório |

**`app/lib/contas-pagar.mjs` contém:**
- validação;
- criação com idempotência e parcelamento;
- edição por diferença;
- pagamento, estorno e cancelamento por RPC;
- lote;
- lançamento de módulos externos;
- recorrência sob demanda;
- período e resumo;
- categorias agrupadas e compatibilidade com o texto antigo.

**Telas alteradas:** Contas a Pagar, hub do Financeiro, RH (lançamentos para o financeiro), Manutenção (via lib). Nenhuma de mesa, KDS, iFood, Saipos, estoque, compras ou receber.

## 3. Arquitetura usada (F2.1, sem migration nova)

| Ação | Mecanismo |
|---|---|
| Ler contas | `vw_fin_contas_pagar` (saldo, situação, competência/categoria efetivas, pagamento antigo) |
| Criar / editar | `contas_pagar` (colunas F2.1); `chave_idempotencia` única por unidade |
| Pagar | RPC `fin_registrar_pagamento` |
| Estornar | RPC `fin_estornar_pagamento` |
| Cancelar | RPC `fin_cancelar_conta_pagar` |
| Histórico | `fin_pagamentos` (inclui estornados) |
| Referências | `fin_categorias`, `fin_centros_custo`, `fornecedores` (cruzado no app, sem embed), `fin_contas_financeiras` |
| Recorrência | `recorrencia_origem_id` + `competencia` (índice único) |
| Parcelas | `grupo_parcelas_id`, `parcela_numero`, `parcelas_total`; chave `form:N` por parcela |

**Compatibilidade:**
- Conta nova grava `categoria_codigo` (plano novo) **e** o texto antigo correspondente em `categoria` (ex.: energia → `custo_fixo`). Hub, DRE e relatórios atuais continuam lendo até migrarem.
- A conta antiga mantém o texto dela intacto.

**A partir daqui o pagamento NÃO usa mais `status='pago'` + data.** O teste estático confirma que nenhum arquivo do fluxo grava `status: 'pago'`.

## 4. Testes

`PGLITE=<caminho> node app/lib/contas-pagar.test.mjs` → **69/69**.

A camada roda contra o **SQL real da F2.1** num Postgres em memória (PGlite), com papel `authenticated`, `auth.uid()`, RLS e um adaptador no formato do supabase-js. As contas "antigas" são sintéticas.

| Pedido | Resultado |
|---|---|
| Criar conta | Pendente; valor 5.000; competência set ≠ vencimento out; categoria, centro, fornecedor e documento gravados; texto compatível `custo_fixo`; `criado_por` registrado |
| Editar | Grava só o que mudou; situação intacta. Na conta antiga, só a descrição: categoria e competência continuam inferidas (não preenchidas) |
| Pagamento parcial | 2.000 de 5.000 → PARCIAL, saldo 3.000 |
| Segundo pagamento | 3.000 → PAGO, saldo 0 |
| Pagamento integral | Conta de 199,90 → PAGO |
| Juros, multa, desconto | 3.000 + 40 + 20 − 10 → saída total 5.050 e valor original 5.000 preservado; desconto maior que o pago → recusado |
| Estorno | Sem motivo → recusado. Com motivo → volta a PARCIAL; os 2 pagamentos continuam no histórico, o estornado com motivo e autor |
| Cancelamento | Com pagamento → recusado; sem motivo → recusado; com motivo → CANCELADO e a conta continua existindo |
| Conta antiga | Paga = "Pago antigo", sem pagar/cancelar, RPC recusa, **0 pagamentos fictícios**. Pendente recebe pagamento parcial. As não tocadas ficam idênticas |
| Competência | Separada do vencimento e do pagamento (energia set → venc. out → pago hoje) |
| Categoria | Mercadoria e "legado" recusados em conta nova; agrupamento por grupo |
| Centro de custo | Inexistente → erro do banco e nada criado (FK) |
| Fornecedor | Com e sem fornecedor |
| Parcelamento | 3.000/3 → 3 contas 1/3..3/3 de 1.000, vencimentos mensais, mesmo grupo; 1.000,01/3 → 333,33 + 333,33 + 333,35; dia 31 → fim do mês |
| Retry | Criação, parcelamento, pagamento e manutenção com a mesma chave → idempotente, sem duplicar |
| Duplo clique | Duas criações simultâneas → 1 conta. Dois pagamentos simultâneos da mesma tela → 1 pagamento (o outro idempotente) |
| Isolamento | Outra unidade não vê pagamentos, não paga, não estorna, não cancela. **Achado:** pela policy antiga de `contas_pagar`, ela **lê** as contas (ver topo) |
| Erro do banco | Criar, pagar, estornar e cancelar devolvem o erro e `data` nula: nunca sucesso |
| Recorrência | Gera out/26 com vencimento em nov (mesma distância do modelo); pedir de novo não planeja nada; forçando, o banco não duplica |
| Folha / módulos | Lote com valor zero bloqueia tudo, citando quem; Manutenção paga = conta + pagamento por RPC, sem duplicar ao finalizar de novo |
| Estáticos | Abrir a tela não gera recorrentes; nenhum delete em `contas_pagar`; nenhum `status 'pago'` gravado direto; nenhum UUID falso |

**Outros resultados:**
- **Suíte do repositório:** 38/39 arquivos. A falha é `navegacao.test.mjs`, que já falha na `main`.
- **`scripts/test_f2_1_fundacao_financeira.mjs`:** 67/67.
- **Compilação local (`next dev`):** `/dashboard/financeiro/contas`, `/dashboard/financeiro`, `/dashboard/rh`, `/dashboard/gestao/manutencao` e `/dashboard/rh/fechamento` dão HTTP 200, sem erro no servidor. No navegador, sem credenciais, a tela para no guard de autenticação. O único erro no console é a falta da configuração do Supabase.
- **Validação visual / screenshots: não foi possível.** Eu não faço login. A conferência visual com seus dados precisa do seu login (preview local ou prévia da Vercel, quando você liberar).
- **Build:** não rodado localmente (regra do repositório). A prévia da Vercel do **hotfix** compilou com sucesso; a da F2.2 não foi gerada.

## 5. Limitações

- **Quem realizou:**
  - mostra "você" quando é o próprio usuário;
  - para outro usuário, só os 8 primeiros caracteres do id: `usuarios_erp` não é legível pelo navegador (só pelo servidor).
  - Mostrar nomes exige uma rota de servidor, fora desta etapa.
- **Contas financeiras:** não há tela de cadastro. O campo no pagamento fica "Nenhuma cadastrada" até existir uma (com saldo inicial real). O cadastro fica para a etapa de caixa.
- **Conta "pago antigo":** não tem estorno. Não há pagamento registrado para estornar, e criar um seria inventar histórico.
- **Leitores antigos sem migração:**
  - o hub ainda soma "pago" só pelo status persistido `pago`;
  - DRE, relatórios e copiloto continuam lendo `contas_pagar` pelo texto antigo de categoria.
  - Migrar essas leituras para a view é da etapa de DRE/indicadores, que ficou fora do escopo.
- **Gravações fora da camada, por escopo:**
  - perdas de etiqueta → `contas_pagar` pago (F4);
  - "Baixa CMV" do PDV na `main` (a F1 remove).
- **Branch da F1:** continua separada e precisa ser rebaseada sobre esta linha. O F1.1 (confiabilidade) não está nesta base. Os cards do topo usam o rótulo "calculado das contas registradas no Héfisto"; não é a camada F1.1.
- **Fuso:** competência e vencimento usam o dia local do navegador; o banco usa America/Sao_Paulo para "hoje".
- **Lançamento de folha da aba RH** ainda deduplica também pela descrição (comportamento anterior), além da chave.

## 6. RPCs utilizadas

- `fin_registrar_pagamento(p_conta_pagar_id, p_pago_em, p_valor_principal, p_juros, p_multa, p_desconto, p_forma_pagamento, p_conta_financeira_id, p_observacao, p_chave_idempotencia)`
- `fin_estornar_pagamento(p_pagamento_id, p_motivo)`
- `fin_cancelar_conta_pagar(p_conta_pagar_id, p_motivo)`

## 7. Ordem de publicação sugerida (nada feito)

1. Rodar `F2_2_AUDITORIA_POLICIES_CONTAS_PAGAR.sql`. **Se alguma policy liberar acesso entre unidades:** aprovar a correção de RLS de `contas_pagar` (trilha de segurança) antes de publicar.
2. Hotfix → produção, se ainda quiser publicar antes da F2.2. Ele é seguro com a F2.1 aplicada.
3. F2.2 → prévia da Vercel → conferência visual com seu login → produção.

## 8. Branches

| Branch | Commit | Estado |
|---|---|---|
| `hotfix/fin-cp-1` | `837c96e` (rebaseado sobre `origin/main`) | **Enviado ao GitHub antes da mensagem da F2.2.** A Vercel gerou só a prévia, com build OK. Não está em produção |
| `fase-f2-1/fundacao-financeira` | — | SQL e plano da F2.1, local |
| `fase-f2-2/financeiro-funcional` | — | Esta entrega, local, sem push |

**Parado aqui.** Sem deploy, sem SQL executado, sem migration.
