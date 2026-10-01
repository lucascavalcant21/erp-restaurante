/* ═══════════════════════════════════════════════════════════════════════════
   SEC-EST-1 · PRÉVIA (SOMENTE LEITURA) — quem perde acesso a estoque_itens
   e estoque_lotes

   Rode ANTES de SEC_EST_1_ESTOQUE_ITENS_LOTES_POR_UNIDADE.sql. Só SELECT.
   Hoje as policies dessas duas tabelas são USING (true): qualquer usuário
   logado vê e altera os itens/lotes de QUALQUER unidade. Depois: só a própria
   unidade (a rede inteira para quem vê a rede), igual à SEC-FIN-1.

   Mesma regra de public.auth_unidade_id() e public.pode_ver_todas(),
   calculada aqui por usuário. Um único resultado. Nomes aparecem só na sua
   tela (não são gravados).
   ═══════════════════════════════════════════════════════════════════════════ */
with usuarios as (
  select u.id, u.nome, u.tipo_acesso,
         ( coalesce(u.super_admin, false)
           or exists (select 1 from public.usuario_escopos e
                       where e.usuario_id = u.id and e.data_scope in ('todos','empresa')) ) as ve_rede,
         coalesce(u.unidade_principal_id,
                  (select e.unidade_id from public.usuario_escopos e
                    where e.usuario_id = u.id and e.unidade_id is not null
                    order by e.unidade_id limit 1),
                  '') as unidade
    from public.usuarios_erp u
   where u.status = 'ativo' and u.auth_user_id is not null
),
tot as (select (select count(*) from public.estoque_itens) as itens, (select count(*) from public.estoque_lotes) as lotes),
por_usuario as (
  select u.*,
         (select itens from tot) as itens_antes, (select lotes from tot) as lotes_antes,
         case when u.ve_rede then (select itens from tot)
              else (select count(*) from public.estoque_itens i where i.unidade_id = u.unidade and u.unidade <> '') end as itens_depois,
         case when u.ve_rede then (select lotes from tot)
              else (select count(*) from public.estoque_lotes l where l.unidade_id = u.unidade and u.unidade <> '') end as lotes_depois
    from usuarios u
)
select * from (
  select 1 as ord, '01 total' as item, 'estoque_itens=' || (select itens from tot) || ' | estoque_lotes=' || (select lotes from tot) as resultado
  union all
  select 2, '02 estoque_itens por unidade: ' || coalesce(unidade_id, '(sem unidade)'), count(*)::text from public.estoque_itens group by unidade_id
  union all
  select 2, '02 estoque_lotes por unidade: ' || coalesce(unidade_id, '(sem unidade)'), count(*)::text from public.estoque_lotes group by unidade_id
  union all
  select 3, '03 linhas sem unidade válida (ficariam só para quem vê a rede)',
         'estoque_itens=' || (select count(*) from public.estoque_itens i where not exists (select 1 from public.unidades un where un.id = i.unidade_id))
         || ' | estoque_lotes=' || (select count(*) from public.estoque_lotes l where not exists (select 1 from public.unidades un where un.id = l.unidade_id))
  union all
  select 4, '04 policies HOJE (serão trocadas): ' || tablename || ' / ' || policyname,
         cmd || ' | papéis=' || array_to_string(roles, ',') || ' | USING=' || coalesce(qual, '-') || ' | CHECK=' || coalesce(with_check, '-')
    from pg_policies where schemaname = 'public' and tablename in ('estoque_itens', 'estoque_lotes')
  union all
  select 5, '05 usuários ativos', count(*)::text from usuarios
  union all
  select 6, '06 usuários que veem a rede (nada muda para eles)', count(*)::text from usuarios where ve_rede
  union all
  select 7, '07 usuários SEM unidade e sem rede (perdem TODO o acesso a itens/lotes)', count(*)::text from usuarios where not ve_rede and unidade = ''
  union all
  select 8, '08 usuários que PERDEM alguma linha', count(*)::text from por_usuario where itens_depois < itens_antes or lotes_depois < lotes_antes
  union all
  select 9, '09 ' || case when itens_depois < itens_antes or lotes_depois < lotes_antes then 'PERDE  ' else 'mantém ' end
            || coalesce(nome, '(sem nome)') || ' [' || coalesce(tipo_acesso, '?') || ']',
         'unidade=' || case when ve_rede then 'REDE' when unidade = '' then '(nenhuma)' else unidade end
         || ' | itens hoje=' || itens_antes || ' depois=' || itens_depois || ' | lotes hoje=' || lotes_antes || ' depois=' || lotes_depois
    from por_usuario
) x
order by ord, item;
