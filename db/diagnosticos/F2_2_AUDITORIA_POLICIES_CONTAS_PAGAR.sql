/* ═══════════════════════════════════════════════════════════════════════════
   F2.2 — AUDITORIA DAS POLICIES DE contas_pagar (SOMENTE LEITURA)
   Só SELECT em pg_catalog / information_schema. Não altera nada.
   Um único resultado (item, resultado). Rodar sozinho no SQL Editor.
   ═══════════════════════════════════════════════════════════════════════════ */
select * from (
  select 1 as ord, 'policy: ' || p.polname as item,
         'comando=' || case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE'
                                     when 'd' then 'DELETE' when '*' then 'ALL' end
         || ' | tipo=' || case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end
         || ' | papéis=' || coalesce((select string_agg(case when r = 0 then 'public' else pg_get_userbyid(r) end, ',')
                                      from unnest(p.polroles) r), '?')
         || ' | USING=' || coalesce(pg_get_expr(p.polqual, p.polrelid), '(nenhum)')
         || ' | WITH CHECK=' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '(nenhum)') as resultado
    from pg_policy p
   where p.polrelid = 'public.contas_pagar'::regclass
  union all
  select 2, 'RLS ligado / forçado em contas_pagar',
         c.relrowsecurity::text || ' / ' || c.relforcerowsecurity::text
    from pg_class c where c.oid = 'public.contas_pagar'::regclass
  union all
  select 3, 'privilégios em contas_pagar: ' || grantee,
         string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'contas_pagar' and grantee in ('anon', 'authenticated', 'PUBLIC')
   group by grantee
  union all
  select 4, 'unidades com contas (para medir exposição)', count(distinct unidade_id)::text
    from public.contas_pagar
  union all
  select 5, 'usuários ativos sem "ver a rede"', count(*)::text
    from public.usuarios_erp u
   where u.status = 'ativo' and not coalesce(u.super_admin, false)
     and not exists (select 1 from public.usuario_escopos e where e.usuario_id = u.id and e.data_scope in ('todos','empresa'))
) x
order by ord, item;
