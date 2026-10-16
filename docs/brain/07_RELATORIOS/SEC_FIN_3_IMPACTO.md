# SEC-FIN-3 · impacto da correção do S-20 (14/10/2026)

Migração: `db/security/SEC_FIN_3_PERMISSAO_FINANCEIRA.sql` · rollback: `SEC_FIN_3_ROLLBACK.sql` · teste: `app/lib/seguranca-fin-3.test.mjs`

## O que estava exposto (TESTADO NO SUPABASE REAL, só leitura e transação desfeita)

| Exposição | Evidência |
|---|---|
| Usuário sem permissão financeira **lia** contas a pagar e contas bancárias pela API | Ensaio como usuário comum: leu 8 contas a pagar e 1 conta bancária |
| Mesma situação em recebimentos, pagamentos, faturamento, taxas de cartão, gastos administrativos, vendas e repasses da marmitaria, cadastro de extras (**chave PIX**), recibos de diárias e consumo de funcionários | As policies dessas 13 tabelas conferiam só a unidade |
| **Qualquer usuário da unidade podia PAGAR, CANCELAR e ESTORNAR** pelas RPCs `fin_registrar_pagamento`, `fin_registrar_recebimento`, `fin_cancelar_conta_pagar`, `fin_estornar_pagamento` e `fin_estornar_recebimento` | As funções são SECURITY DEFINER e conferiam só a unidade (`fin_pode_acessar_unidade`) |
| Usuário mudar o próprio perfil, virar super admin ou se dar permissão | **Não**: o banco recusou (0 linhas alteradas; inserção bloqueada pelo RLS), TESTADO NO SUPABASE REAL |

## O que muda

- **Leitura:** exige a chave do módulo **e** a unidade (mantida como hoje). Negar por padrão.
- **Escrita direta:** exige chave de criar/editar/excluir/aprovar do módulo.
- **RPCs:** registrar exige `financeiro.cashflow.create|edit|approve`; cancelar e estornar exigem `financeiro.cashflow.delete|approve`.
- **Super admin:** mantém a visão consolidada.
- **Exceções e validade:** valem as permissões próprias, NEGAR vence, e acesso vencido ou bloqueado fica sem nada (é a mesma função `hefisto_user_has_permission` das telas).

| Dado | Quem lê (basta uma chave) |
|---|---|
| Contas a pagar | `financeiro.cashflow.view`, `financeiro.dre.view`, `marmitaria.financial.view` |
| Bancos, receber, pagamentos, recebimentos, taxas | `financeiro.cashflow.view` |
| Faturamento diário | `financeiro.cashflow.view`, `financeiro.dre.view`, `dashboard.overview.view_values` (igual ao mapa da inteligência) |
| Vendas e repasses da marmitaria | `financeiro.cashflow.view`, `financeiro.dre.view`, `marmitaria.financial.view`, `marmitaria.overview.view_values` |
| Gastos administrativos | `rh.admin_expenses.view`, `financeiro.cashflow.view`, `financeiro.dre.view` |
| Cadastro de extras (PIX) | `rh.extras.view`, `rh.recruiting.view` |
| Recibos de diárias | `rh.extras.view`, `rh.payroll.view(_values)`, `rh.overview.view_values`, `financeiro.cashflow.view`, `financeiro.dre.view` |
| Consumo de funcionários | `rh.employees.view`, `rh.payroll.view` |

## Impacto em produção (calculado pela própria função de permissão do banco, 14/10)

| Grupo de dados | Mantêm | Perdem | Perfis que perdem |
|---|---|---|---|
| Os 10 grupos acima (leitura e RPCs) | **3** (super admin + 2 gerente-geral) | **13** | somente-consulta (11), cozinheiro (2) |

Nenhum dos 13 tem permissão de **tela** de financeiro ou RH. Eles perdem só a leitura indevida pela API, não um fluxo de trabalho. **Nenhum funcionário legítimo fica bloqueado.**

Efeitos visíveis:

| Onde | Quem | Efeito |
|---|---|---|
| Relatórios gerenciais | somente-consulta | A parte de contas a pagar fica vazia (era o vazamento) |
| CMV do estoque | quem tem `estoque.cmv.view` mas não financeiro | O CMV % fica "sem faturamento" (o faturamento é dado financeiro). Hoje nenhum usuário está nesse caso |
| `fetchReposicaoMes` (estoque) | quem não é do financeiro | O total de reposição lido de contas a pagar fica 0. A função não tem chamador nas telas atuais |
| Painel inicial, Central de Comando | — | Já consultavam só com a permissão; agora o banco confirma |
| iFood, etiquetas, portais públicos | — | Rodam no servidor (service_role): sem mudança |

## Validação

| O quê | Resultado | Onde |
|---|---|---|
| SQL real (F2.1 + SEC-FIN-2 + F2.4C + SEC-FIN-3 + rollback). 9 perfis (super, gerente, cozinheiro, consulta, caixa, NEGAR, vencido, marmitaria, RH) × 13 tabelas × leitura e escrita direta × 5 RPCs × unidade cruzada × anônimo; rollback devolve o comportamento antigo | passa | TESTADO LOCAL (PGlite) |
| Preflight: aborta se alguma policy ou função não estiver como em produção (hash do texto das RPCs) | passa | TESTADO LOCAL |
| `test:seguranca` 25/25 · `app/lib` 479/479 · `test:agent` 62/62 | verdes | TESTADO LOCAL |
| Impacto por usuário | 13 perdem, 0 legítimos | TESTADO NO SUPABASE REAL (só leitura) |
