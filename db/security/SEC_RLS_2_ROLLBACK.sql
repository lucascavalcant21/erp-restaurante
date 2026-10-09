/* SEC-RLS-2 · ROLLBACK — volta ao estado de depois da SEC-RLS-1 (só com o dono).
   - recria as policies das 31 tabelas guardadas em public.sec_backup_policies_sec_rls_2
     (inclui as abertas de antes: reabre o S-02 nessas tabelas);
   - recria pode_ver_todas / hefisto_ve_todas_unidades / hefisto_unidades_do_usuario
     como estavam (sec_backup_funcoes_sec_rls_2);
   - devolve a leitura de unidades.token_nfe ao navegador;
   - apaga as funções e os gatilhos novos.
   NÃO apaga: public.sec_dados_legados (histórico da classificação) e as colunas
   unidade_id de suprimentos_catalogo/tarefas_templates (aditivas; apagar coluna é destrutivo).
*/
begin;
set local lock_timeout = '5s';
do $$
declare b record; t text; f record;
begin
  if not exists (select 1 from public.sec_backup_policies_sec_rls_2) then raise exception 'SEC-RLS-2 rollback: backup vazio. Nada foi alterado.'; end if;
  for t in select distinct tabela from public.sec_backup_policies_sec_rls_2 loop
    for b in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', b.policyname, t);
    end loop;
    execute format('drop trigger if exists sec_unidade_padrao on public.%I', t);
  end loop;
  -- o gatilho de colaboradores é da SEC-RLS-1: volta
  execute 'create trigger sec_unidade_padrao before insert on public.colaboradores for each row execute function public.hefisto_unidade_padrao()';
  for b in select * from public.sec_backup_policies_sec_rls_2 where policyname <> '(sem policy)' loop
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      b.policyname, b.tabela, b.permissive, b.cmd, array_to_string(b.roles, ', '),
      case when b.qual is not null then format(' using (%s)', b.qual) else '' end,
      case when b.with_check is not null then format(' with check (%s)', b.with_check) else '' end);
  end loop;
  for b in select distinct tabela, rls_estava_ligado from public.sec_backup_policies_sec_rls_2 where not rls_estava_ligado loop
    execute format('alter table public.%I disable row level security', b.tabela);
  end loop;
  for f in select * from public.sec_backup_funcoes_sec_rls_2 loop
    execute f.definicao;
  end loop;
end $$;
grant select on table public.unidades to authenticated;
drop function if exists public.hefisto_colaboradores_operacional(text);
drop function if exists public.hefisto_token_nfe_configurado(text);
drop function if exists public.hefisto_unidades_com_permissao(text);
drop function if exists public.hefisto_meus_colaboradores();
commit;
