/* ═══════════════════════════════════════════════════════════════════════════
   SEC-FIN-3 · dado financeiro só para quem tem permissão financeira (S-20)
   (14/10/2026)

   POR QUE (medido em produção, só leitura)
   - As policies das tabelas financeiras conferiam só a UNIDADE: 13 de 15
     usuários comuns (perfis somente-consulta e cozinheiro) liam contas a
     pagar, contas bancárias, recebimentos e faturamento pela API — as telas
     é que escondiam. Ensaio no banco real: um usuário sem permissão
     financeira leu 8 contas a pagar e 1 conta bancária.
   - As funções que GRAVAM no financeiro (registrar/estornar pagamento e
     recebimento, cancelar conta) são SECURITY DEFINER e também conferiam só a
     unidade: qualquer usuário da unidade podia pagar, cancelar ou estornar
     chamando a RPC.
   - Mesmo problema em dados de RH com valor e dado bancário: cadastro de
     extras (chave PIX), recibos de diárias, consumo de funcionários, gastos
     administrativos; e na marmitaria: vendas (comissões, repasse) e repasses
     do iFood.

   O QUE FAZ (só policies e funções; nenhum dado é alterado)
   1. hefisto_tem_alguma(chaves[]): o usuário logado tem ao menos uma das
      chaves? Usa hefisto_user_has_permission (perfil + permissões próprias,
      NEGAR vence, validade, horário e bloqueio). Negar por padrão.
   2. 13 tabelas: a policy única "para tudo" vira quatro (ler, incluir,
      alterar, excluir). A condição de UNIDADE de cada uma é mantida como está
      (F2.1: unidade principal; sec_unidade: unidades concedidas) e passa a
      exigir também a chave do módulo — leitura e escrita separadas. Super
      admin continua vendo tudo (visão consolidada).
      As chaves são as do catálogo (app/lib/permissions-catalog.mjs) e as do
      mapa da inteligência (app/lib/intelligence/permissions/mapa.mjs): tela,
      servidor e banco decidem igual.
   3. As 5 RPCs financeiras: o MESMO texto do F2.1 (conferido por hash no
      preflight) com a checagem da permissão da AÇÃO depois da checagem de
      unidade: registrar = criar/editar/aprovar; cancelar/estornar =
      excluir/aprovar.

   O QUE NÃO MUDA
   - Privilégios de tabela (SEC-FIN-2), dados, históricos, colunas.
   - Funções do servidor (service_role: iFood, etiquetas, portais públicos).
   - compras_confirmar e as funções de compra (conferem estoque.purchases.*).

   IMPACTO (perfis em produção, 14/10): ver docs/brain/07_RELATORIOS/SEC_FIN_3_IMPACTO.md

   ROLLBACK: db/security/SEC_FIN_3_ROLLBACK.sql (volta as policies e as
   funções exatamente como estão hoje; testado).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- ── 0. Preflight: aborta sem mudar nada se o estado não for o de hoje ────────
do $pf$
declare r record; v_f21 constant text := '(pode_ver_todas() OR (unidade_id = auth_unidade_id()))'; v_sec constant text := '(( SELECT hefisto_ve_todas_unidades() AS hefisto_ve_todas_unidades) OR (unidade_id IN ( SELECT unnest(hefisto_unidades_do_usuario()) AS unnest)))';
begin
  for r in select * from (values
      ('contas_pagar', 'contas_pagar_unidade', v_f21),
      ('fin_contas_financeiras', 'fin_contas_financeiras_unidade_f21', v_f21),
      ('fin_contas_receber', 'fin_contas_receber_unidade_f21', v_f21),
      ('fin_pagamentos', 'fin_pagamentos_unidade_f21', v_f21),
      ('fin_recebimentos', 'fin_recebimentos_unidade_f21', v_f21),
      ('fin_taxas_meio_pagamento', 'fin_taxas_meio_pagamento_unidade_f21', v_f21),
      ('fin_faturamento_diario', 'fin_faturamento_diario_unidade', v_f21),
      ('gastos_administrativos', 'sec_unidade', v_sec),
      ('marmitaria_vendas', 'sec_unidade', v_sec),
      ('delivery_repasses', 'sec_unidade_ler', v_sec),
      ('extras_cadastros', 'sec_unidade', v_sec),
      ('rh_recibos_prestacao', 'sec_unidade', v_sec),
      ('rh_consumo_funcionarios', 'sec_unidade', v_sec)) v(t, p, q) loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.t and policyname = r.p and qual = r.q) then
      raise exception 'SEC-FIN-3: a policy % de % não está como esperado. Nada foi alterado.', r.p, r.t;
    end if;
  end loop;
  for r in select * from (values
      ('fin_cancelar_conta_pagar', 'bb3ecee6504a753778b0729e4fe1619a'),
      ('fin_estornar_pagamento', 'a9532b780486a77491a592b3acd715bc'),
      ('fin_estornar_recebimento', '72a3b8696f98005d009b504401d95a48'),
      ('fin_registrar_pagamento', '15778f12f3d2ae332a7d9a133c8e82ce'),
      ('fin_registrar_recebimento', '0069ff9c641281cb852bf41447389380')) v(f, h) loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = r.f and md5(regexp_replace(p.prosrc, '\s', '', 'g')) = r.h) then
      raise exception 'SEC-FIN-3: a função % não é a do F2.1. Nada foi alterado.', r.f;
    end if;
  end loop;
end $pf$;

-- ── 1. Verificador de permissão (nega por padrão) ────────────────────────────
create or replace function public.hefisto_tem_alguma(p_chaves text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from unnest(coalesce(p_chaves, '{}'::text[])) k where public.hefisto_user_has_permission(auth.uid(), k))
$$;
revoke all on function public.hefisto_tem_alguma(text[]) from public, anon;
grant execute on function public.hefisto_tem_alguma(text[]) to authenticated;

-- ── 2. Policies: unidade (como hoje) E permissão do módulo ───────────────────
-- contas_pagar: leitura financeiro.cashflow.view | financeiro.dre.view | marmitaria.financial.view; escrita financeiro.cashflow.create | financeiro.cashflow.edit | financeiro.cashflow.delete | financeiro.cashflow.approve
drop policy contas_pagar_unidade on public.contas_pagar;
create policy contas_pagar_ler on public.contas_pagar for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'marmitaria.financial.view']))));
create policy contas_pagar_incluir on public.contas_pagar for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy contas_pagar_alterar on public.contas_pagar for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy contas_pagar_excluir on public.contas_pagar for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

-- fin_contas_financeiras: leitura financeiro.cashflow.view; escrita financeiro.cashflow.create | financeiro.cashflow.edit | financeiro.cashflow.delete | financeiro.cashflow.approve
drop policy fin_contas_financeiras_unidade_f21 on public.fin_contas_financeiras;
create policy fin_contas_financeiras_ler on public.fin_contas_financeiras for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_contas_financeiras_incluir on public.fin_contas_financeiras for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_financeiras_alterar on public.fin_contas_financeiras for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_financeiras_excluir on public.fin_contas_financeiras for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

-- fin_contas_receber: leitura financeiro.cashflow.view; escrita financeiro.cashflow.create | financeiro.cashflow.edit | financeiro.cashflow.delete | financeiro.cashflow.approve
drop policy fin_contas_receber_unidade_f21 on public.fin_contas_receber;
create policy fin_contas_receber_ler on public.fin_contas_receber for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_contas_receber_incluir on public.fin_contas_receber for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_receber_alterar on public.fin_contas_receber for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_receber_excluir on public.fin_contas_receber for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

-- fin_pagamentos: leitura financeiro.cashflow.view; escrita financeiro.cashflow.create | financeiro.cashflow.edit | financeiro.cashflow.delete | financeiro.cashflow.approve
drop policy fin_pagamentos_unidade_f21 on public.fin_pagamentos;
create policy fin_pagamentos_ler on public.fin_pagamentos for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_pagamentos_incluir on public.fin_pagamentos for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_pagamentos_alterar on public.fin_pagamentos for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_pagamentos_excluir on public.fin_pagamentos for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

-- fin_recebimentos: leitura financeiro.cashflow.view; escrita financeiro.cashflow.create | financeiro.cashflow.edit | financeiro.cashflow.delete | financeiro.cashflow.approve
drop policy fin_recebimentos_unidade_f21 on public.fin_recebimentos;
create policy fin_recebimentos_ler on public.fin_recebimentos for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_recebimentos_incluir on public.fin_recebimentos for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_recebimentos_alterar on public.fin_recebimentos for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_recebimentos_excluir on public.fin_recebimentos for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

-- fin_taxas_meio_pagamento: leitura financeiro.cashflow.view; escrita financeiro.cashflow.create | financeiro.cashflow.edit | financeiro.cashflow.delete | financeiro.cashflow.approve
drop policy fin_taxas_meio_pagamento_unidade_f21 on public.fin_taxas_meio_pagamento;
create policy fin_taxas_meio_pagamento_ler on public.fin_taxas_meio_pagamento for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_taxas_meio_pagamento_incluir on public.fin_taxas_meio_pagamento for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_taxas_meio_pagamento_alterar on public.fin_taxas_meio_pagamento for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_taxas_meio_pagamento_excluir on public.fin_taxas_meio_pagamento for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

-- fin_faturamento_diario: leitura financeiro.cashflow.view | financeiro.dre.view | dashboard.overview.view_values; escrita financeiro.cashflow.create | financeiro.cashflow.edit | financeiro.cashflow.delete | financeiro.cashflow.approve | financeiro.dre.confirm
drop policy fin_faturamento_diario_unidade on public.fin_faturamento_diario;
create policy fin_faturamento_diario_ler on public.fin_faturamento_diario for select to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'dashboard.overview.view_values']))));
create policy fin_faturamento_diario_incluir on public.fin_faturamento_diario for insert to authenticated
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));
create policy fin_faturamento_diario_alterar on public.fin_faturamento_diario for update to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));
create policy fin_faturamento_diario_excluir on public.fin_faturamento_diario for delete to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id() and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));

-- gastos_administrativos: leitura rh.admin_expenses.view | financeiro.cashflow.view | financeiro.dre.view; escrita rh.admin_expenses.create | rh.admin_expenses.edit | rh.admin_expenses.delete | rh.admin_expenses.approve
drop policy sec_unidade on public.gastos_administrativos;
create policy gastos_administrativos_ler on public.gastos_administrativos for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.admin_expenses.view', 'financeiro.cashflow.view', 'financeiro.dre.view']))));
create policy gastos_administrativos_incluir on public.gastos_administrativos for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.admin_expenses.create', 'rh.admin_expenses.edit', 'rh.admin_expenses.delete', 'rh.admin_expenses.approve']))));
create policy gastos_administrativos_alterar on public.gastos_administrativos for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.admin_expenses.create', 'rh.admin_expenses.edit', 'rh.admin_expenses.delete', 'rh.admin_expenses.approve']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.admin_expenses.create', 'rh.admin_expenses.edit', 'rh.admin_expenses.delete', 'rh.admin_expenses.approve']))));
create policy gastos_administrativos_excluir on public.gastos_administrativos for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.admin_expenses.create', 'rh.admin_expenses.edit', 'rh.admin_expenses.delete', 'rh.admin_expenses.approve']))));

-- marmitaria_vendas: leitura financeiro.cashflow.view | financeiro.dre.view | marmitaria.financial.view | marmitaria.overview.view_values; escrita marmitaria.financial.create | marmitaria.financial.edit | marmitaria.financial.delete | financeiro.cashflow.edit
drop policy sec_unidade on public.marmitaria_vendas;
create policy marmitaria_vendas_ler on public.marmitaria_vendas for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'marmitaria.financial.view', 'marmitaria.overview.view_values']))));
create policy marmitaria_vendas_incluir on public.marmitaria_vendas for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['marmitaria.financial.create', 'marmitaria.financial.edit', 'marmitaria.financial.delete', 'financeiro.cashflow.edit']))));
create policy marmitaria_vendas_alterar on public.marmitaria_vendas for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['marmitaria.financial.create', 'marmitaria.financial.edit', 'marmitaria.financial.delete', 'financeiro.cashflow.edit']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['marmitaria.financial.create', 'marmitaria.financial.edit', 'marmitaria.financial.delete', 'financeiro.cashflow.edit']))));
create policy marmitaria_vendas_excluir on public.marmitaria_vendas for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['marmitaria.financial.create', 'marmitaria.financial.edit', 'marmitaria.financial.delete', 'financeiro.cashflow.edit']))));

-- delivery_repasses: leitura financeiro.cashflow.view | financeiro.dre.view | marmitaria.financial.view | marmitaria.overview.view_values (escrita só do servidor)
drop policy sec_unidade_ler on public.delivery_repasses;
create policy delivery_repasses_ler on public.delivery_repasses for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'marmitaria.financial.view', 'marmitaria.overview.view_values']))));

-- extras_cadastros: leitura rh.extras.view | rh.recruiting.view; escrita rh.extras.create | rh.extras.edit | rh.extras.delete
drop policy sec_unidade on public.extras_cadastros;
create policy extras_cadastros_ler on public.extras_cadastros for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.view', 'rh.recruiting.view']))));
create policy extras_cadastros_incluir on public.extras_cadastros for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete']))));
create policy extras_cadastros_alterar on public.extras_cadastros for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete']))));
create policy extras_cadastros_excluir on public.extras_cadastros for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete']))));

-- rh_recibos_prestacao: leitura rh.extras.view | rh.payroll.view | rh.payroll.view_values | rh.overview.view_values | financeiro.cashflow.view | financeiro.dre.view; escrita rh.extras.create | rh.extras.edit | rh.extras.delete | rh.payroll.create | rh.payroll.edit | rh.payroll.confirm
drop policy sec_unidade on public.rh_recibos_prestacao;
create policy rh_recibos_prestacao_ler on public.rh_recibos_prestacao for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.view', 'rh.payroll.view', 'rh.payroll.view_values', 'rh.overview.view_values', 'financeiro.cashflow.view', 'financeiro.dre.view']))));
create policy rh_recibos_prestacao_incluir on public.rh_recibos_prestacao for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete', 'rh.payroll.create', 'rh.payroll.edit', 'rh.payroll.confirm']))));
create policy rh_recibos_prestacao_alterar on public.rh_recibos_prestacao for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete', 'rh.payroll.create', 'rh.payroll.edit', 'rh.payroll.confirm']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete', 'rh.payroll.create', 'rh.payroll.edit', 'rh.payroll.confirm']))));
create policy rh_recibos_prestacao_excluir on public.rh_recibos_prestacao for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.extras.create', 'rh.extras.edit', 'rh.extras.delete', 'rh.payroll.create', 'rh.payroll.edit', 'rh.payroll.confirm']))));

-- rh_consumo_funcionarios: leitura rh.employees.view | rh.payroll.view; escrita rh.employees.create | rh.employees.edit | rh.employees.delete | rh.payroll.edit | rh.payroll.confirm
drop policy sec_unidade on public.rh_consumo_funcionarios;
create policy rh_consumo_funcionarios_ler on public.rh_consumo_funcionarios for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.view', 'rh.payroll.view']))));
create policy rh_consumo_funcionarios_incluir on public.rh_consumo_funcionarios for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.create', 'rh.employees.edit', 'rh.employees.delete', 'rh.payroll.edit', 'rh.payroll.confirm']))));
create policy rh_consumo_funcionarios_alterar on public.rh_consumo_funcionarios for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.create', 'rh.employees.edit', 'rh.employees.delete', 'rh.payroll.edit', 'rh.payroll.confirm']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.create', 'rh.employees.edit', 'rh.employees.delete', 'rh.payroll.edit', 'rh.payroll.confirm']))));
create policy rh_consumo_funcionarios_excluir on public.rh_consumo_funcionarios for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['rh.employees.create', 'rh.employees.edit', 'rh.employees.delete', 'rh.payroll.edit', 'rh.payroll.confirm']))));

-- ── 3. RPCs financeiras: texto do F2.1 + permissão da ação ────────────────────

create or replace function public.fin_registrar_pagamento(
  p_conta_pagar_id      uuid,
  p_pago_em             date,
  p_valor_principal     numeric,
  p_juros               numeric default 0,
  p_multa               numeric default 0,
  p_desconto            numeric default 0,
  p_forma_pagamento     text default null,
  p_conta_financeira_id uuid default null,
  p_observacao          text default null,
  p_chave_idempotencia  text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conta    public.contas_pagar%rowtype;
  v_existente public.fin_pagamentos%rowtype;
  v_qtd      integer;
  v_pago     numeric;
  v_saldo    numeric;
  v_id       uuid;
  v_status   text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.contas_pagar where id = p_conta_pagar_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a pagar não encontrada nesta unidade.';
  end if;
  -- SEC-FIN-3: além da unidade, a permissão financeira da ação
  if not (public.pode_ver_todas() or public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.approve'])) then
    raise exception 'Sem permissão financeira para esta operação.' using errcode = '42501';
  end if;

  if coalesce(btrim(p_chave_idempotencia), '') <> '' then
    select * into v_existente from public.fin_pagamentos
     where unidade_id = v_conta.unidade_id and chave_idempotencia = p_chave_idempotencia;
    if found then
      return jsonb_build_object('pagamento_id', v_existente.id, 'idempotente', true, 'status', v_conta.status);
    end if;
  end if;

  if v_conta.status = 'cancelado' then raise exception 'Conta cancelada não recebe pagamento.'; end if;
  select count(*), coalesce(sum(valor_principal), 0) into v_qtd, v_pago
    from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null;
  if v_qtd = 0 and lower(v_conta.status) in ('pago','paga') then
    raise exception 'Conta já consta como paga (registro anterior à F2.1).';
  end if;
  if p_pago_em is null then raise exception 'Informe a data real do pagamento.'; end if;
  if p_pago_em > public.fin_hoje() then raise exception 'A data do pagamento não pode ser futura.'; end if;
  if coalesce(p_valor_principal, 0) <= 0 then raise exception 'O valor pago precisa ser maior que zero.'; end if;
  if coalesce(p_juros,0) < 0 or coalesce(p_multa,0) < 0 or coalesce(p_desconto,0) < 0 then
    raise exception 'Juros, multa e desconto não podem ser negativos.';
  end if;
  v_saldo := v_conta.valor - v_pago;
  if p_valor_principal > v_saldo + 0.005 then
    raise exception 'Valor maior que o saldo da conta (saldo: %).', round(v_saldo, 2);
  end if;
  if p_conta_financeira_id is not null and not exists (
       select 1 from public.fin_contas_financeiras
        where id = p_conta_financeira_id and unidade_id = v_conta.unidade_id and ativa) then
    raise exception 'Conta financeira inválida para esta unidade.';
  end if;

  insert into public.fin_pagamentos (unidade_id, conta_pagar_id, pago_em, valor_principal, juros, multa, desconto,
                                     forma_pagamento, conta_financeira_id, observacao, chave_idempotencia, criado_por)
  values (v_conta.unidade_id, v_conta.id, p_pago_em, p_valor_principal, coalesce(p_juros,0), coalesce(p_multa,0),
          coalesce(p_desconto,0), p_forma_pagamento, p_conta_financeira_id, p_observacao,
          nullif(btrim(p_chave_idempotencia), ''), auth.uid())
  returning id into v_id;

  v_status := public.fin_conta_pagar_recalcular(v_conta.id);
  return jsonb_build_object('pagamento_id', v_id, 'idempotente', false, 'status', v_status,
                            'saldo', round(v_saldo - p_valor_principal, 2));
end $$;

create or replace function public.fin_registrar_recebimento(
  p_conta_receber_id       uuid,
  p_recebido_em            date,
  p_valor_liquido_recebido numeric,
  p_valor_bruto_baixado    numeric default null,   -- nulo = baixa o saldo bruto inteiro
  p_conta_financeira_id    uuid default null,
  p_conciliacao_referencia text default null,
  p_observacao             text default null,
  p_chave_idempotencia     text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conta public.fin_contas_receber%rowtype;
  v_existente public.fin_recebimentos%rowtype;
  v_baixado numeric;
  v_saldo numeric;
  v_bruto numeric;
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.fin_contas_receber where id = p_conta_receber_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a receber não encontrada nesta unidade.';
  end if;
  -- SEC-FIN-3: além da unidade, a permissão financeira da ação
  if not (public.pode_ver_todas() or public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.approve'])) then
    raise exception 'Sem permissão financeira para esta operação.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_chave_idempotencia), '') <> '' then
    select * into v_existente from public.fin_recebimentos
     where unidade_id = v_conta.unidade_id and chave_idempotencia = p_chave_idempotencia;
    if found then
      return jsonb_build_object('recebimento_id', v_existente.id, 'idempotente', true, 'status', v_conta.status);
    end if;
  end if;
  if v_conta.status = 'cancelado' then raise exception 'Conta a receber cancelada.'; end if;
  if p_recebido_em is null then raise exception 'Informe a data real do recebimento.'; end if;
  if p_recebido_em > public.fin_hoje() then raise exception 'A data do recebimento não pode ser futura.'; end if;
  select coalesce(sum(valor_bruto_baixado), 0) into v_baixado
    from public.fin_recebimentos where conta_receber_id = v_conta.id and estornado_em is null;
  v_saldo := v_conta.valor_bruto - v_baixado;
  if v_saldo <= 0.005 then raise exception 'Conta a receber já está totalmente recebida.'; end if;
  v_bruto := coalesce(p_valor_bruto_baixado, v_saldo);
  if v_bruto <= 0 or v_bruto > v_saldo + 0.005 then
    raise exception 'Valor bruto baixado inválido (saldo bruto: %).', round(v_saldo, 2);
  end if;
  if p_valor_liquido_recebido is null or p_valor_liquido_recebido < 0 or p_valor_liquido_recebido > v_bruto then
    raise exception 'Valor líquido recebido inválido (precisa estar entre 0 e o bruto baixado).';
  end if;
  if p_conta_financeira_id is not null and not exists (
       select 1 from public.fin_contas_financeiras
        where id = p_conta_financeira_id and unidade_id = v_conta.unidade_id and ativa) then
    raise exception 'Conta financeira inválida para esta unidade.';
  end if;

  insert into public.fin_recebimentos (unidade_id, conta_receber_id, recebido_em, valor_bruto_baixado,
       valor_liquido_recebido, conta_financeira_id, conciliacao_referencia, observacao, chave_idempotencia, criado_por)
  values (v_conta.unidade_id, v_conta.id, p_recebido_em, v_bruto, p_valor_liquido_recebido, p_conta_financeira_id,
          p_conciliacao_referencia, p_observacao, nullif(btrim(p_chave_idempotencia), ''), auth.uid())
  returning id into v_id;
  v_status := public.fin_conta_receber_recalcular(v_conta.id);
  return jsonb_build_object('recebimento_id', v_id, 'idempotente', false, 'status', v_status,
                            'saldo_bruto', round(v_saldo - v_bruto, 2));
end $$;

create or replace function public.fin_cancelar_conta_pagar(p_conta_pagar_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_conta public.contas_pagar%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.contas_pagar where id = p_conta_pagar_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a pagar não encontrada nesta unidade.';
  end if;
  -- SEC-FIN-3: além da unidade, a permissão financeira da ação
  if not (public.pode_ver_todas() or public.hefisto_tem_alguma(array['financeiro.cashflow.delete', 'financeiro.cashflow.approve'])) then
    raise exception 'Sem permissão financeira para esta operação.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if v_conta.status = 'cancelado' then raise exception 'Conta já cancelada.'; end if;
  if lower(v_conta.status) in ('pago','paga','parcial')
     or exists (select 1 from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null) then
    raise exception 'Conta com pagamento não pode ser cancelada: estorne os pagamentos antes.';
  end if;
  update public.contas_pagar
     set status = 'cancelado', cancelado_em = now(), motivo_cancelamento = btrim(p_motivo)
   where id = v_conta.id;
  return jsonb_build_object('conta_pagar_id', v_conta.id, 'status', 'cancelado');
end $$;

create or replace function public.fin_estornar_pagamento(p_pagamento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pag public.fin_pagamentos%rowtype;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_pag from public.fin_pagamentos where id = p_pagamento_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_pag.unidade_id) then
    raise exception 'Pagamento não encontrado nesta unidade.';
  end if;
  -- SEC-FIN-3: além da unidade, a permissão financeira da ação
  if not (public.pode_ver_todas() or public.hefisto_tem_alguma(array['financeiro.cashflow.delete', 'financeiro.cashflow.approve'])) then
    raise exception 'Sem permissão financeira para esta operação.' using errcode = '42501';
  end if;
  if v_pag.estornado_em is not null then raise exception 'Pagamento já estornado.'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do estorno.'; end if;
  perform 1 from public.contas_pagar where id = v_pag.conta_pagar_id for update;
  update public.fin_pagamentos
     set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = btrim(p_motivo)
   where id = p_pagamento_id;
  v_status := public.fin_conta_pagar_recalcular(v_pag.conta_pagar_id);
  return jsonb_build_object('pagamento_id', p_pagamento_id, 'status', v_status);
end $$;

create or replace function public.fin_estornar_recebimento(p_recebimento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rec public.fin_recebimentos%rowtype;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_rec from public.fin_recebimentos where id = p_recebimento_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_rec.unidade_id) then
    raise exception 'Recebimento não encontrado nesta unidade.';
  end if;
  -- SEC-FIN-3: além da unidade, a permissão financeira da ação
  if not (public.pode_ver_todas() or public.hefisto_tem_alguma(array['financeiro.cashflow.delete', 'financeiro.cashflow.approve'])) then
    raise exception 'Sem permissão financeira para esta operação.' using errcode = '42501';
  end if;
  if v_rec.estornado_em is not null then raise exception 'Recebimento já estornado.'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do estorno.'; end if;
  perform 1 from public.fin_contas_receber where id = v_rec.conta_receber_id for update;
  update public.fin_recebimentos
     set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = btrim(p_motivo)
   where id = p_recebimento_id;
  v_status := public.fin_conta_receber_recalcular(v_rec.conta_receber_id);
  return jsonb_build_object('recebimento_id', p_recebimento_id, 'status', v_status);
end $$;

commit;

-- Verificação (impressão digital)
select count(*) filter (where policyname like '%_ler') as policies_ler,
       count(*) filter (where qual ilike '%hefisto_tem_alguma%' or with_check ilike '%hefisto_tem_alguma%') as com_permissao,
       (select count(*) from pg_proc where proname in ('fin_registrar_pagamento', 'fin_registrar_recebimento', 'fin_cancelar_conta_pagar', 'fin_estornar_pagamento', 'fin_estornar_recebimento')
          and prosrc ilike '%hefisto_tem_alguma%') as rpcs_com_permissao
  from pg_policies where schemaname = 'public' and tablename in ('contas_pagar', 'fin_contas_financeiras', 'fin_contas_receber', 'fin_pagamentos',
    'fin_recebimentos', 'fin_taxas_meio_pagamento', 'fin_faturamento_diario', 'gastos_administrativos', 'marmitaria_vendas',
    'delivery_repasses', 'extras_cadastros', 'rh_recibos_prestacao', 'rh_consumo_funcionarios');
