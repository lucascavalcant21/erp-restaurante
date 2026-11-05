/* Desfaz a MARM-UNIDADE-2. Só com decisão do dono. Quem já entrou mantém o escopo:
   para tirar, apague as linhas de usuario_escopos da unidade `marmitaria`. */
begin;
create or replace function public.hefisto_user_can(p_permission text, p_unidade_id text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select hefisto_user_has_permission(auth.uid(), p_permission) and hefisto_user_in_unit(auth.uid(), p_unidade_id)
$$;
create or replace function public.marmitaria_senha_definida(p_unidade_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public._marmitaria_ve_unidade(p_unidade_id) then return false; end if;
  return exists (select 1 from public.estoque_seguranca where unidade_id = p_unidade_id);
end $$;
create or replace function public.marmitaria_conferir_senha(p_unidade_id text, p_senha text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_erro text;
begin
  if auth.uid() is null or not public._marmitaria_ve_unidade(p_unidade_id) then
    return jsonb_build_object('ok', false, 'erro', 'Seu usuário não tem acesso à marmitaria.');
  end if;
  if not exists (select 1 from public.estoque_seguranca where unidade_id = p_unidade_id) then
    return jsonb_build_object('ok', false, 'erro', 'A senha da marmitaria ainda não foi criada.');
  end if;
  v_erro := public._estoque_conferir_pin(p_unidade_id, p_senha);
  if v_erro is not null then return jsonb_build_object('ok', false, 'erro', replace(v_erro, 'PIN', 'Senha')); end if;
  return jsonb_build_object('ok', true);
end $$;
drop function if exists public._marmitaria_usuario_da_empresa(text);
commit;
