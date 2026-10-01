/* ═══════════════════════════════════════════════════════════════════════════
   F2.4C · AUDITORIA DE FATURAMENTO, PERDAS E CONTAGENS (SOMENTE LEITURA)

   Para decidir a FONTE OFICIAL do faturamento do CMV %, sem assumir tabela:
   onde as vendas são gravadas no Héfisto, desde quando, quanto por mês, e se
   existe alguma tabela de integração (Saipos/iFood). Também: como as perdas
   chegam ao banco e quais inventários já estão fechados.
   Só SELECT/contagens/somas; tabela ausente = "NÃO EXISTE". Sem dados pessoais.
   ═══════════════════════════════════════════════════════════════════════════ */
with alvo(t) as (values
  ('vendas'), ('venda_itens'), ('pedidos'), ('pedidos_itens'), ('comandas'), ('lancamentos'),
  ('pdv_caixas'), ('pdv_movimentacoes'), ('etiquetas'), ('etiqueta_perda'), ('etiqueta_financeiro_pendente'),
  ('estoque_contagens')
),
existe as (select t, to_regclass('public.' || t) as oid from alvo),
-- uma consulta dinâmica por tabela: "linhas | de .. até | últimos 30 dias" (tabela ausente não quebra)
uso as (
  select e.t,
         case when e.oid is null then 'NÃO EXISTE' else
           (xpath('/row/r/text()', query_to_xml(format(
             $q$select 'linhas=' || count(*) || ' | de ' || coalesce(min(d)::date::text, '-') || ' até ' || coalesce(max(d)::date::text, '-')
                     || ' | últimos 30 dias=' || count(*) filter (where d >= now() - interval '30 days') as r
                from (select (to_jsonb(x)->>'created_at')::timestamptz as d from public.%I x) s$q$, e.t), false, true, '')))[1]::text
         end as r
    from existe e
)
select * from (
  select '00 uso' as secao, u.t as item, coalesce(u.r, '-') as resultado from uso u
  union all
  -- 01 tabelas de integração/vendas externas que existam (Saipos, iFood, integrações)
  select '01 integração', c.relname, 'linhas≈' || c.reltuples::bigint
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (c.relname like '%saipos%' or c.relname like '%ifood%' or c.relname like '%integra%' or c.relname like '%marketplace%' or c.relname like '%venda%' or c.relname like '%faturamento%')
  union all
  -- 02 colunas das fontes de venda
  select '02 colunas', c.table_name, string_agg(c.column_name || ' ' || c.data_type, ', ' order by c.ordinal_position)
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name in ('vendas', 'pedidos', 'comandas', 'lancamentos', 'etiquetas', 'etiqueta_perda')
   group by c.table_name
  union all
  -- 03 vendas (PDV): por mês e status, soma do total
  select '03 vendas por mês', 'status / mês',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(coalesce(mes, '(sem data)') || ' ' || coalesce(st, '(nulo)') || ': ' || n || ' vendas, total=' || round(t, 2), ' | ' order by mes, st) as r from (
                select to_char((to_jsonb(v)->>'created_at')::timestamptz, 'YYYY-MM') mes, to_jsonb(v)->>'status' st, count(*) n, coalesce(sum((to_jsonb(v)->>'total')::numeric), 0) t
                  from public.vendas v group by 1, 2) s$q$, false, true, '')))[1]::text, 'nenhuma')
   where to_regclass('public.vendas') is not null
  union all
  -- 04 pedidos (mesas/delivery/salão): por mês, tipo e status, soma do total
  select '04 pedidos por mês', 'tipo / status / mês',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(coalesce(mes, '(sem data)') || ' ' || coalesce(tp, '?') || '/' || coalesce(st, '?') || ': ' || n || ' pedidos, total=' || round(t, 2), ' | ' order by mes, tp, st) as r from (
                select to_char((to_jsonb(p)->>'created_at')::timestamptz, 'YYYY-MM') mes, to_jsonb(p)->>'tipo_pedido' tp, to_jsonb(p)->>'status' st, count(*) n,
                       coalesce(sum(coalesce((to_jsonb(p)->>'total')::numeric, (to_jsonb(p)->>'valor_total')::numeric)), 0) t
                  from public.pedidos p group by 1, 2, 3) s$q$, false, true, '')))[1]::text, 'nenhum')
   where to_regclass('public.pedidos') is not null
  union all
  -- 05 lançamentos de entrada (extrato antigo): por mês e categoria
  select '05 lançamentos de entrada', 'categoria / mês',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(coalesce(mes, '(sem data)') || ' ' || coalesce(cat, '(nula)') || ': ' || n || ', total=' || round(t, 2), ' | ' order by mes, cat) as r from (
                select to_char(coalesce((to_jsonb(l)->>'data')::timestamptz, (to_jsonb(l)->>'created_at')::timestamptz), 'YYYY-MM') mes, to_jsonb(l)->>'categoria' cat, count(*) n,
                       coalesce(sum((to_jsonb(l)->>'valor')::numeric), 0) t
                  from public.lancamentos l where to_jsonb(l)->>'tipo' = 'entrada' group by 1, 2) s$q$, false, true, '')))[1]::text, 'nenhum')
   where to_regclass('public.lancamentos') is not null
  union all
  -- 06 perdas por etiqueta: quantas, de quando, valor (quantidade × custo da etiqueta)
  select '06 etiquetas por status', 'status / mês',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(coalesce(mes, '(sem data)') || ' ' || coalesce(st, '?') || ': ' || n || ', valor=' || round(t, 2), ' | ' order by mes, st) as r from (
                select to_char((to_jsonb(e)->>'created_at')::timestamptz, 'YYYY-MM') mes, to_jsonb(e)->>'status' st, count(*) n,
                       coalesce(sum(coalesce((to_jsonb(e)->>'quantidade')::numeric, 0) * coalesce((to_jsonb(e)->>'custo_unit')::numeric, 0)), 0) t
                  from public.etiquetas e group by 1, 2) s$q$, false, true, '')))[1]::text, 'nenhuma')
   where to_regclass('public.etiquetas') is not null
  union all
  -- 07 saídas de estoque marcadas como perda (Controle de Estoque)
  select '07 saídas de estoque', 'perda × consumo × outras (últimos 90 dias)',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select 'perda=' || count(*) filter (where observacao ilike 'perda%') || ' | consumo por etiqueta=' || count(*) filter (where observacao ilike 'consumo%')
                   || ' | outras saídas=' || count(*) filter (where not (observacao ilike 'perda%' or observacao ilike 'consumo%') or observacao is null)
                   || ' | transferências=' || (select count(*) from public.estoque_movimentacoes_multi where tipo like 'transferencia%') as r
                from public.estoque_movimentacoes_multi where tipo = 'saida' and data_movimento >= now() - interval '90 days'$q$, false, true, '')))[1]::text, '-')
   where to_regclass('public.estoque_movimentacoes_multi') is not null
  union all
  -- 08 contas a pagar de perda (caminho antigo das etiquetas)
  select '08 contas de perda', 'categoria inventarios / "Perda de Validade"',
         (select count(*)::text || ' contas, soma=' || coalesce(round(sum(valor), 2), 0)::text from public.contas_pagar
           where categoria = 'inventarios' or descricao ilike 'perda de validade%')
  union all
  -- 09 inventários: quais já estão fechados (base dos períodos do CMV)
  select '09 inventários', coalesce(c.data_referencia::text, '-') || ' / ' || c.tipo || ' / ' || c.status,
         'local=' || coalesce(c.estoque_id::text, 'unidade inteira') || ' | itens=' || (select count(*) from public.estoque_contagens_itens i where i.contagem_id = c.id)
         || ' | valor=' || coalesce((select round(sum(i.valor_total), 2)::text from public.estoque_contagens_itens i where i.contagem_id = c.id), '-')
         || ' | fechada_em=' || coalesce(c.fechada_em::text, '-')
    from public.estoque_contagens c
  union all
  -- 10 compras e custo médio já existentes
  select '10 compras', 'por status', coalesce((select string_agg(status || '=' || n, ', ') from (select status, count(*) n from public.compras group by 1) s), 'nenhuma')
  union all
  select '10 custo médio', 'produtos com custo', (select count(*)::text from public.estoque_custos)
  union all
  -- 11 departamentos e categorias de insumos (para separar CMV de consumo operacional)
  select '11 insumos', 'departamento', coalesce((select string_agg(d || '=' || n, ', ' order by d) from (select coalesce(departamento, '(nulo)') d, count(*) n from public.insumos group by 1) s), '-')
  union all
  select '11 insumos', 'categorias', coalesce((select string_agg(c || '=' || n, ', ' order by n desc) from (select coalesce(categoria, '(nula)') c, count(*) n from public.insumos group by 1) s), '-')
) x
order by secao, item;
