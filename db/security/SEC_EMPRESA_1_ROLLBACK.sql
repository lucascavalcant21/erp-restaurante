/* SEC-EMPRESA-1 · ROLLBACK — volta as funções EXATAMENTE como estavam em
   14/10/2026 (texto lido do banco real), devolve o EXECUTE de anônimo e
   remove hefisto_unidades_de e o gatilho de empresa da unidade.
   Não rodar sem decisão do dono: reabre S-23, S-24, S-29b e S-30. */

begin;

drop trigger if exists trg_unidade_empresa_imutavel on public.unidades;
drop function if exists public.hefisto_unidade_empresa_imutavel();

create or replace function public.hefisto_user_in_unit(p_auth_user_id uuid, p_unidade_id text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (
    select 1
    from usuarios_erp u
    where u.auth_user_id = p_auth_user_id
      and (
        u.super_admin
        or p_unidade_id is null
        or u.unidade_principal_id = p_unidade_id
        or exists (
          select 1 from usuario_escopos e
          where e.usuario_id=u.id
            and (e.data_scope in ('todos','empresa') or e.unidade_id=p_unidade_id)
        )
      )
  )
$function$;

create or replace function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text)
 returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_user usuarios_erp%rowtype;
  v_local timestamp;
begin
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

create or replace function public.hefisto_mark_password_changed()
 returns void language sql security definer set search_path to 'public' as $function$
  update usuarios_erp
  set exigir_troca_senha=false, senha_alterada_em=now(), failed_attempts=0, locked_until=null
  where auth_user_id=auth.uid()
$function$;

grant execute on function public.hefisto_user_has_permission(uuid, text) to anon, authenticated, service_role;
grant execute on function public.hefisto_user_in_unit(uuid, text) to anon, authenticated, service_role;
grant execute on function public.hefisto_user_can(text, text) to anon, authenticated, service_role;
grant execute on function public.hefisto_mark_password_changed() to anon, authenticated, service_role;

drop function if exists public.hefisto_unidades_de(uuid);

commit;
