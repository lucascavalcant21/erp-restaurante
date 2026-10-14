# Auditoria de integração: Marmitaria × Financeiro × Estoque × RH × iFood (14/10/2026)

**Contexto:** decisão do dono de 14/10. Restaurante Seldeestrela, Marmitaria e Eventos são **três negócios separados**, cada um com unidade própria, com transferência controlada entre eles e visão consolidada da empresa.

**Fontes:** código do branch `claude/marmitaria-unidade-propria` e banco real (só leitura, 14/10).

## Situação em produção (14/10, TESTADO NO SUPABASE REAL)

| Item | Estado |
|---|---|
| Unidades | 1 (`seldeestrela`), empresa "Hefisto". Marmitaria e Eventos ainda dentro dela |
| Marmitaria | 1 ficha de teste ("Ggghh"), 0 lotes, 0 estoques próprios, 0 vendas, 0 movimentos |
| Eventos | 2 eventos e 12 tabelas `evento_*`, todos na unidade do restaurante |
| iFood | Cofre OK; 0 conexões; webhook não cadastrado no portal; `CRON_SECRET` ausente (`/api/ifood/poll` responde 503) |
| RH | `rh_config_trabalhista` vazio: o INSS patronal do CMO usa o padrão da configuração |
| Fornecedores | 0 cadastrados |

## Achados

| # | Gravidade | Achado | Situação |
|---|---|---|---|
| A1 | **CRÍTICA** | **B-018:** a marmitaria convertia o saldo de kg/L ×1000. Produção, transferência e baixa do iFood moveriam 1000× a quantidade, e o custo do CMV sairia 1000× menor. Nenhum dano: nada foi usado ainda | Corrigido no **PR #173** (pequeno, só código). Recomendo publicar antes de ativar o estoque da marmitaria |
| A2 | ALTA | O CMV do restaurante (inventário + compras − inventário) não considerava transferência entre unidades: o que fosse enviado à marmitaria viraria "consumo" do restaurante | Corrigido no #172 (`cmv-real.mjs` + `cmv-dados.mjs`). O histórico não muda: nunca houve transferência entre unidades |
| A3 | MÉDIA | **Dois modelos de isolamento.** Marmitaria, iFood, fichas, insumos e RH usam `hefisto_unidades_do_usuario()` (várias unidades). 16 tabelas centrais usam `pode_ver_todas()` ou `auth_unidade_id()` (só a unidade principal): `estoque_itens`, `estoque_lotes`, `estoque_movimentacoes_multi`, `estoque_custos(_historico)`, `estoque_contagens(_itens)`, `compras(_itens)`, `contas_pagar`, `fin_contas_financeiras`, `fin_contas_receber`, `fin_faturamento_diario`, `fin_pagamentos`, `fin_recebimentos`, `fin_taxas_meio_pagamento`. **Não vaza** (é mais restritivo), mas quem trabalha em dois negócios vê o estoque e o financeiro de um só | Pendente: decisão do dono. Correção = trocar as policies por `hefisto_unidades_do_usuario()` (mudança de RLS em produção, exige aprovação) |
| A4 | MÉDIA | Cadastro de unidade quebrado: criar sempre falhava (id obrigatório sem padrão) e editar loja falhava calado (campos de GPS inexistentes) — **B-017** | Corrigido no #172. O GPS da loja continua sem onde ser guardado |
| A5 | MÉDIA | Ativar o iFood exige: cadastrar o iFood **na unidade Marmitaria** (a conexão é por unidade), cadastrar o webhook no portal e criar `CRON_SECRET` + agendamento para o polling de segurança | Dono (BLQ-013/014) |
| A6 | BAIXA | **Fornecedores** e **contas financeiras** (bancos/caixas) são por unidade: a marmitaria precisa dos dela. Não há cópia automática de fornecedor | Cadastrar na unidade nova. Sugestão futura: "trazer fornecedor de outra unidade", como as fichas |
| A7 | BAIXA | Na unidade nova, a configuração trabalhista (`rh_config_trabalhista`) começa vazia; o CMO usa os encargos da marmitaria (FGTS e provisões legais; INSS patronal pela configuração) | Preencher em RH → Configuração da unidade nova |
| A8 | INFO | Eventos é negócio separado, mas continua dentro da unidade do restaurante (2 eventos). Separar = criar a unidade "Eventos" (a tela agora funciona) e decidir se os 2 eventos mudam de unidade (mexe em dado histórico, exige decisão) | Decisão do dono |

## Integração conferida (o que está certo)

| Fluxo | Como fica com unidades separadas | Evidência |
|---|---|---|
| **Estoque** | Cada unidade tem estoques, lotes, saldos e custo médio próprios. A transferência entre unidades (UNID-MARM-1) sai ao custo médio da origem e entra como compra no destino, em transação única e com chave idempotente. Exige mesma empresa e permissão nas duas unidades | 22 casos com SQL real (custo pelas funções reais da F2.1/F2.4B): TESTADO LOCAL |
| **CMV** | Marmitaria: estoque inicial + compras + transferências recebidas − enviadas − estoque final dos estoques dela (na unidade própria, todos os da unidade). Restaurante: o mesmo, agora com transferências | 5 testes novos + testes antigos do CMV: TESTADO LOCAL |
| **Fichas e pré-preparos** | Cada unidade tem o próprio cadastro (RLS). "Trazer de outra unidade" reaproveita o que já existe (mesmo nome e unidade de medida) e cria só o que falta, com conflito visível | 4 testes: TESTADO EM MOCK |
| **RH e CMO** | A equipe da unidade da marmitaria entra 100% automaticamente. Pessoa de outra unidade entra como **cedida**: conta no CMO gerencial da marmitaria, mas o salário fica na origem | Testes do CMO: TESTADO EM MOCK |
| **Financeiro e DRE** | DRE exclusivo da marmitaria: todas as contas da unidade dela, sem rateio. A aba "Empresa" mostra o DRE de cada unidade lado a lado e o total, sem duplicar pessoa cedida nem transferência | Teste do `dreEmpresa`: TESTADO EM MOCK |
| **iFood** | Pedidos entram em `marmitaria_vendas` (fonte `ifood`) e `delivery_pedidos` da unidade conectada. Só observa (a Saipos não é tocada). A baixa por pedido usa `estoque_movimentar` com o usuário logado | #171 em produção. Ensaio no banco real (transação desfeita): TESTADO NO SUPABASE REAL |
| **Saipos** | Nenhuma integração em produção. Nada foi alterado | Leitura do código e do banco |
| **Histórico financeiro** | Nenhum dado financeiro ou de estoque existente foi modificado | Migrações aditivas; CMV sem transferência = resultado idêntico |

## Recomendações, em ordem

1. Merge do **#173** (B-018), antes de qualquer uso do estoque da marmitaria.
2. Aprovar a **APR-008** (UNID-MARM-1: transferência entre unidades) e fazer o merge do **#172**.
3. Criar as unidades "Marmitaria" (e "Eventos", quando decidir) em Configurações → Unidades; dar acesso aos usuários; marcar "Esta unidade é só da marmitaria".
4. Decidir sobre o **A3**: unificar o isolamento das 16 tabelas em `hefisto_unidades_do_usuario()`. Posso preparar e testar a migração.
5. iFood na unidade Marmitaria: credenciais, webhook e `CRON_SECRET`.
