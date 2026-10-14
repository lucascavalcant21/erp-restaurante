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
     (SEC-FIN-2) e funções (estoque_movimentar, fin_*) não mudam. Permissão por
     módulo nas tabelas é o nível 2 (proposta à parte, com impacto medido).

   ROLLBACK: db/security/SEC_MULTI_1_ROLLBACK.sql (recria as policies F2.1).
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
      ('compras', 'compras_unidade_f21'), ('compras_itens', 'compras_itens_unidade_f21'), ('contas_pagar', 'contas_pagar_unidade'),
      ('estoque_contagens', 'estoque_contagens_unidade_f21'), ('estoque_contagens_itens', 'estoque_contagens_itens_unidade_f21'),
      ('estoque_custos', 'estoque_custos_unidade_f21'), ('estoque_custos_historico', 'estoque_custos_historico_unidade'),
      ('estoque_itens', 'estoque_itens_unidade'), ('estoque_lotes', 'estoque_lotes_unidade'), ('estoque_movimentacoes_multi', 'estoque_mov_ler_unidade'),
      ('fin_contas_financeiras', 'fin_contas_financeiras_unidade_f21'), ('fin_contas_receber', 'fin_contas_receber_unidade_f21'),
      ('fin_faturamento_diario', 'fin_faturamento_diario_unidade'), ('fin_pagamentos', 'fin_pagamentos_unidade_f21'),
      ('fin_recebimentos', 'fin_recebimentos_unidade_f21'), ('fin_taxas_meio_pagamento', 'fin_taxas_meio_pagamento_unidade_f21')) v(t, p) loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.t and policyname = r.p
                   and qual = '(pode_ver_todas() OR (unidade_id = auth_unidade_id()))') then
      raise exception 'SEC-MULTI-1: a policy % de % não está como esperado. Nada foi alterado.', r.p, r.t;
    end if;
    n := n + 1;
  end loop;
end $$;

-- ── 1. Recria as 16 policies no padrão sec_unidade (SQL explícito, revisável) ──
drop policy compras_unidade_f21 on public.compras;
create policy compras_unidade_f21 on public.compras for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy compras_itens_unidade_f21 on public.compras_itens;
create policy compras_itens_unidade_f21 on public.compras_itens for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy contas_pagar_unidade on public.contas_pagar;
create policy contas_pagar_unidade on public.contas_pagar for all to authenticated
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

drop policy fin_contas_financeiras_unidade_f21 on public.fin_contas_financeiras;
create policy fin_contas_financeiras_unidade_f21 on public.fin_contas_financeiras for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy fin_contas_receber_unidade_f21 on public.fin_contas_receber;
create policy fin_contas_receber_unidade_f21 on public.fin_contas_receber for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy fin_faturamento_diario_unidade on public.fin_faturamento_diario;
create policy fin_faturamento_diario_unidade on public.fin_faturamento_diario for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy fin_pagamentos_unidade_f21 on public.fin_pagamentos;
create policy fin_pagamentos_unidade_f21 on public.fin_pagamentos for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy fin_recebimentos_unidade_f21 on public.fin_recebimentos;
create policy fin_recebimentos_unidade_f21 on public.fin_recebimentos for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy fin_taxas_meio_pagamento_unidade_f21 on public.fin_taxas_meio_pagamento;
create policy fin_taxas_meio_pagamento_unidade_f21 on public.fin_taxas_meio_pagamento for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

commit;

-- Verificação (impressão digital): nenhuma policy das 16 usa mais auth_unidade_id()
select count(*) filter (where coalesce(qual, '') ilike '%auth_unidade_id%' or coalesce(with_check, '') ilike '%auth_unidade_id%') as ainda_antigas,
       count(*) filter (where qual ilike '%hefisto_unidades_do_usuario%') as no_padrao_novo
  from pg_policies where schemaname = 'public' and tablename in ('compras', 'compras_itens', 'contas_pagar', 'estoque_contagens', 'estoque_contagens_itens',
    'estoque_custos', 'estoque_custos_historico', 'estoque_itens', 'estoque_lotes', 'estoque_movimentacoes_multi', 'fin_contas_financeiras',
    'fin_contas_receber', 'fin_faturamento_diario', 'fin_pagamentos', 'fin_recebimentos', 'fin_taxas_meio_pagamento');
