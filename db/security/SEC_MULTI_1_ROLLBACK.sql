/* SEC-MULTI-1 · ROLLBACK — volta as 16 policies ao padrão F2.1
   (super admin OU unidade principal). Não rodar sem decisão do dono. */

begin;

drop policy compras_unidade_f21 on public.compras;
create policy compras_unidade_f21 on public.compras for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy compras_itens_unidade_f21 on public.compras_itens;
create policy compras_itens_unidade_f21 on public.compras_itens for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy contas_pagar_unidade on public.contas_pagar;
create policy contas_pagar_unidade on public.contas_pagar for all to authenticated
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

drop policy fin_contas_financeiras_unidade_f21 on public.fin_contas_financeiras;
create policy fin_contas_financeiras_unidade_f21 on public.fin_contas_financeiras for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy fin_contas_receber_unidade_f21 on public.fin_contas_receber;
create policy fin_contas_receber_unidade_f21 on public.fin_contas_receber for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy fin_faturamento_diario_unidade on public.fin_faturamento_diario;
create policy fin_faturamento_diario_unidade on public.fin_faturamento_diario for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy fin_pagamentos_unidade_f21 on public.fin_pagamentos;
create policy fin_pagamentos_unidade_f21 on public.fin_pagamentos for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy fin_recebimentos_unidade_f21 on public.fin_recebimentos;
create policy fin_recebimentos_unidade_f21 on public.fin_recebimentos for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

drop policy fin_taxas_meio_pagamento_unidade_f21 on public.fin_taxas_meio_pagamento;
create policy fin_taxas_meio_pagamento_unidade_f21 on public.fin_taxas_meio_pagamento for all to authenticated
  using (pode_ver_todas() or (unidade_id = auth_unidade_id()))
  with check (pode_ver_todas() or (unidade_id = auth_unidade_id()));

commit;
