/* ═══════════════════════════════════════════════════════════════════════════
   F2.4A · AUDITORIA DO ESTOQUE NO BANCO REAL (SOMENTE LEITURA)

   Só SELECT em information_schema / pg_catalog e contagens. Não altera nada.
   Um único resultado (secao, item, resultado). Tabelas que não existem
   aparecem como "NÃO EXISTE" (as consultas por tabela são dinâmicas, então
   nenhuma tabela ausente quebra o script).

   Não lista nomes de pessoas nem dados sensíveis: só estrutura, contagens e
   os nomes dos estoques/locais e das unidades.
   ═══════════════════════════════════════════════════════════════════════════ */
with alvo(t) as (values
  ('estoques'), ('estoque_itens'), ('estoque_lotes'), ('estoque_movimentacoes'), ('estoque_movimentacoes_multi'),
  ('estoque_atual'), ('estoque_contagens'), ('estoque_contagens_itens'), ('estoque_custos'),
  ('insumos'), ('produtos'), ('compras'), ('compras_itens'), ('vw_compras'),
  ('insumo_fornecedor_precos'), ('fornecedores'), ('fichas_tecnicas'), ('unidades_medida')
),
existe as (select t, to_regclass('public.' || t) as oid from alvo)
select * from (
  -- 00 existência e tipo
  select '00 existe' as secao, e.t as item,
         case when e.oid is null then 'NÃO EXISTE'
              else (select case c.relkind when 'r' then 'tabela' when 'v' then 'view' when 'm' then 'view materializada' else c.relkind::text end
                      from pg_class c where c.oid = e.oid) end as resultado
    from existe e
  union all
  -- 01 colunas (nome tipo [NN = not null] [= default] [G = gerada])
  select '01 colunas', c.table_name,
         string_agg(c.column_name || ' ' || c.data_type
                    || case when c.is_nullable = 'NO' then ' NN' else '' end
                    || case when c.is_generated = 'ALWAYS' then ' G' else '' end,
                    ', ' order by c.ordinal_position)
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name in (select t from alvo)
   group by c.table_name
  union all
  -- 02 RLS ligado / forçado
  select '02 rls', e.t, 'rls=' || c.relrowsecurity || ' forçado=' || c.relforcerowsecurity
    from existe e join pg_class c on c.oid = e.oid where c.relkind = 'r'
  union all
  -- 03 policies (USING / CHECK)
  select '03 policy', p.tablename || ' / ' || p.policyname,
         p.cmd || ' | papéis=' || array_to_string(p.roles, ',') || ' | permissiva=' || p.permissive
         || ' | USING=' || coalesce(p.qual, '-') || ' | CHECK=' || coalesce(p.with_check, '-')
    from pg_policies p
   where p.schemaname = 'public' and p.tablename in (select t from alvo)
  union all
  -- 04 privilégios de tabela por papel
  select '04 privilégios', g.table_name || ' → ' || g.grantee, string_agg(g.privilege_type, ',' order by g.privilege_type)
    from information_schema.role_table_grants g
   where g.table_schema = 'public' and g.table_name in (select t from alvo) and g.grantee in ('anon', 'authenticated', 'PUBLIC')
   group by g.table_name, g.grantee
  union all
  -- 05 triggers (não internos)
  select '05 triggers', c.relname, string_agg(tg.tgname || case when tg.tgenabled = 'D' then ' (DESLIGADO)' else '' end, ', ' order by tg.tgname)
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not tg.tgisinternal and c.relname in (select t from alvo)
   group by c.relname
  union all
  -- 06 restrições (check / unique / fk) das tabelas de contagem e custo
  select '06 restrição', cl.relname || ' / ' || co.conname, pg_get_constraintdef(co.oid)
    from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
   where n.nspname = 'public' and cl.relname in ('estoque_contagens', 'estoque_contagens_itens', 'estoque_custos', 'estoque_itens', 'estoques')
     and co.contype in ('c', 'u', 'f', 'p')
  union all
  -- 07 índices únicos das tabelas de contagem
  select '07 índice', i.tablename || ' / ' || i.indexname, i.indexdef
    from pg_indexes i
   where i.schemaname = 'public' and i.tablename in ('estoque_contagens', 'estoque_contagens_itens', 'estoque_itens', 'estoque_custos')
  union all
  -- 08 quantidade de linhas por tabela (dinâmico: tabela ausente não quebra)
  select '08 linhas', e.t,
         (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', e.t), false, true, '')))[1]::text
    from existe e where e.oid is not null
  union all
  -- 09 unidades (id, nome)
  select '09 unidade', u.id::text, coalesce(to_jsonb(u) ->> 'nome', '-') from public.unidades u
  union all
  -- 10 estoques/locais por unidade
  select '10 estoques', x.unidade,
         (xpath('/row/r/text()', query_to_xml(format(
           $q$select string_agg(coalesce(to_jsonb(e)->>'nome','?') || ' [slug=' || coalesce(to_jsonb(e)->>'slug','?')
                    || ', tipo=' || coalesce(to_jsonb(e)->>'tipo','?') || ', status=' || coalesce(to_jsonb(e)->>'status','?')
                    || ', locais=' || coalesce(to_jsonb(e)->>'locais_internos','-') || ']', ' | '
                    order by coalesce((to_jsonb(e)->>'ordem')::int, 0), to_jsonb(e)->>'nome') as r
                from public.estoques e where e.unidade_id::text = %L$q$, x.unidade), false, true, '')))[1]::text
    from (select u.id::text as unidade from public.unidades u) x
   where to_regclass('public.estoques') is not null
  union all
  -- 11 insumos por unidade: total, ativos, por departamento, unidades de medida, com custo
  select '11 insumos', x.unidade,
         (xpath('/row/r/text()', query_to_xml(format(
           $q$select 'total=' || count(*)
                  || ' | ativo=' || coalesce(string_agg(distinct coalesce(to_jsonb(i)->>'ativo','(sem coluna)'), ','), '-')
                  || ' | departamentos=' || coalesce((select string_agg(d || ':' || n, ', ' order by d) from (select coalesce(to_jsonb(i2)->>'departamento','(nulo)') d, count(*) n from public.insumos i2 where i2.unidade_id::text = %1$L group by 1) s), '-')
                  || ' | unidade_medida=' || coalesce((select string_agg(d || ':' || n, ', ' order by d) from (select coalesce(to_jsonb(i3)->>'unidade_medida','(nulo)') d, count(*) n from public.insumos i3 where i3.unidade_id::text = %1$L group by 1) s), '-')
                  || ' | unidade_comercial=' || coalesce((select string_agg(d || ':' || n, ', ' order by d) from (select coalesce(to_jsonb(i4)->>'unidade_comercial','(nulo)') d, count(*) n from public.insumos i4 where i4.unidade_id::text = %1$L group by 1) s), '-')
                  || ' | com_custo_unitario=' || count(*) filter (where coalesce((to_jsonb(i)->>'custo_unitario')::numeric, 0) > 0)
                  || ' | com_custo_compra=' || count(*) filter (where coalesce((to_jsonb(i)->>'custo_compra')::numeric, 0) > 0)
                  || ' | categorias=' || count(distinct to_jsonb(i)->>'categoria') as r
                from public.insumos i where i.unidade_id::text = %1$L$q$, x.unidade), false, true, '')))[1]::text
    from (select u.id::text as unidade from public.unidades u) x
   where to_regclass('public.insumos') is not null
  union all
  -- 12 itens por estoque: vínculos, com saldo, com custo
  select '12 estoque_itens', x.unidade,
         (xpath('/row/r/text()', query_to_xml(format(
           $q$select string_agg(nome || ': itens=' || n || ' com_saldo=' || s || ' com_custo=' || c, ' | ' order by nome) as r from (
                select coalesce(to_jsonb(e)->>'nome', '?') as nome, count(ei.*) as n,
                       count(*) filter (where coalesce((to_jsonb(ei)->>'quantidade_atual')::numeric, 0) > 0) as s,
                       count(*) filter (where coalesce((to_jsonb(ei)->>'custo_unitario')::numeric, 0) > 0) as c
                  from public.estoque_itens ei join public.estoques e on e.id = ei.estoque_id
                 where ei.unidade_id::text = %L group by 1) z$q$, x.unidade), false, true, '')))[1]::text
    from (select u.id::text as unidade from public.unidades u) x
   where to_regclass('public.estoque_itens') is not null and to_regclass('public.estoques') is not null
  union all
  -- 13 contagens F2.1 já existentes (esperado: nenhuma)
  select '13 contagens', 'estoque_contagens por status/tipo',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(status || '/' || tipo || '=' || n, ', ') as r from (select status, tipo, count(*) n from public.estoque_contagens group by 1, 2) s$q$,
           false, true, '')))[1]::text, 'nenhuma')
   where to_regclass('public.estoque_contagens') is not null
  union all
  -- 14 funções de estoque: definer? executáveis por anon/authenticated?
  select '14 função', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'definer=' || p.prosecdef || ' | anon=' || has_function_privilege('anon', p.oid, 'execute')
         || ' | authenticated=' || has_function_privilege('authenticated', p.oid, 'execute')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like '%estoque%' or p.proname like '%contagem%' or p.proname like '%insumo%' or p.proname like 'compras%')
  union all
  -- 15 funções de autorização por unidade usadas nas policies
  select '15 auth', p.proname, 'existe | definer=' || p.prosecdef || ' | retorno=' || pg_get_function_result(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('auth_unidade_id', 'pode_ver_todas', 'fin_pode_acessar_unidade')
) x
order by secao, item;
