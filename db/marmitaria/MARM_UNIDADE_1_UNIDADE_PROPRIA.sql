/* MARM-UNIDADE-1: marmitaria como unidade própria (05/11/2026, decisão do dono).

   ADITIVA: cria a unidade "marmitaria", vazia, na mesma empresa do restaurante,
   com os estoques dela, e as funções da senha de entrada e saída. Não copia
   nem move nada do restaurante. A senha usa estoque_seguranca (hash bcrypt e
   bloqueio por tentativas), sem coluna nova.
   ROLLBACK: db/marmitaria/MARM_UNIDADE_1_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if not exists (select 1 from public.unidades where id = 'seldeestrela' and empresa_id is not null) then
    raise exception 'MARM-UNIDADE-1: unidade do restaurante sem empresa. Nada foi alterado.';
  end if;
  if to_regclass('public.estoque_seguranca') is null or to_regprocedure('public._estoque_conferir_pin(text,text)') is null then
    raise exception 'MARM-UNIDADE-1: falta a segurança do estoque. Nada foi alterado.';
  end if;
  if not exists (select 1 from public.estoques where unidade_id = 'seldeestrela' and slug = 'limpeza-marmitaria') then
    raise exception 'MARM-UNIDADE-1: aplique a MARM-PROD-1 antes. Nada foi alterado.';
  end if;
end $$;

insert into public.unidades (id, nome, cor, ativo, empresa_id, regime_tributario)
select 'marmitaria', 'Marmitaria', '#047857', true, empresa_id, 'MEI' from public.unidades where id = 'seldeestrela'
on conflict (id) do nothing;

-- Mesmos locais da unidade do restaurante; o de pré-preparos é exigido pelo
-- gatilho que cria o item de estoque de cada subproduto.
insert into public.estoques (unidade_id, nome, slug, tipo, descricao, cor, status, permissoes, controla_minimo, controla_validade, locais_internos, ordem)
select 'marmitaria', e.nome, e.slug, e.tipo, e.descricao, e.cor, 'ativo', e.permissoes, e.controla_minimo, e.controla_validade, e.locais_internos, e.ordem
  from public.estoques e
 where e.unidade_id = 'seldeestrela' and e.slug in ('marmitaria', 'embalagens-marmitaria', 'producao-marmitaria', 'limpeza-marmitaria', 'pre-preparos-cozinha')
on conflict (unidade_id, slug) do nothing;

create or replace function public._marmitaria_ve_unidade(p_unidade_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.hefisto_ve_todas_unidades() or p_unidade_id = any (public.hefisto_unidades_do_usuario())
$$;

create or replace function public.marmitaria_senha_definida(p_unidade_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public._marmitaria_ve_unidade(p_unidade_id) then return false; end if;
  return exists (select 1 from public.estoque_seguranca where unidade_id = p_unidade_id);
end $$;

-- Só quem administra todas as unidades troca a senha.
create or replace function public.marmitaria_definir_senha(p_unidade_id text, p_senha text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.hefisto_ve_todas_unidades() then
    return jsonb_build_object('ok', false, 'erro', 'Só o administrador define a senha.');
  end if;
  if p_senha is null or p_senha !~ '^[0-9]{4,8}$' then
    return jsonb_build_object('ok', false, 'erro', 'A senha precisa ter de 4 a 8 números.');
  end if;
  insert into public.estoque_seguranca (unidade_id, pin_hash, tentativas_falhas, bloqueado_ate)
  values (p_unidade_id, extensions.crypt(p_senha, extensions.gen_salt('bf', 8)), 0, null)
  on conflict (unidade_id) do update set pin_hash = excluded.pin_hash, tentativas_falhas = 0, bloqueado_ate = null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.marmitaria_conferir_senha(p_unidade_id text, p_senha text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_erro text;
begin
  if auth.uid() is null or not public._marmitaria_ve_unidade(p_unidade_id) then
    return jsonb_build_object('ok', false, 'erro', 'Seu usuário não tem acesso à marmitaria.');
  end if;
  -- Sem senha criada, recusa: a função do PIN criaria um valor padrão.
  if not exists (select 1 from public.estoque_seguranca where unidade_id = p_unidade_id) then
    return jsonb_build_object('ok', false, 'erro', 'A senha da marmitaria ainda não foi criada.');
  end if;
  v_erro := public._estoque_conferir_pin(p_unidade_id, p_senha);
  if v_erro is not null then return jsonb_build_object('ok', false, 'erro', replace(v_erro, 'PIN', 'Senha')); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public._marmitaria_ve_unidade(text), public.marmitaria_senha_definida(text),
  public.marmitaria_definir_senha(text, text), public.marmitaria_conferir_senha(text, text) from public, anon;
grant execute on function public._marmitaria_ve_unidade(text), public.marmitaria_senha_definida(text),
  public.marmitaria_definir_senha(text, text), public.marmitaria_conferir_senha(text, text) to authenticated;

do $$
begin
  if (select count(*) from public.estoques where unidade_id = 'marmitaria') <> 5 then raise exception 'MARM-UNIDADE-1: estoques não criados.'; end if;
  if has_function_privilege('anon', 'public.marmitaria_conferir_senha(text,text)', 'execute') then raise exception 'MARM-UNIDADE-1: anon não pode executar.'; end if;
end $$;

commit;
