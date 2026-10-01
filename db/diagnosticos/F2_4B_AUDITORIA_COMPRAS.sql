/* ═══════════════════════════════════════════════════════════════════════════
   F2.4B · AUDITORIA DE COMPRAS NO BANCO REAL (SOMENTE LEITURA)

   O que já existe para compras e se é usado: fluxo antigo (pedidos_compra,
   recebimentos_compra, devoluções, notas_fiscais, preços por fornecedor),
   tabelas da F2.1 (compras, compras_itens, estoque_custos) e as ENTRADAS do
   Controle de Estoque (hoje a tela "Compras do mês" lê delas).
   Só SELECT/contagens; tabela ausente aparece como "NÃO EXISTE". Sem dados
   pessoais: só estrutura, contagens, datas e somas.
   ═══════════════════════════════════════════════════════════════════════════ */
with alvo(t) as (values
  ('pedidos_compra'), ('pedidos_compra_itens'), ('recebimentos_compra'), ('recebimentos_compra_itens'),
  ('devolucoes_fornecedor'), ('devolucoes_fornecedor_itens'), ('notas_fiscais'), ('estoque_movimentos'),
  ('insumos_fornecedores'), ('insumos_precos_historico'), ('fornecedores'),
  ('compras'), ('compras_itens'), ('estoque_custos'), ('estoque_movimentacoes_multi')
),
existe as (select t, to_regclass('public.' || t) as oid from alvo)
select * from (
  select '00 existe' as secao, e.t as item,
         case when e.oid is null then 'NÃO EXISTE'
              else 'tabela | linhas=' || (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', e.t), false, true, '')))[1]::text end as resultado
    from existe e
  union all
  select '01 colunas', c.table_name,
         string_agg(c.column_name || ' ' || c.data_type || case when c.is_nullable = 'NO' then ' NN' else '' end
                    || case when c.is_generated = 'ALWAYS' then ' G' else '' end, ', ' order by c.ordinal_position)
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name in (select t from alvo)
     and c.table_name not in ('compras', 'compras_itens', 'estoque_custos', 'estoque_movimentacoes_multi', 'fornecedores')
   group by c.table_name
  union all
  select '02 rls', e.t, 'rls=' || c.relrowsecurity
    from existe e join pg_class c on c.oid = e.oid
  union all
  select '03 policy', p.tablename || ' / ' || p.policyname,
         p.cmd || ' | papéis=' || array_to_string(p.roles, ',') || ' | USING=' || coalesce(p.qual, '-') || ' | CHECK=' || coalesce(p.with_check, '-')
    from pg_policies p
   where p.schemaname = 'public' and p.tablename in (select t from alvo)
     and p.tablename not in ('compras', 'compras_itens', 'estoque_custos')
  union all
  select '04 privilégios', g.table_name || ' → ' || g.grantee, string_agg(g.privilege_type, ',' order by g.privilege_type)
    from information_schema.role_table_grants g
   where g.table_schema = 'public' and g.table_name in (select t from alvo) and g.grantee in ('anon', 'authenticated')
   group by g.table_name, g.grantee
  union all
  -- 05 uso real: datas e volume do que já existe
  select '05 uso', x.t,
         coalesce((xpath('/row/r/text()', query_to_xml(format(
           $q$select 'de ' || coalesce(min(created_at)::date::text, '-') || ' até ' || coalesce(max(created_at)::date::text, '-')
                   || ' | últimos 30 dias=' || count(*) filter (where created_at >= now() - interval '30 days') as r from public.%I$q$, x.t), false, true, '')))[1]::text, '-')
    from (select t from existe where oid is not null and t not in ('estoque_custos')) x
   where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = x.t and c.column_name = 'created_at')
  union all
  -- 06 ENTRADAS do Controle de Estoque (fonte atual da tela "Compras do mês")
  select '06 entradas estoque', 'por mês (tipo=entrada)',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(mes || ': ' || n || ' entradas, com valor=' || cv || ', soma valor_total=' || round(sv, 2), ' | ' order by mes) as r from (
                select to_char(data_movimento, 'YYYY-MM') mes, count(*) n,
                       count(*) filter (where coalesce(valor_total, 0) > 0) cv, coalesce(sum(valor_total), 0) sv
                  from public.estoque_movimentacoes_multi where tipo = 'entrada' group by 1) s$q$, false, true, '')))[1]::text, 'nenhuma')
   where to_regclass('public.estoque_movimentacoes_multi') is not null
  union all
  select '06 entradas estoque', 'por tipo de movimento',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(tipo || '=' || n, ', ' order by tipo) as r from (select tipo, count(*) n from public.estoque_movimentacoes_multi group by 1) s$q$, false, true, '')))[1]::text, '-')
   where to_regclass('public.estoque_movimentacoes_multi') is not null
  union all
  -- 07 contas a pagar ligadas a compra/mercadoria (F2.1 + legado)
  select '07 contas_pagar', 'por origem_tipo',
         coalesce((select string_agg(coalesce(origem_tipo, '(nulo)') || '=' || n, ', ') from (select origem_tipo, count(*) n from public.contas_pagar group by 1) s), '-')
  union all
  select '07 contas_pagar', 'categoria mercadoria/CMV (código novo ou texto antigo)',
         (select count(*)::text || ' contas, soma=' || coalesce(round(sum(valor), 2), 0)::text from public.contas_pagar
           where categoria_codigo in ('mercadoria_insumos', 'legado_cmv') or lower(coalesce(categoria, '')) in ('cmv', 'mercadoria', 'insumos', 'compras'))
  union all
  -- 08 funções de compra/recebimento
  select '08 função', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'definer=' || p.prosecdef || ' | anon=' || has_function_privilege('anon', p.oid, 'execute') || ' | authenticated=' || has_function_privilege('authenticated', p.oid, 'execute')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like '%recebimento%' or p.proname like '%compra%' or p.proname like '%devolucao%' or p.proname like '%nota%' or p.proname like '%custo%')
  union all
  -- 09 custo/preço no cadastro de insumos (base do custo médio inicial)
  select '09 insumos', 'preço atualizado',
         'com preco_atualizado_em=' || count(*) filter (where preco_atualizado_em is not null)
         || ' | mais antigo=' || coalesce(min(preco_atualizado_em)::date::text, '-') || ' | mais recente=' || coalesce(max(preco_atualizado_em)::date::text, '-')
         || ' | com fornecedor_atual_id=' || count(*) filter (where fornecedor_atual_id is not null)
    from public.insumos
) x
order by secao, item;
