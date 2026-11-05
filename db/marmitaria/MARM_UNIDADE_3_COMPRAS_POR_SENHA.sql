/* MARM-UNIDADE-3: quem entrou com a senha faz compras na marmitaria (05/11/2026,
   autorizado pelo dono). ADITIVA: uma função e três policies novas, só para
   unidade_id = 'marmitaria'. O restaurante não muda.
   ROLLBACK: db/marmitaria/MARM_UNIDADE_3_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regprocedure('public._marmitaria_usuario_da_empresa(text)') is null then
    raise exception 'MARM-UNIDADE-3: aplique a MARM-UNIDADE-2 antes. Nada foi alterado.';
  end if;
end $$;

create or replace function public._marmitaria_tem_escopo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios_erp u join usuario_escopos e on e.usuario_id = u.id
                  where u.auth_user_id = auth.uid() and u.status = 'ativo' and (u.locked_until is null or u.locked_until <= now()) and e.unidade_id = 'marmitaria')
$$;
revoke all on function public._marmitaria_tem_escopo() from public, anon;
grant execute on function public._marmitaria_tem_escopo() to authenticated;

create policy marmitaria_escopo on public.compras for all to authenticated
  using (unidade_id = 'marmitaria' and (select public._marmitaria_tem_escopo())) with check (unidade_id = 'marmitaria' and (select public._marmitaria_tem_escopo()));
create policy marmitaria_escopo on public.compras_itens for all to authenticated
  using (unidade_id = 'marmitaria' and (select public._marmitaria_tem_escopo())) with check (unidade_id = 'marmitaria' and (select public._marmitaria_tem_escopo()));
create policy marmitaria_escopo on public.contas_pagar for all to authenticated
  using (unidade_id = 'marmitaria' and (select public._marmitaria_tem_escopo())) with check (unidade_id = 'marmitaria' and (select public._marmitaria_tem_escopo()));

create or replace function public.fin_pode_acessar_unidade(p_unidade_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and coalesce(p_unidade_id, '') <> ''
     and (public.pode_ver_todas() or p_unidade_id = public.auth_unidade_id()
          or (p_unidade_id = 'marmitaria' and public._marmitaria_tem_escopo()));
$$;

do $$
begin
  if (select count(*) from pg_policies where policyname = 'marmitaria_escopo') <> 3 then raise exception 'MARM-UNIDADE-3: policies não criadas.'; end if;
end $$;

commit;
