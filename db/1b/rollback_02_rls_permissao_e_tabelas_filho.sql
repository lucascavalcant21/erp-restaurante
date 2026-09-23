/*
  HEFISTO — FASE 1B — ROLLBACK DA MIGRAÇÃO 02

  Volta as policies e o RLS de todas as tabelas tocadas pela 02 ao estado
  fotografado antes dela (o da Etapa 3) e apaga o mapa v2.
  Não mexe no anônimo (continua fechado) nem nas funções da 01.
*/

begin;

do $$
declare
  v_snap record;
  pol record;
  v_tabelas text[];
begin
  if not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-02' and tipo = 'marcador') then
    raise exception 'Rollback 1B-02: a migração 02 não está aplicada.';
  end if;

  select array_agg(distinct x) into v_tabelas from (
    select tabela as x from hefisto_privado.rls_aplicado
    union
    select dados ->> 'tabela' from hefisto_privado.snapshot_seguranca where etapa = '1b-02' and tipo in ('policy', 'rls')
  ) s where x is not null;

  for pol in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename = any (v_tabelas)
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;

  for v_snap in select dados from hefisto_privado.snapshot_seguranca where etapa = '1b-02' and tipo = 'policy' order by id loop
    if to_regclass(format('public.%I', v_snap.dados ->> 'tabela')) is null then continue; end if;
    execute format('create policy %I on public.%I as %s for %s to %s %s %s',
      v_snap.dados ->> 'nome', v_snap.dados ->> 'tabela',
      v_snap.dados ->> 'permissive', v_snap.dados ->> 'cmd',
      (select string_agg(quote_ident(r), ', ') from jsonb_array_elements_text(v_snap.dados -> 'roles') r),
      case when v_snap.dados ->> 'qual' is not null then format('using (%s)', v_snap.dados ->> 'qual') else '' end,
      case when v_snap.dados ->> 'with_check' is not null then format('with check (%s)', v_snap.dados ->> 'with_check') else '' end);
  end loop;

  for v_snap in select dados from hefisto_privado.snapshot_seguranca where etapa = '1b-02' and tipo = 'rls' order by id loop
    if to_regclass(format('public.%I', v_snap.dados ->> 'tabela')) is null then continue; end if;
    execute format('alter table public.%I %s row level security', v_snap.dados ->> 'tabela',
                   case when (v_snap.dados ->> 'rls')::boolean then 'enable' else 'disable' end);
  end loop;

  drop table if exists hefisto_privado.rls_aplicado;
  drop table if exists hefisto_privado.tabelas_do_app;
  drop table if exists hefisto_privado.mapa_rls_v2;
  delete from hefisto_privado.snapshot_seguranca where etapa = '1b-02';
end $$;

commit;

select 'Rollback 1B-02 concluído' as resultado;
