/* SEC-MULTI-1 · ROLLBACK — estoque e compras voltam ao padrão F2.1 (super admin
   OU unidade principal); as 7 financeiras voltam EXATAMENTE ao estado da
   SEC-FIN-3 (unidade principal + chave do módulo). Não rodar sem decisão do dono. */

begin;

drop policy compras_unidade_f21 on public.compras;
create policy compras_unidade_f21 on public.compras for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy compras_itens_unidade_f21 on public.compras_itens;
create policy compras_itens_unidade_f21 on public.compras_itens for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy estoque_contagens_unidade_f21 on public.estoque_contagens;
create policy estoque_contagens_unidade_f21 on public.estoque_contagens for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy estoque_contagens_itens_unidade_f21 on public.estoque_contagens_itens;
create policy estoque_contagens_itens_unidade_f21 on public.estoque_contagens_itens for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy estoque_custos_unidade_f21 on public.estoque_custos;
create policy estoque_custos_unidade_f21 on public.estoque_custos for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy estoque_custos_historico_unidade on public.estoque_custos_historico;
create policy estoque_custos_historico_unidade on public.estoque_custos_historico for select to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy estoque_itens_unidade on public.estoque_itens;
create policy estoque_itens_unidade on public.estoque_itens for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy estoque_lotes_unidade on public.estoque_lotes;
create policy estoque_lotes_unidade on public.estoque_lotes for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy estoque_mov_ler_unidade on public.estoque_movimentacoes_multi;
create policy estoque_mov_ler_unidade on public.estoque_movimentacoes_multi for select to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()));

-- financeiro: de volta ao estado da SEC-FIN-3
drop policy contas_pagar_ler on public.contas_pagar;
drop policy contas_pagar_incluir on public.contas_pagar;
drop policy contas_pagar_alterar on public.contas_pagar;
drop policy contas_pagar_excluir on public.contas_pagar;
create policy contas_pagar_ler on public.contas_pagar for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'marmitaria.financial.view']))));
create policy contas_pagar_incluir on public.contas_pagar for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy contas_pagar_alterar on public.contas_pagar for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy contas_pagar_excluir on public.contas_pagar for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_contas_financeiras_ler on public.fin_contas_financeiras;
drop policy fin_contas_financeiras_incluir on public.fin_contas_financeiras;
drop policy fin_contas_financeiras_alterar on public.fin_contas_financeiras;
drop policy fin_contas_financeiras_excluir on public.fin_contas_financeiras;
create policy fin_contas_financeiras_ler on public.fin_contas_financeiras for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_contas_financeiras_incluir on public.fin_contas_financeiras for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_financeiras_alterar on public.fin_contas_financeiras for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_financeiras_excluir on public.fin_contas_financeiras for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_contas_receber_ler on public.fin_contas_receber;
drop policy fin_contas_receber_incluir on public.fin_contas_receber;
drop policy fin_contas_receber_alterar on public.fin_contas_receber;
drop policy fin_contas_receber_excluir on public.fin_contas_receber;
create policy fin_contas_receber_ler on public.fin_contas_receber for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_contas_receber_incluir on public.fin_contas_receber for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_receber_alterar on public.fin_contas_receber for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_receber_excluir on public.fin_contas_receber for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_faturamento_diario_ler on public.fin_faturamento_diario;
drop policy fin_faturamento_diario_incluir on public.fin_faturamento_diario;
drop policy fin_faturamento_diario_alterar on public.fin_faturamento_diario;
drop policy fin_faturamento_diario_excluir on public.fin_faturamento_diario;
create policy fin_faturamento_diario_ler on public.fin_faturamento_diario for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'dashboard.overview.view_values']))));
create policy fin_faturamento_diario_incluir on public.fin_faturamento_diario for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));
create policy fin_faturamento_diario_alterar on public.fin_faturamento_diario for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));
create policy fin_faturamento_diario_excluir on public.fin_faturamento_diario for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));

drop policy fin_pagamentos_ler on public.fin_pagamentos;
drop policy fin_pagamentos_incluir on public.fin_pagamentos;
drop policy fin_pagamentos_alterar on public.fin_pagamentos;
drop policy fin_pagamentos_excluir on public.fin_pagamentos;
create policy fin_pagamentos_ler on public.fin_pagamentos for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_pagamentos_incluir on public.fin_pagamentos for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_pagamentos_alterar on public.fin_pagamentos for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_pagamentos_excluir on public.fin_pagamentos for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_recebimentos_ler on public.fin_recebimentos;
drop policy fin_recebimentos_incluir on public.fin_recebimentos;
drop policy fin_recebimentos_alterar on public.fin_recebimentos;
drop policy fin_recebimentos_excluir on public.fin_recebimentos;
create policy fin_recebimentos_ler on public.fin_recebimentos for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_recebimentos_incluir on public.fin_recebimentos for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_recebimentos_alterar on public.fin_recebimentos for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_recebimentos_excluir on public.fin_recebimentos for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_taxas_meio_pagamento_ler on public.fin_taxas_meio_pagamento;
drop policy fin_taxas_meio_pagamento_incluir on public.fin_taxas_meio_pagamento;
drop policy fin_taxas_meio_pagamento_alterar on public.fin_taxas_meio_pagamento;
drop policy fin_taxas_meio_pagamento_excluir on public.fin_taxas_meio_pagamento;
create policy fin_taxas_meio_pagamento_ler on public.fin_taxas_meio_pagamento for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_taxas_meio_pagamento_incluir on public.fin_taxas_meio_pagamento for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_taxas_meio_pagamento_alterar on public.fin_taxas_meio_pagamento for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_taxas_meio_pagamento_excluir on public.fin_taxas_meio_pagamento for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

commit;
