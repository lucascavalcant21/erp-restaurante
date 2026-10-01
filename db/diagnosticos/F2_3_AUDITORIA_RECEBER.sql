/* ═══════════════════════════════════════════════════════════════════════════
   F2.3 — AUDITORIA DO BANCO REAL ANTES DO DEPLOY (SOMENTE LEITURA)
   Só SELECT em pg_catalog / information_schema. Um único resultado.
   Confere em produção o que a F2.3 usa:
     fin_contas_receber, fin_recebimentos, fin_contas_financeiras,
     fin_taxas_meio_pagamento, as views e as RPCs de recebimento.
   ═══════════════════════════════════════════════════════════════════════════ */
with tabelas(t) as (values ('fin_contas_receber'),('fin_recebimentos'),('fin_contas_financeiras'),('fin_taxas_meio_pagamento')),
views(v) as (values ('vw_fin_contas_receber'),('vw_fin_fluxo_caixa'),('vw_fin_saldo_contas_financeiras')),
rpcs(f) as (values ('fin_registrar_recebimento'),('fin_estornar_recebimento'),('fin_conta_receber_recalcular'))
select * from (
  -- 1. colunas reais (a F2.3 depende delas)
  select 1 as ord, '01 colunas: ' || c.table_name as item,
         string_agg(c.column_name || ':' || c.data_type, ', ' order by c.ordinal_position) as resultado
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name in (select t from tabelas)
   group by c.table_name
  union all
  -- 2. RLS ligado / forçado
  select 2, '02 RLS: ' || c.relname, c.relrowsecurity::text || ' / forçado=' || c.relforcerowsecurity::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (select t from tabelas)
  union all
  -- 3. TODAS as policies (procurar USING true / sem unidade)
  select 3, '03 policy: ' || pol.polrelid::regclass::text || ' / ' || pol.polname,
         'cmd=' || case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end
         || ' | ' || case when pol.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end
         || ' | papéis=' || coalesce((select string_agg(case when r = 0 then 'public' else pg_get_userbyid(r) end, ',') from unnest(pol.polroles) r), '?')
         || ' | USING=' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), '(nenhum)')
         || ' | CHECK=' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '(nenhum)')
    from pg_policy pol
   where pol.polrelid in (select ('public.' || t)::regclass from tabelas)
  union all
  -- 4. privilégios de anon / authenticated / PUBLIC nas tabelas e views
  select 4, '04 privilégios: ' || table_name || ' → ' || grantee, string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon','authenticated','PUBLIC')
     and (table_name in (select t from tabelas) or table_name in (select v from views))
   group by table_name, grantee
  union all
  -- 5. views respeitam o RLS de quem consulta?
  select 5, '05 view security_invoker: ' || c.relname, coalesce(array_to_string(c.reloptions, ','), '(nenhuma opção)')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in (select v from views)
  union all
  -- 6. RPCs: assinatura, dono, definer, quem executa
  select 6, '06 rpc: ' || p.proname,
         pg_get_function_identity_arguments(p.oid) || ' | dono=' || pg_get_userbyid(p.proowner)
         || ' | definer=' || p.prosecdef::text
         || ' | anon=' || has_function_privilege('anon', p.oid, 'execute')::text
         || ' | authenticated=' || has_function_privilege('authenticated', p.oid, 'execute')::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (select f from rpcs)
  union all
  -- 7. as RPCs checam a unidade? (procura a função de escopo no corpo)
  select 7, '07 rpc checa unidade: ' || p.proname, (position('fin_pode_acessar_unidade' in p.prosrc) > 0)::text
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('fin_registrar_recebimento','fin_estornar_recebimento')
  union all
  -- 8. dados existentes (só contagem)
  select 8, '08 linhas: ' || t, (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.' || t, false, true, '')))[1]::text
    from tabelas
) x
order by ord, item;
