/* SEC-FICHAS-1 · ROLLBACK. Devolve a policy única de antes: qualquer usuário da
   unidade volta a poder gravar fichas pela API. Não rodar sem decisão do dono. */

begin;

do $$
declare
  v_tabela text;
  v_unidade constant text := '((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))';
begin
  if to_regprocedure('public.hefisto_pode_alterar_fichas(text)') is null then
    raise exception 'SEC-FICHAS-1: não está aplicada. Nada foi alterado.';
  end if;
  foreach v_tabela in array array['fichas_tecnicas','montagem','fichas_alergenicos','fichas_armazenamento',
    'fichas_equipamentos','fichas_etapas','fichas_montagem_passos','fichas_versoes'] loop
    execute format('drop policy sec_ler on public.%I', v_tabela);
    execute format('drop policy sec_inserir on public.%I', v_tabela);
    execute format('drop policy sec_alterar on public.%I', v_tabela);
    execute format('drop policy sec_apagar on public.%I', v_tabela);
    execute format('create policy sec_unidade on public.%I for all to authenticated using %s with check %s', v_tabela, v_unidade, v_unidade);
  end loop;
end $$;

drop policy sec_ler on public.fichas_ingredientes;
drop policy sec_inserir on public.fichas_ingredientes;
drop policy sec_alterar on public.fichas_ingredientes;
drop policy sec_apagar on public.fichas_ingredientes;
create policy sec_pai on public.fichas_ingredientes for all to authenticated using (
  (select public.hefisto_ve_todas_unidades())
  or exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id)
) with check (
  (select public.hefisto_ve_todas_unidades())
  or exists (select 1 from public.fichas_tecnicas m where m.id = fichas_ingredientes.ficha_id)
);

drop function public.hefisto_pode_alterar_fichas(text);
drop table public.sec_backup_policies_sec_fichas_1;

commit;
