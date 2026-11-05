/* MARM-UNIDADE-2: quem tem a senha entra na marmitaria (05/11/2026, decisão do dono).

   O dono passa a senha aos funcionários, sem configurar cada usuário. Com a senha
   certa, o usuário ativo da mesma empresa recebe o escopo da unidade `marmitaria`.
   Dentro dela, opera o estoque e confirma compras. Fora dela, nada muda.

   Altera hefisto_user_can só para p_unidade_id = 'marmitaria'. Segurança do
   estoque e cancelamento de compra continuam só com permissão própria.
   ROLLBACK: db/marmitaria/MARM_UNIDADE_2_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regprocedure('public.marmitaria_conferir_senha(text,text)') is null then
    raise exception 'MARM-UNIDADE-2: aplique a MARM-UNIDADE-1 antes. Nada foi alterado.';
  end if;
end $$;

create or replace function public._marmitaria_usuario_da_empresa(p_unidade_id text)
returns uuid language sql stable security definer set search_path = public as $$
  select u.id
    from public.usuarios_erp u
    join public.unidades alvo on alvo.id = p_unidade_id
    left join public.unidades casa on casa.id = u.unidade_principal_id
   where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now())
     and (u.super_admin or casa.empresa_id = alvo.empresa_id)
$$;

create or replace function public.marmitaria_senha_definida(p_unidade_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if public._marmitaria_usuario_da_empresa(p_unidade_id) is null then return false; end if;
  return exists (select 1 from public.estoque_seguranca where unidade_id = p_unidade_id);
end $$;

create or replace function public.marmitaria_conferir_senha(p_unidade_id text, p_senha text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_erro text; v_usuario uuid;
begin
  if p_unidade_id is distinct from 'marmitaria' then
    return jsonb_build_object('ok', false, 'erro', 'Unidade inválida.');
  end if;
  v_usuario := public._marmitaria_usuario_da_empresa(p_unidade_id);
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'erro', 'Seu usuário não tem acesso à marmitaria.');
  end if;
  if not exists (select 1 from public.estoque_seguranca where unidade_id = p_unidade_id) then
    return jsonb_build_object('ok', false, 'erro', 'A senha da marmitaria ainda não foi criada.');
  end if;
  v_erro := public._estoque_conferir_pin(p_unidade_id, p_senha);
  if v_erro is not null then return jsonb_build_object('ok', false, 'erro', replace(v_erro, 'PIN', 'Senha')); end if;
  insert into public.usuario_escopos (usuario_id, unidade_id, data_scope) values (v_usuario, p_unidade_id, 'unidade')
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.hefisto_user_can(p_permission text, p_unidade_id text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select (hefisto_user_has_permission(auth.uid(), p_permission) and hefisto_user_in_unit(auth.uid(), p_unidade_id))
    or (p_unidade_id = 'marmitaria' and p_permission like 'estoque.%' and p_permission not like 'estoque.security.%' and p_permission <> 'estoque.purchases.cancel'
        and exists (select 1 from usuarios_erp u join usuario_escopos e on e.usuario_id = u.id
                     where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now()) and e.unidade_id = 'marmitaria'))
$$;

revoke all on function public._marmitaria_usuario_da_empresa(text) from public, anon, authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.marmitaria_conferir_senha(text,text)', 'execute') then raise exception 'MARM-UNIDADE-2: anon não pode executar.'; end if;
end $$;

commit;
