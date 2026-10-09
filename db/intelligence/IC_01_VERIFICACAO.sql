/* ═══════════════════════════════════════════════════════════════════════════
   IC-01 · VERIFICAÇÃO DEPOIS DE APLICAR (SOMENTE LEITURA)

   Rode logo depois de IC_01_INTELLIGENCE_CORE.sql. Um único SELECT sobre o
   catálogo: tabelas, versão, RLS, policies, triggers, índices, grants, FKs e
   uma impressão digital (md5) das colunas. Toda linha deve sair OK.
   Guarde o resultado (print ou CSV) como evidência da versão aplicada; a
   impressão digital esperada está em docs/intelligence/ATIVACAO.md e é
   conferida pelo teste da migração (PGlite).
   ═══════════════════════════════════════════════════════════════════════════ */

with
tabelas(nome) as (values ('intelligence_eventos'), ('intelligence_acoes'), ('intelligence_feedback'), ('intelligence_preferencias')),
t as (
  select x.nome, c.oid, c.relrowsecurity, coalesce(obj_description(c.oid, 'pg_class'), '') as comentario
  from tabelas x left join pg_class c on c.oid = to_regclass('public.' || x.nome)
),
grants_esperados(papel, tabela, privilegio, esperado) as (
  select r.papel, x.nome, p.priv,
         case
           when r.papel = 'anon' then false
           when r.papel = 'authenticated' then p.priv = 'SELECT'
           when x.nome = 'intelligence_eventos' then p.priv in ('SELECT','INSERT')
           when x.nome = 'intelligence_feedback' then p.priv in ('SELECT','INSERT')
           else p.priv in ('SELECT','INSERT','UPDATE')
         end
  from unnest(array['anon','authenticated','service_role']) r(papel)
  cross join tabelas x
  cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p(priv)
  where exists (select 1 from pg_roles where rolname = r.papel)
),
policies_esperadas(tabela, policy) as (
  values ('intelligence_eventos', 'intelligence_eventos_ler'), ('intelligence_acoes', 'intelligence_acoes_ler'),
         ('intelligence_feedback', 'intelligence_feedback_ler'), ('intelligence_preferencias', 'intelligence_preferencias_ler')
),
indices_esperados(indice) as (
  values ('intelligence_eventos_usuario'), ('intelligence_eventos_correlacao'), ('intelligence_eventos_acao'),
         ('intelligence_acoes_usuario'), ('intelligence_feedback_unidade'), ('intelligence_feedback_entidade')
),
impressao as (
  select md5(string_agg(table_name || '.' || column_name || ':' || data_type || ':' || is_nullable, '|' order by table_name, column_name)) as md5
  from information_schema.columns
  where table_schema = 'public' and table_name in (select nome from tabelas)
),
linhas as (
  select 10 as ordem, 'tabela' as grupo, 'public.' || nome as item,
         case when oid is null then 'FALHA' when comentario like 'hefisto:ic-01.2%' then 'OK' else 'FALHA' end as situacao,
         coalesce(nullif(comentario, ''), 'ausente') as detalhe
  from t
  union all
  select 11, 'rls', 'public.' || nome, case when relrowsecurity then 'OK' else 'FALHA' end,
         case when relrowsecurity then 'ligado' else 'DESLIGADO' end
  from t where oid is not null
  union all
  select 20, 'policy', e.tabela || '.' || e.policy, case when p.policyname is not null then 'OK' else 'FALHA' end,
         coalesce(p.cmd || ' para ' || array_to_string(p.roles, ',') || ' usando ' || p.qual, 'ausente')
  from policies_esperadas e
  left join pg_policies p on p.schemaname = 'public' and p.tablename = e.tabela and p.policyname = e.policy
  union all
  select 21, 'policy', 'policies extras em intelligence_*', case when count(*) = 0 then 'OK' else 'FALHA' end,
         coalesce(string_agg(tablename || '.' || policyname, ', '), 'nenhuma')
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in (select nome from tabelas)
    and (p.tablename, p.policyname) not in (select tabela, policy from policies_esperadas)
  union all
  select 30, 'trigger', g.nome, case when tg.tgname is not null and tg.tgenabled <> 'D' then 'OK' else 'FALHA' end,
         coalesce(pg_get_triggerdef(tg.oid), 'ausente')
  from (values ('intelligence_eventos_imutavel'), ('intelligence_eventos_sem_truncate')) g(nome)
  left join pg_trigger tg on tg.tgname = g.nome and tg.tgrelid = to_regclass('public.intelligence_eventos')
  union all
  select 40, 'índice', i.indice, case when to_regclass('public.' || i.indice) is not null then 'OK' else 'FALHA' end,
         coalesce(pg_get_indexdef(to_regclass('public.' || i.indice)), 'ausente')
  from indices_esperados i
  union all
  select 50, 'grant', g.papel || ' ' || g.privilegio || ' ' || g.tabela,
         case when has_table_privilege(g.papel, 'public.' || g.tabela, g.privilegio) = g.esperado then 'OK' else 'FALHA' end,
         'esperado ' || case when g.esperado then 'SIM' else 'NÃO' end || ' · atual ' ||
           case when has_table_privilege(g.papel, 'public.' || g.tabela, g.privilegio) then 'SIM' else 'NÃO' end
  from grants_esperados g
  where to_regclass('public.' || g.tabela) is not null
  union all
  select 60, 'fk', con.conrelid::regclass::text || ' · ' || con.conname, 'OK', pg_get_constraintdef(con.oid)
  from pg_constraint con
  where con.contype = 'f' and con.conrelid in (select oid from t where oid is not null)
  union all
  select 61, 'check', con.conrelid::regclass::text || ' · ' || con.conname, 'OK', pg_get_constraintdef(con.oid)
  from pg_constraint con
  where con.contype in ('c', 'u') and con.conrelid in (select oid from t where oid is not null)
  union all
  select 70, 'função', 'public.intelligence_eventos_imutavel_trg()',
         case when coalesce(obj_description(to_regprocedure('public.intelligence_eventos_imutavel_trg()'), 'pg_proc'), '') like 'hefisto:ic-01.2%' then 'OK' else 'FALHA' end,
         coalesce(obj_description(to_regprocedure('public.intelligence_eventos_imutavel_trg()'), 'pg_proc'), 'ausente')
  union all
  select 80, 'versão', 'impressão digital das colunas (md5)', 'OK', md5 from impressao
)
select ordem, grupo, item, situacao, detalhe
from linhas
order by case situacao when 'FALHA' then 0 else 1 end, ordem, item;
