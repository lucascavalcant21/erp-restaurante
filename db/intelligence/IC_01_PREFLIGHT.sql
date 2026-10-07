/* ═══════════════════════════════════════════════════════════════════════════
   IC-01 · PREFLIGHT (SOMENTE LEITURA)

   Rode ANTES de IC_01_INTELLIGENCE_CORE.sql, no SQL Editor do Supabase.
   É um único SELECT sobre o catálogo do Postgres: não grava, não lê dados de
   negócio (só nomes de tabelas/colunas/funções e estimativas de linhas).

   Resultado: uma linha por verificação, com situacao =
     OK         pode seguir
     ATENÇÃO    não impede a migração; afeta só o que está no detalhe
     BLOQUEIA   NÃO aplique a IC-01 até resolver
   A coluna "definicao" traz o código das funções de acesso e da
   estoque_movimentar, para revisão humana antes da migração.
   ═══════════════════════════════════════════════════════════════════════════ */

with
papeis as (
  select r.papel, exists (select 1 from pg_roles where rolname = r.papel) as existe
  from unnest(array['anon','authenticated','service_role']) as r(papel)
),
base as (
  select 'public.unidades.id é text' as item,
         (select data_type from information_schema.columns
          where table_schema = 'public' and table_name = 'unidades' and column_name = 'id') as tipo
),
funcoes_esperadas(assinatura, essencial, papel_execucao) as (
  values
    ('public.hefisto_user_can(text,text)', true, 'authenticated'),
    ('public.hefisto_user_in_unit(uuid,text)', true, 'authenticated'),
    ('public.hefisto_contexto_requisicao(text)', true, 'authenticated'),
    ('public.hefisto_user_has_permission(uuid,text)', false, 'service_role'),
    ('public.hefisto_tem_alguma_permissao(uuid,text[])', false, 'service_role'),
    ('public.hefisto_usuario_valido(uuid)', false, 'service_role'),
    ('public.hefisto_unidades_do_usuario(uuid)', false, 'service_role'),
    ('public.hefisto_permission_match(text,text)', false, 'service_role'),
    ('auth.uid()', true, 'authenticated'),
    ('gen_random_uuid()', true, 'service_role')
),
funcoes as (
  select f.assinatura, f.essencial, f.papel_execucao, to_regprocedure(f.assinatura) as oid
  from funcoes_esperadas f
),
movimentar as (
  select p.oid, p.oid::regprocedure::text as assinatura
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'estoque_movimentar'
),
nomes_da_ic01(nome, tabela_dona) as (
  values
    ('intelligence_eventos', null), ('intelligence_acoes', null), ('intelligence_feedback', null), ('intelligence_preferencias', null),
    ('intelligence_eventos_usuario', 'intelligence_eventos'), ('intelligence_eventos_correlacao', 'intelligence_eventos'),
    ('intelligence_eventos_acao', 'intelligence_eventos'), ('intelligence_acoes_usuario', 'intelligence_acoes'),
    ('intelligence_feedback_unidade', 'intelligence_feedback'), ('intelligence_feedback_entidade', 'intelligence_feedback')
),
colisoes as (
  select x.nome, c.relkind, coalesce(obj_description(c.oid, 'pg_class'), '') as comentario,
         (select t.relname from pg_index i join pg_class t on t.oid = i.indrelid where i.indexrelid = c.oid) as indexa,
         x.tabela_dona
  from nomes_da_ic01 x
  join pg_class c on c.relname = x.nome
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
),
-- colunas que o Intelligence Core lê (app/lib/intelligence/**). Falta de uma
-- delas não quebra a migração: a métrica responde DADOS INSUFICIENTES.
uso(tabela, colunas) as (
  values
    ('fin_faturamento_diario', array['unidade_id','data','vendas_brutas','cancelamentos','descontos','receita','fonte']),
    ('vw_compras', array['unidade_id','id','data_compra','data_recebimento','status','valor_total','valor_itens','fornecedor_id','confirmada_em','created_at']),
    ('compras_itens', array['unidade_id','id','compra_id','insumo_id','descricao_snapshot','quantidade_embalagens','conteudo_por_embalagem','quantidade_base','unidade_base','valor_total']),
    ('insumos', array['unidade_id','id','nome','nome_interno','marca','unidade_medida','categoria','departamento','tamanho_embalagem','unidade_comercial','unidade_conteudo','permite_fracionado']),
    ('estoques', array['unidade_id','id','nome','status']),
    ('estoque_itens', array['unidade_id','estoque_id','insumo_id','quantidade_atual','estoque_minimo','validade']),
    ('estoque_lotes', array['unidade_id','estoque_id','insumo_id','validade','quantidade']),
    ('estoque_custos', array['unidade_id','insumo_id','custo_medio_base']),
    ('estoque_contagens', array['unidade_id','id','tipo','data_referencia','status','estoque_id','fechada_em']),
    ('estoque_contagens_itens', array['unidade_id','insumo_id','estoque_id','quantidade_contada','quantidade_sistema','unidade_base','custo_unitario','diferenca']),
    ('estoque_movimentacoes_multi', array['unidade_id','id','insumo_id','quantidade','valor_total','motivo','data_movimento','unidade_medida','estorno_de_id']),
    ('etiquetas', array['unidade_id','codigo','produto','validade_em','quantidade','unidade','status']),
    ('vw_fin_contas_pagar', array['unidade_id','id','descricao','fornecedor_id','saldo','valor_original','data_vencimento','situacao','vencida','categoria_codigo']),
    ('fornecedores', array['unidade_id','id','nome']),
    ('colaboradores', array['unidade_id','id','salario','vale_alimentacao','tipo_contrato','status','ativo']),
    ('rh_recibos_prestacao', array['unidade_id','valor_total','data_pagamento','data_trabalho','pagamento_realizado'])
),
fontes as (
  select u.tabela, c.oid, c.relkind, c.relrowsecurity, c.reloptions, greatest(c.reltuples, 0)::bigint as linhas_estimadas,
         array(select col from unnest(u.colunas) col
               where not exists (select 1 from information_schema.columns ic
                                 where ic.table_schema = 'public' and ic.table_name = u.tabela and ic.column_name = col)) as faltando
  from uso u
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relname = u.tabela and c.relnamespace = n.oid
),
linhas as (
  -- 1. ambiente
  select 10 as ordem, 'ambiente' as grupo, 'versão do Postgres' as item, 'OK' as situacao,
         current_setting('server_version') || ' · banco ' || current_database() || ' · rodando como ' || current_user as detalhe, null::text as definicao
  union all
  select 11, 'ambiente', 'papel ' || papel, case when existe then 'OK' else 'BLOQUEIA' end,
         case when existe then 'existe' else 'papel do Supabase ausente' end, null
  from papeis
  union all
  select 12, 'ambiente', 'schema auth', case when exists (select 1 from pg_namespace where nspname = 'auth') then 'OK' else 'BLOQUEIA' end, '', null
  -- 2. base
  union all
  select 20, 'base', item, case when tipo = 'text' then 'OK' else 'BLOQUEIA' end, coalesce(tipo, 'coluna ausente'), null from base
  union all
  select 21, 'base', 'public.' || t, case when to_regclass('public.' || t) is not null then 'OK' else 'BLOQUEIA' end,
         case when to_regclass('public.' || t) is not null then 'existe' else 'ausente' end, null
  from unnest(array['unidades','usuarios_erp','empresas','perfis_acesso','perfil_permissoes','usuario_permissoes','usuario_escopos']) t
  union all
  select 22, 'base', 'public.unidades.empresa_id',
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'unidades' and column_name = 'empresa_id') then 'OK' else 'ATENÇÃO' end,
         'a empresa da unidade vem do banco (hefisto_contexto_requisicao)', null
  -- 3. funções de acesso
  union all
  select 30, 'funções', f.assinatura,
         case when f.oid is null then (case when f.essencial then 'BLOQUEIA' else 'ATENÇÃO' end)
              when f.papel_execucao = 'authenticated' and exists (select 1 from pg_roles where rolname = 'authenticated')
                   and not has_function_privilege('authenticated', f.oid, 'EXECUTE') and f.assinatura <> 'gen_random_uuid()' then 'BLOQUEIA'
              else 'OK' end,
         case when f.oid is null then 'ausente'
              else concat_ws(' · ',
                case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
                case p.provolatile when 'i' then 'IMMUTABLE' when 's' then 'STABLE' else 'VOLATILE' end,
                'search_path=' || coalesce((select string_agg(cfg, ',') from unnest(p.proconfig) cfg where cfg like 'search_path=%'), '(não fixado)'),
                'retorna ' || pg_get_function_result(p.oid),
                'authenticated executa: ' || case when exists (select 1 from pg_roles where rolname = 'authenticated') then has_function_privilege('authenticated', p.oid, 'EXECUTE')::text else 'n/a' end,
                'anon executa: ' || case when exists (select 1 from pg_roles where rolname = 'anon') then has_function_privilege('anon', p.oid, 'EXECUTE')::text else 'n/a' end)
         end,
         case when f.oid is not null and f.assinatura not in ('auth.uid()', 'gen_random_uuid()') then pg_get_functiondef(f.oid) end
  from funcoes f left join pg_proc p on p.oid = f.oid
  -- 4. estoque_movimentar (registrar perda usa a MESMA função da tela)
  union all
  select 40, 'estoque', 'estoque_movimentar', 'OK',
         m.assinatura || ' · ' || case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end
           || ' · authenticated executa: ' || case when exists (select 1 from pg_roles where rolname = 'authenticated') then has_function_privilege('authenticated', m.oid, 'EXECUTE')::text else 'n/a' end,
         pg_get_functiondef(m.oid)
  from movimentar m join pg_proc p on p.oid = m.oid
  union all
  select 41, 'estoque', 'estoque_movimentar', 'ATENÇÃO', 'ausente: registrar perda pela inteligência ficará indisponível (EST-MOV-1 não aplicada)', null
  where not exists (select 1 from movimentar)
  -- 5. colisão de nomes
  union all
  select 50, 'colisão', 'public.' || nome,
         case when relkind = 'r' and comentario like 'hefisto:ic-01%' then 'OK'
              when relkind = 'i' and indexa = tabela_dona then 'OK'
              else 'BLOQUEIA' end,
         case when relkind = 'r' and comentario like 'hefisto:ic-01%' then 'já aplicada antes: ' || comentario
              when relkind = 'i' and indexa = tabela_dona then 'índice da própria IC-01'
              else 'já existe objeto com este nome que NÃO é da IC-01 (tipo ' || relkind::text || coalesce(', indexa ' || indexa, '') || ')' end,
         null
  from colisoes
  union all
  select 51, 'colisão', 'nomes intelligence_*', 'OK', 'nenhum objeto com os nomes da IC-01', null
  where not exists (select 1 from colisoes)
  union all
  select 52, 'colisão', 'public.intelligence_eventos_imutavel_trg()',
         case when coalesce(obj_description(p.oid, 'pg_proc'), '') like 'hefisto:ic-01%' then 'OK' else 'BLOQUEIA' end,
         coalesce(obj_description(p.oid, 'pg_proc'), 'existe e NÃO é da IC-01'), null
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'intelligence_eventos_imutavel_trg'
  -- 6. fontes de dados da inteligência
  union all
  select 60, 'fontes', 'public.' || tabela,
         case when oid is null or cardinality(faltando) > 0 then 'ATENÇÃO' else 'OK' end,
         case when oid is null then 'ausente: as métricas que dependem dela respondem DADOS INSUFICIENTES'
              else concat_ws(' · ',
                case relkind when 'r' then 'tabela' when 'v' then 'view' when 'm' then 'view materializada' else relkind::text end,
                case when relkind = 'r' then 'RLS ' || case when relrowsecurity then 'ligado' else 'DESLIGADO' end
                     when relkind = 'v' then 'security_invoker=' || coalesce((select split_part(o, '=', 2) from unnest(reloptions) o where o like 'security_invoker=%'), 'false (a view usa o dono para ler; a inteligência filtra a unidade no servidor)')
                end,
                '~' || linhas_estimadas || ' linhas (estimativa do catálogo)',
                case when cardinality(faltando) > 0 then 'colunas ausentes: ' || array_to_string(faltando, ', ') end,
                case when exists (select 1 from pg_roles where rolname = 'authenticated') and not has_table_privilege('authenticated', oid, 'SELECT')
                     then 'authenticated SEM select (a consulta com o token do usuário falha)' end)
         end, null
  from fontes
)
select ordem, grupo, item, situacao, detalhe, definicao
from linhas
order by case situacao when 'BLOQUEIA' then 0 when 'ATENÇÃO' then 1 else 2 end, ordem, item;
