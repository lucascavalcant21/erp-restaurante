/* ═══════════════════════════════════════════════════════════════════════════
   SEC-EMPRESA-1 · isolamento entre empresas nas funções de permissão
   (14/10/2026) — S-23, S-24, S-29b, S-30

   POR QUE (lido no banco real, 14/10)
   - S-23  hefisto_user_in_unit (base de hefisto_user_can, usada em ~60
           policies e 10 funções) aceitava escopo "empresa" ou "todos" para
           QUALQUER unidade, inclusive de outra empresa. A função irmã
           hefisto_unidades_do_usuario já foi limitada na SEC-RLS-2; esta não.
           Latente: hoje há 1 empresa e nenhum escopo "empresa"/"todos".
   - S-24  hefisto_user_has_permission(uid, chave) e hefisto_user_in_unit(uid,
           unidade) aceitam o uid de OUTRA pessoa e eram executáveis por
           anônimo: qualquer um sondava as permissões de qualquer usuário.
   - S-29b hefisto_mark_password_changed() limpava locked_until: um usuário
           travado pelo administrador se destravava chamando a RPC.
   - S-30  quem tinha configuracoes.units.edit podia trocar unidades.empresa_id
           e levar a unidade para outra empresa.

   O QUE FAZ (só funções, grants e um gatilho; nenhum dado é alterado)
   1. hefisto_unidades_de(uid): as unidades de um usuário pela MESMA regra de
      hefisto_unidades_do_usuario() (unidade principal, escopos de unidade,
      escopo de empresa só da própria empresa). Só o servidor executa.
   2. hefisto_user_in_unit: passa a usar hefisto_unidades_de. Super admin e
      unidade nula continuam como hoje.
   3. hefisto_user_has_permission e hefisto_user_in_unit: perguntar por OUTRO
      uid só vale para o servidor (service_role) e o super admin. As policies
      e funções do banco passam sempre auth.uid() (conferido no catálogo).
   4. Anônimo perde EXECUTE em hefisto_user_has_permission, hefisto_user_in_unit,
      hefisto_user_can e hefisto_mark_password_changed (nenhuma policy de
      anon usa essas funções — conferido).
   5. hefisto_mark_password_changed não mexe mais em locked_until.
   6. Gatilho em unidades: empresa_id só muda pelo super admin ou pelo servidor.

   IMPACTO EM PRODUÇÃO (14/10): nenhum usuário muda de acesso — 1 empresa,
   1 unidade, 0 escopos "empresa"/"todos"; o teste compara antes e depois.

   ROLLBACK: db/security/SEC_EMPRESA_1_ROLLBACK.sql (textos exatos de hoje).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- ── 0. Preflight: aborta sem mudar nada se as funções não forem as de hoje ───
do $pf$
declare r record;
begin
  for r in select * from (values
      ('hefisto_user_has_permission', '0b03e4a6d6c8a3c703acef333052f630'),
      ('hefisto_user_in_unit',        '02c7d5336e5f3db29da0e508b3d83e4f'),
      ('hefisto_mark_password_changed','8c1fd3449f795da86db77c632532fdcf'),
      ('hefisto_unidades_do_usuario', 'df4e4c791e832fec9642921ac804db53')) v(f, h) loop
    if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = r.f
                      and md5(regexp_replace(p.prosrc, '\s', '', 'g')) = r.h) then
      raise exception 'SEC-EMPRESA-1: a função % não é a esperada. Nada foi alterado.', r.f;
    end if;
  end loop;
  if exists (select 1 from pg_proc where proname = 'hefisto_unidades_de') then
    raise exception 'SEC-EMPRESA-1: já aplicada (hefisto_unidades_de existe). Nada foi alterado.';
  end if;
end $pf$;

-- ── 1. Unidades de um usuário (mesma regra de hefisto_unidades_do_usuario) ──
create function public.hefisto_unidades_de(p_auth_user_id uuid) returns text[]
language sql stable security definer set search_path = public as $$
  with eu as (
    select u.id, u.unidade_principal_id from public.usuarios_erp u
     where u.auth_user_id = p_auth_user_id and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now())
  )
  select coalesce(array_agg(distinct x.unidade_id), '{}'::text[]) from (
    select eu.unidade_principal_id as unidade_id from eu where eu.unidade_principal_id is not null
    union
    select e.unidade_id from public.usuario_escopos e join eu on eu.id = e.usuario_id where e.unidade_id is not null
    union  -- escopo de empresa com empresa_id: as unidades dessa empresa
    select un.id from public.usuario_escopos e join eu on eu.id = e.usuario_id join public.unidades un on un.empresa_id = e.empresa_id
     where e.data_scope in ('empresa', 'todos') and e.empresa_id is not null
    union  -- escopo de empresa sem empresa_id: a empresa da unidade principal (nunca as outras)
    select un.id from public.usuario_escopos e join eu on eu.id = e.usuario_id
      join public.unidades up on up.id = eu.unidade_principal_id join public.unidades un on un.empresa_id = up.empresa_id
     where e.data_scope in ('empresa', 'todos') and e.empresa_id is null and up.empresa_id is not null
  ) x
$$;
revoke all on function public.hefisto_unidades_de(uuid) from public, anon, authenticated;
grant execute on function public.hefisto_unidades_de(uuid) to service_role;

-- ── 2 e 3. Unidade: só as da própria empresa; outro uid só servidor/super ───
create or replace function public.hefisto_user_in_unit(p_auth_user_id uuid, p_unidade_id text)
 returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
begin
  -- SEC-EMPRESA-1 (S-24): perguntar por outra pessoa só o servidor e o super admin.
  if p_auth_user_id is distinct from auth.uid() then
    if coalesce(auth.role(), '') <> 'service_role' and not public.pode_ver_todas() then
      return false;
    end if;
  end if;
  -- SEC-EMPRESA-1 (S-23): escopo "empresa"/"todos" vale só a própria empresa.
  return exists (
    select 1 from usuarios_erp u
     where u.auth_user_id = p_auth_user_id
       and (u.super_admin or p_unidade_id is null or p_unidade_id = any (public.hefisto_unidades_de(p_auth_user_id)))
  );
end $function$;

create or replace function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text)
 returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_user usuarios_erp%rowtype;
  v_local timestamp;
begin
  -- SEC-EMPRESA-1 (S-24): perguntar por outra pessoa só o servidor e o super admin.
  if p_auth_user_id is distinct from auth.uid() then
    if coalesce(auth.role(), '') <> 'service_role' and not public.pode_ver_todas() then
      return false;
    end if;
  end if;
  select * into v_user from usuarios_erp where auth_user_id = p_auth_user_id;
  if not found or v_user.status <> 'ativo' then return false; end if;
  if v_user.locked_until is not null and v_user.locked_until > now() then return false; end if;
  if v_user.valid_from is not null and v_user.valid_from > now() then return false; end if;
  if v_user.valid_until is not null and v_user.valid_until < now() then return false; end if;
  v_local := now() at time zone coalesce(v_user.timezone,'America/Sao_Paulo');
  if not (extract(dow from v_local)::smallint = any(v_user.allowed_days)) then return false; end if;
  if v_user.allowed_start_time is not null and v_local::time < v_user.allowed_start_time then return false; end if;
  if v_user.allowed_end_time is not null and v_local::time > v_user.allowed_end_time then return false; end if;
  if v_user.super_admin then return true; end if;
  if exists (
    select 1 from usuario_permissoes up
    where up.usuario_id = v_user.id and up.effect='deny'
      and hefisto_permission_match(up.permission_key, p_permission)
  ) then return false; end if;
  return exists (
    select 1 from usuario_permissoes up
    where up.usuario_id = v_user.id and up.effect='allow'
      and hefisto_permission_match(up.permission_key, p_permission)
  ) or exists (
    select 1 from perfil_permissoes pp
    where pp.perfil_id = v_user.perfil_id
      and hefisto_permission_match(pp.permission_key, p_permission)
  );
end $function$;

-- ── 4. Anônimo não sonda permissões ─────────────────────────────────────────
revoke execute on function public.hefisto_user_has_permission(uuid, text) from public, anon;
revoke execute on function public.hefisto_user_in_unit(uuid, text) from public, anon;
revoke execute on function public.hefisto_user_can(text, text) from public, anon;
revoke execute on function public.hefisto_mark_password_changed() from public, anon;
grant execute on function public.hefisto_user_has_permission(uuid, text) to authenticated, service_role;
grant execute on function public.hefisto_user_in_unit(uuid, text) to authenticated, service_role;
grant execute on function public.hefisto_user_can(text, text) to authenticated, service_role;
grant execute on function public.hefisto_mark_password_changed() to authenticated, service_role;

-- ── 5. Trocar a senha não destrava a conta ──────────────────────────────────
create or replace function public.hefisto_mark_password_changed()
 returns void language sql security definer set search_path to 'public' as $function$
  -- SEC-EMPRESA-1 (S-29b): locked_until é decisão do administrador.
  update usuarios_erp
  set exigir_troca_senha=false, senha_alterada_em=now(), failed_attempts=0
  where auth_user_id=auth.uid()
$function$;

-- ── 6. Unidade não muda de empresa (só super admin ou servidor) ─────────────
create function public.hefisto_unidade_empresa_imutavel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.empresa_id is distinct from old.empresa_id
     and coalesce(auth.role(), '') = 'authenticated' and not public.pode_ver_todas() then
    raise exception 'Só o administrador da plataforma muda a empresa de uma unidade.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.hefisto_unidade_empresa_imutavel() from public, anon, authenticated;
create trigger trg_unidade_empresa_imutavel before update of empresa_id on public.unidades
  for each row execute function public.hefisto_unidade_empresa_imutavel();

commit;

-- Verificação (impressão digital)
select has_function_privilege('anon', 'public.hefisto_user_has_permission(uuid,text)', 'execute') as anon_has_permission,
       has_function_privilege('anon', 'public.hefisto_user_in_unit(uuid,text)', 'execute') as anon_in_unit,
       has_function_privilege('authenticated', 'public.hefisto_unidades_de(uuid)', 'execute') as auth_unidades_de,
       (select prosrc ilike '%hefisto_unidades_de%' from pg_proc where proname = 'hefisto_user_in_unit') as in_unit_por_empresa,
       (select prosrc not ilike '%locked_until%' from pg_proc where proname = 'hefisto_mark_password_changed') as senha_nao_destrava,
       exists (select 1 from pg_trigger where tgname = 'trg_unidade_empresa_imutavel') as gatilho_empresa;
