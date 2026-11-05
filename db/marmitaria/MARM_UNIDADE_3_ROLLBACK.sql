/* Desfaz a MARM-UNIDADE-3. Só com decisão do dono. */
begin;
drop policy if exists marmitaria_escopo on public.compras;
drop policy if exists marmitaria_escopo on public.compras_itens;
drop policy if exists marmitaria_escopo on public.contas_pagar;
create or replace function public.fin_pode_acessar_unidade(p_unidade_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and coalesce(p_unidade_id, '') <> ''
     and (public.pode_ver_todas() or p_unidade_id = public.auth_unidade_id());
$$;
drop function if exists public._marmitaria_tem_escopo();
commit;
