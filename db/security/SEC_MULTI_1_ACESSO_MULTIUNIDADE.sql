/* ═══════════════════════════════════════════════════════════════════════════
   SEC-MULTI-1 · estoque e financeiro de VÁRIAS unidades com acesso explícito
   (14/10/2026 — achado A3 da auditoria de integração da Marmitaria)

   POR QUE
   O Héfisto tem dois modelos de isolamento convivendo:
     - o novo (sec_unidade): unidades que o usuário alcança EXPLICITAMENTE —
       unidade principal + escopos cadastrados (usuario_escopos), e o escopo
       de empresa só dentro da PRÓPRIA empresa (hefisto_unidades_do_usuario);
     - o antigo (F2.1), em 16 tabelas de estoque, compras e financeiro:
       super admin OU a unidade PRINCIPAL (auth_unidade_id()).
   Com a Marmitaria em unidade própria, quem trabalha nos dois negócios (ou
   o gestor com escopo da empresa) via estoque e financeiro de uma unidade só,
   enquanto fichas, insumos, marmitaria e iFood já seguiam o modelo novo.

   O QUE FAZ (só policies; nenhum dado, coluna ou privilégio de tabela muda)
   Nas 16 tabelas, a policy F2.1 é recriada com o MESMO nome, comando e papel,
   trocando a condição por:
       hefisto_ve_todas_unidades()  OR  unidade_id ∈ hefisto_unidades_do_usuario()
   (o padrão sec_unidade, já usado em 100+ tabelas).

   EFEITO
   - Super admin: igual.
   - Usuário só com a unidade principal: igual (o conjunto é a própria principal).
   - Usuário com escopo explícito em outra unidade / escopo de empresa: passa
     a ver e operar estoque e financeiro DESSAS unidades — nunca de outra
     empresa (o escopo de empresa é limitado à própria).
   - Usuário bloqueado (locked_until no futuro): perde o acesso (antes não
     era conferido aqui) — mais restritivo.
   - Usuário sem unidade principal: antes caía na PRIMEIRA unidade de escopo
     por ordem alfabética (arbitrário); agora alcança as que foram concedidas.
   - O que cada pessoa pode FAZER continua igual: privilégios de tabela
     (SEC-FIN-2) e funções (estoque_movimentar, fin_*) não mudam.

   ORDEM OBRIGATÓRIA: SEC-FIN-3 ANTES desta (15/10/2026)
   Nas 7 tabelas financeiras a SEC-FIN-3 troca a policy F2.1 por 4 policies
   (unidade principal + chave do módulo). Esta migração parte DESSE estado e
   só troca a unidade principal pelas unidades concedidas, com as MESMAS
   chaves (texto gerado do SQL da SEC-FIN-3). Sem a SEC-FIN-3, o preflight
   aborta. Resultado no financeiro: unidades concedidas E chave do módulo.

   ROLLBACK: db/security/SEC_MULTI_1_ROLLBACK.sql (estoque e compras voltam à
   F2.1; financeiro volta exatamente ao estado da SEC-FIN-3).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- ── 0. Preflight: aborta sem mudar nada se o estado não for o esperado ───────
do $$
declare r record; n integer := 0;
begin
  if to_regprocedure('public.hefisto_unidades_do_usuario()') is null or to_regprocedure('public.hefisto_ve_todas_unidades()') is null then
    raise exception 'SEC-MULTI-1: funções de escopo ausentes. Nada foi alterado.';
  end if;
  for r in select * from (values
      ('compras', 'compras_unidade_f21'), ('compras_itens', 'compras_itens_unidade_f21'), ('estoque_contagens', 'estoque_contagens_unidade_f21'), ('estoque_contagens_itens', 'estoque_contagens_itens_unidade_f21'), ('estoque_custos', 'estoque_custos_unidade_f21'), ('estoque_custos_historico', 'estoque_custos_historico_unidade'), ('estoque_itens', 'estoque_itens_unidade'), ('estoque_lotes', 'estoque_lotes_unidade'), ('estoque_movimentacoes_multi', 'estoque_mov_ler_unidade')
      ) v(t, p) loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.t and policyname = r.p
                   and qual = '(pode_ver_todas() OR (unidade_id = auth_unidade_id()))') then
      raise exception 'SEC-MULTI-1: a policy % de % não está como esperado. Nada foi alterado.', r.p, r.t;
    end if;
    n := n + 1;
  end loop;

  -- financeiras: precisam estar EXATAMENTE como a SEC-FIN-3 deixa (4 policies,
  -- unidade principal + chave do módulo). Sem a SEC-FIN-3, aborta: aplicar esta
  -- antes apagaria a permissão por módulo ou seria apagada por ela.
  if to_regprocedure('public.hefisto_tem_alguma(text[])') is null then
    raise exception 'SEC-MULTI-1: aplique a SEC-FIN-3 antes (hefisto_tem_alguma ausente). Nada foi alterado.';
  end if;
  for r in select * from (values ('contas_pagar'), ('fin_contas_financeiras'), ('fin_contas_receber'), ('fin_faturamento_diario'), ('fin_pagamentos'), ('fin_recebimentos'), ('fin_taxas_meio_pagamento')) v(t) loop
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = r.t) <> 4
       or (select count(*) from pg_policies where schemaname = 'public' and tablename = r.t
            and policyname in (r.t || '_ler', r.t || '_incluir', r.t || '_alterar', r.t || '_excluir')
            and coalesce(qual, with_check) like '%auth_unidade_id()%' and coalesce(qual, with_check) like '%hefisto_tem_alguma%'
            and (with_check is null or (with_check like '%auth_unidade_id()%' and with_check like '%hefisto_tem_alguma%'))) <> 4 then
      raise exception 'SEC-MULTI-1: as policies de % não estão como a SEC-FIN-3 deixa. Nada foi alterado.', r.t;
    end if;
  end loop;
end $$;

-- ── 1. Estoque e compras (9 tabelas): padrão sec_unidade, mesmo nome e comando ──
drop policy compras_unidade_f21 on public.compras;
create policy compras_unidade_f21 on public.compras for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy compras_itens_unidade_f21 on public.compras_itens;
create policy compras_itens_unidade_f21 on public.compras_itens for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy estoque_contagens_unidade_f21 on public.estoque_contagens;
create policy estoque_contagens_unidade_f21 on public.estoque_contagens for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy estoque_contagens_itens_unidade_f21 on public.estoque_contagens_itens;
create policy estoque_contagens_itens_unidade_f21 on public.estoque_contagens_itens for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy estoque_custos_unidade_f21 on public.estoque_custos;
create policy estoque_custos_unidade_f21 on public.estoque_custos for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy estoque_custos_historico_unidade on public.estoque_custos_historico;
create policy estoque_custos_historico_unidade on public.estoque_custos_historico for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy estoque_itens_unidade on public.estoque_itens;
create policy estoque_itens_unidade on public.estoque_itens for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy estoque_lotes_unidade on public.estoque_lotes;
create policy estoque_lotes_unidade on public.estoque_lotes for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy estoque_mov_ler_unidade on public.estoque_movimentacoes_multi;
create policy estoque_mov_ler_unidade on public.estoque_movimentacoes_multi for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

-- ── 2. Financeiro (7 tabelas): mesmas chaves da SEC-FIN-3; só a unidade muda ──
drop policy contas_pagar_ler on public.contas_pagar;
drop policy contas_pagar_incluir on public.contas_pagar;
drop policy contas_pagar_alterar on public.contas_pagar;
drop policy contas_pagar_excluir on public.contas_pagar;
create policy contas_pagar_ler on public.contas_pagar for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'marmitaria.financial.view']))));
create policy contas_pagar_incluir on public.contas_pagar for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy contas_pagar_alterar on public.contas_pagar for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy contas_pagar_excluir on public.contas_pagar for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_contas_financeiras_ler on public.fin_contas_financeiras;
drop policy fin_contas_financeiras_incluir on public.fin_contas_financeiras;
drop policy fin_contas_financeiras_alterar on public.fin_contas_financeiras;
drop policy fin_contas_financeiras_excluir on public.fin_contas_financeiras;
create policy fin_contas_financeiras_ler on public.fin_contas_financeiras for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_contas_financeiras_incluir on public.fin_contas_financeiras for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_financeiras_alterar on public.fin_contas_financeiras for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_financeiras_excluir on public.fin_contas_financeiras for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_contas_receber_ler on public.fin_contas_receber;
drop policy fin_contas_receber_incluir on public.fin_contas_receber;
drop policy fin_contas_receber_alterar on public.fin_contas_receber;
drop policy fin_contas_receber_excluir on public.fin_contas_receber;
create policy fin_contas_receber_ler on public.fin_contas_receber for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_contas_receber_incluir on public.fin_contas_receber for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_receber_alterar on public.fin_contas_receber for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_contas_receber_excluir on public.fin_contas_receber for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_faturamento_diario_ler on public.fin_faturamento_diario;
drop policy fin_faturamento_diario_incluir on public.fin_faturamento_diario;
drop policy fin_faturamento_diario_alterar on public.fin_faturamento_diario;
drop policy fin_faturamento_diario_excluir on public.fin_faturamento_diario;
create policy fin_faturamento_diario_ler on public.fin_faturamento_diario for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view', 'financeiro.dre.view', 'dashboard.overview.view_values']))));
create policy fin_faturamento_diario_incluir on public.fin_faturamento_diario for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));
create policy fin_faturamento_diario_alterar on public.fin_faturamento_diario for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));
create policy fin_faturamento_diario_excluir on public.fin_faturamento_diario for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve', 'financeiro.dre.confirm']))));

drop policy fin_pagamentos_ler on public.fin_pagamentos;
drop policy fin_pagamentos_incluir on public.fin_pagamentos;
drop policy fin_pagamentos_alterar on public.fin_pagamentos;
drop policy fin_pagamentos_excluir on public.fin_pagamentos;
create policy fin_pagamentos_ler on public.fin_pagamentos for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_pagamentos_incluir on public.fin_pagamentos for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_pagamentos_alterar on public.fin_pagamentos for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_pagamentos_excluir on public.fin_pagamentos for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_recebimentos_ler on public.fin_recebimentos;
drop policy fin_recebimentos_incluir on public.fin_recebimentos;
drop policy fin_recebimentos_alterar on public.fin_recebimentos;
drop policy fin_recebimentos_excluir on public.fin_recebimentos;
create policy fin_recebimentos_ler on public.fin_recebimentos for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_recebimentos_incluir on public.fin_recebimentos for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_recebimentos_alterar on public.fin_recebimentos for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_recebimentos_excluir on public.fin_recebimentos for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

drop policy fin_taxas_meio_pagamento_ler on public.fin_taxas_meio_pagamento;
drop policy fin_taxas_meio_pagamento_incluir on public.fin_taxas_meio_pagamento;
drop policy fin_taxas_meio_pagamento_alterar on public.fin_taxas_meio_pagamento;
drop policy fin_taxas_meio_pagamento_excluir on public.fin_taxas_meio_pagamento;
create policy fin_taxas_meio_pagamento_ler on public.fin_taxas_meio_pagamento for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.view']))));
create policy fin_taxas_meio_pagamento_incluir on public.fin_taxas_meio_pagamento for insert to authenticated
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_taxas_meio_pagamento_alterar on public.fin_taxas_meio_pagamento for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))))
  with check ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));
create policy fin_taxas_meio_pagamento_excluir on public.fin_taxas_meio_pagamento for delete to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or (unidade_id in (select unnest(public.hefisto_unidades_do_usuario())) and (select public.hefisto_tem_alguma(array['financeiro.cashflow.create', 'financeiro.cashflow.edit', 'financeiro.cashflow.delete', 'financeiro.cashflow.approve']))));

commit;

-- Verificação (impressão digital): nenhuma policy das 16 usa mais auth_unidade_id();
-- as 28 financeiras continuam com a chave do módulo (com_chave = 28)
select count(*) filter (where coalesce(qual, '') ilike '%auth_unidade_id%' or coalesce(with_check, '') ilike '%auth_unidade_id%') as ainda_antigas,
       count(*) filter (where coalesce(qual, with_check) ilike '%hefisto_unidades_do_usuario%') as no_padrao_novo,
       count(*) filter (where coalesce(qual, with_check) ilike '%hefisto_tem_alguma%') as com_chave
  from pg_policies where schemaname = 'public' and tablename in ('compras', 'compras_itens', 'contas_pagar', 'estoque_contagens', 'estoque_contagens_itens',
    'estoque_custos', 'estoque_custos_historico', 'estoque_itens', 'estoque_lotes', 'estoque_movimentacoes_multi', 'fin_contas_financeiras',
    'fin_contas_receber', 'fin_faturamento_diario', 'fin_pagamentos', 'fin_recebimentos', 'fin_taxas_meio_pagamento');
