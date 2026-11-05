/* TREIN-1 · ROLLBACK. NÃO RODAR SEM DECISÃO DO DONO.
   Apaga as tabelas trein_* com todo o conteúdo editado e o progresso da equipe,
   e tira as permissões treinamento.*. Não toca em nenhuma outra tabela. */
begin;
delete from public.perfil_permissoes where permission_key like 'treinamento.%';
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'trein\_%'
       and p.proname not in ('trein_meu_usuario', 'trein_na_unidade')  -- as policies usam estas duas
  loop
    execute format('drop function %s', v_fn);
  end loop;
end $$;
drop table public.trein_pratos_validados, public.trein_pratica_avaliacoes, public.trein_tentativas,
  public.trein_aulas_concluidas, public.trein_matriculas, public.trein_pratica_itens, public.trein_gabaritos,
  public.trein_questoes, public.trein_aulas, public.trein_trilha_modulos, public.trein_modulos, public.trein_trilhas;
drop function public.trein_meu_usuario();
drop function public.trein_na_unidade(text);
commit;
