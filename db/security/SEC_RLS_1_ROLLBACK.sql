/* SEC-RLS-1 · ROLLBACK — volta ao estado ABERTO de antes (só com o dono).
   Recria as policies guardadas em public.sec_backup_policies_sec_rls_1, desliga o RLS onde
   estava desligado e apaga as funções e gatilhos da SEC-RLS-1. Reabre o S-01/S-02.
*/
begin;
do $$
declare b record; t text;
begin
  for t in select distinct tabela from public.sec_backup_policies_sec_rls_1 loop
    execute format('drop policy if exists sec_unidade on public.%I', t);
    execute format('drop trigger if exists sec_unidade_padrao on public.%I', t);
  end loop;
  for b in select * from public.sec_backup_policies_sec_rls_1 where policyname <> '(sem policy)' loop
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      b.policyname, b.tabela, b.permissive, b.cmd, array_to_string(b.roles, ', '),
      case when b.qual is not null then format(' using (%s)', b.qual) else '' end,
      case when b.with_check is not null then format(' with check (%s)', b.with_check) else '' end);
  end loop;
  for b in select distinct tabela, rls_estava_ligado from public.sec_backup_policies_sec_rls_1 where not rls_estava_ligado loop
    execute format('alter table public.%I disable row level security', b.tabela);
  end loop;
end $$;
drop function if exists public.hefisto_unidade_padrao();
drop function if exists public.hefisto_unidades_do_usuario();
drop function if exists public.hefisto_ve_todas_unidades();
commit;
