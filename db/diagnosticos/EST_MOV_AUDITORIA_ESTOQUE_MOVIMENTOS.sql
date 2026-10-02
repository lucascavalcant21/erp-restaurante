/* ═══════════════════════════════════════════════════════════════════════════
   CONTAGEM / MOVIMENTAÇÕES · AUDITORIA DO BANCO REAL (SOMENTE LEITURA)

   Antes de reestruturar entrada/retirada/estorno/ajuste: como o saldo é
   gravado HOJE em produção (corpo real das funções de lote/FEFO, bebidas e
   contagem), quem pode escrever no histórico, e o modelo de permissões
   (hefisto_user_can) que as funções novas vão usar. Só SELECT; um resultado.
   Sem dados pessoais: só estrutura, contagens e o texto das funções.
   ═══════════════════════════════════════════════════════════════════════════ */
select * from (
  -- 01 corpo das funções que mexem no saldo (para não criar FEFO paralelo)
  select '01 função' as secao, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as item,
         'definer=' || p.prosecdef || ' | anon=' || has_function_privilege('anon', p.oid, 'execute')
         || ' | auth=' || has_function_privilege('authenticated', p.oid, 'execute') || E'\n' || pg_get_functiondef(p.oid) as resultado
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'sincronizar_item_por_lotes', 'entrada_lote_estoque', 'saida_lote_estoque', 'registrar_movimento_estoque_lote',
     'registrar_movimento_estoque_multi', 'registrar_contagem_estoque_multi', 'sincronizar_lotes_apos_contagem',
     'transferir_lotes_estoque', 'transferir_item_entre_estoques', 'registrar_movimento_estoque',
     'bebida_conteudo', 'bebida_entrada_unidades', 'bebida_baixa_unidades', 'bebida_baixa_conteudo', 'bebida_contagem', 'bebida_zerar',
     'hefisto_user_can', 'hefisto_user_has_permission', 'hefisto_user_in_unit', 'etiqueta_perda')
  union all
  -- 02 colunas e restrições do histórico, dos itens e dos lotes
  select '02 colunas', c.table_name, string_agg(c.column_name || ' ' || c.data_type || case when c.is_nullable = 'NO' then ' NN' else '' end, ', ' order by c.ordinal_position)
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name in ('estoque_movimentacoes_multi', 'estoque_itens', 'estoque_lotes', 'estoque_atual', 'insumos', 'config_sistema', 'usuarios_erp', 'perfis', 'perfil_permissoes', 'usuario_permissoes')
   group by c.table_name
  union all
  select '03 restrição', cl.relname || ' / ' || co.conname, pg_get_constraintdef(co.oid)
    from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
   where n.nspname = 'public' and cl.relname in ('estoque_movimentacoes_multi', 'estoque_lotes') and co.contype in ('c', 'u', 'f')
  union all
  -- 04 triggers nessas tabelas
  select '04 trigger', c.relname || ' / ' || tg.tgname, pg_get_triggerdef(tg.oid)
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not tg.tgisinternal and c.relname in ('estoque_movimentacoes_multi', 'estoque_itens', 'estoque_lotes', 'estoque_atual')
  union all
  -- 05 quem pode escrever (privilégios e policies)
  select '05 privilégios', g.table_name || ' → ' || g.grantee, string_agg(g.privilege_type, ',' order by g.privilege_type)
    from information_schema.role_table_grants g
   where g.table_schema = 'public' and g.table_name in ('estoque_movimentacoes_multi', 'estoque_itens', 'estoque_lotes', 'estoque_atual', 'config_sistema')
     and g.grantee in ('anon', 'authenticated')
   group by g.table_name, g.grantee
  union all
  select '06 policy', p.tablename || ' / ' || p.policyname, p.cmd || ' | ' || array_to_string(p.roles, ',') || ' | USING=' || coalesce(p.qual, '-') || ' | CHECK=' || coalesce(p.with_check, '-')
    from pg_policies p where p.schemaname = 'public' and p.tablename in ('estoque_movimentacoes_multi', 'estoque_atual', 'config_sistema')
  union all
  -- 07 o que já está no histórico (tipos e origens pela observação)
  select '07 histórico', 'tipo / mês', coalesce((select string_agg(tipo || ' ' || mes || '=' || n, ', ' order by mes, tipo) from (
     select tipo, to_char(data_movimento, 'YYYY-MM') mes, count(*) n from public.estoque_movimentacoes_multi group by 1, 2) s), '-')
  union all
  select '07 histórico', 'origens (início da observação)', coalesce((select string_agg(o || '=' || n, ', ' order by n desc) from (
     select coalesce(split_part(observacao, ' ', 1), '(vazia)') o, count(*) n from public.estoque_movimentacoes_multi group by 1 order by 2 desc limit 15) s), '-')
  union all
  select '07 histórico', 'com usuário / sem usuário', (select count(*) filter (where usuario_id is not null) || ' / ' || count(*) filter (where usuario_id is null) from public.estoque_movimentacoes_multi)
  union all
  -- 08 saldo: itens × lotes (quantos itens têm saldo que não bate com a soma dos lotes)
  select '08 saldo × lotes', 'itens divergentes / itens com saldo',
         (select count(*) filter (where abs(coalesce(i.quantidade_atual, 0) - coalesce(l.soma, 0)) > 0.0005) || ' / ' || count(*) filter (where coalesce(i.quantidade_atual, 0) > 0)
            from public.estoque_itens i
            left join (select estoque_id, insumo_id, sum(quantidade) soma from public.estoque_lotes group by 1, 2) l
              on l.estoque_id = i.estoque_id and l.insumo_id = i.insumo_id)
  union all
  -- 09 permissões: perfis e chaves de estoque; papéis dos usuários ativos
  select '09 usuários', 'ativos por perfil / super_admin',
         coalesce((select string_agg(coalesce(t, '?') || case when sa then ' (super)' else '' end || '=' || n, ', ' order by n desc)
            from (select tipo_acesso t, coalesce(super_admin, false) sa, count(*) n from public.usuarios_erp where status = 'ativo' group by 1, 2) u), '-')
  union all
  select '09 permissões de estoque', 'chaves concedidas em perfis',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(distinct permission_key, ', ') as r from public.perfil_permissoes where permission_key like 'estoque.%'$q$, false, true, '')))[1]::text, '(sem tabela ou sem chaves)')
   where to_regclass('public.perfil_permissoes') is not null
  union all
  -- 10 hash para o PIN: extensão pgcrypto disponível?
  select '10 extensão', e.extname, 'schema=' || n.nspname || ' versão=' || e.extversion
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname in ('pgcrypto')
  union all
  -- 11 parâmetros de estoque já guardados em config_sistema
  select '11 config', 'chaves com estoque/contagem/pin',
         coalesce((xpath('/row/r/text()', query_to_xml(
           $q$select string_agg(distinct k, ', ') as r from public.config_sistema c, jsonb_object_keys(coalesce(to_jsonb(c)->'params', '{}'::jsonb)) k
               where k ilike '%estoque%' or k ilike '%contagem%' or k ilike '%pin%' or k ilike '%inventario%'$q$, false, true, '')))[1]::text, 'nenhuma')
   where to_regclass('public.config_sistema') is not null
) x
order by secao, item;
