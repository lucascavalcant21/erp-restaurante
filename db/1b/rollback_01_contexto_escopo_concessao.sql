/*
  HEFISTO — FASE 1B — ROLLBACK DA MIGRAÇÃO 01

  Restaura as definições de hefisto_user_has_permission, hefisto_user_in_unit,
  hefisto_escopo_unidades e hefisto_unidades_com_permissao fotografadas antes
  da 01, apaga as funções novas e devolve empresa_id nulo às unidades que a 01
  ligou à empresa.

  Recusa rodar se a 02 ou a 03 estiverem aplicadas (elas dependem das funções
  novas): desfaça-as antes.
*/

begin;

do $$
declare
  v_snap record;
  f text;
begin
  if not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-01' and tipo = 'marcador') then
    raise exception 'Rollback 1B-01: a migração 01 não está aplicada.';
  end if;
  if exists (select 1 from hefisto_privado.snapshot_seguranca where etapa in ('1b-02', '1b-03') and tipo = 'marcador') then
    raise exception 'Rollback 1B-01 recusado: desfaça antes as migrações 02 e 03 da Fase 1B.';
  end if;

  for v_snap in select * from hefisto_privado.snapshot_seguranca where etapa = '1b-01' and tipo = 'funcao' order by id loop
    execute v_snap.dados ->> 'definicao';
  end loop;

  update public.unidades u set empresa_id = null
  from hefisto_privado.snapshot_seguranca s
  where s.etapa = '1b-01' and s.tipo = 'unidade_sem_empresa' and s.dados ->> 'unidade_id' = u.id;

  foreach f in array array[
    'public.hefisto_contexto_requisicao(text)', 'public.hefisto_contexto_auditoria()',
    'public.hefisto_chaves_nao_concediveis(uuid,text[])', 'public.hefisto_pode_gerenciar_usuario(uuid,uuid)',
    'public.hefisto_escopos_nao_concediveis(uuid,jsonb)'
  ] loop
    execute format('drop function if exists %s', f);
  end loop;
  /* As definições restauradas não usam estas funções novas. */
  drop function if exists public.hefisto_unidades_do_usuario(uuid);
  drop function if exists public.hefisto_tem_alguma_permissao(uuid, text[]);
  drop function if exists public.hefisto_usuario_valido(uuid);

  /* Privilégios das definições restauradas, como na Etapa 3 e no controle de acesso. */
  revoke all on function public.hefisto_user_has_permission(uuid, text) from public;
  revoke all on function public.hefisto_user_in_unit(uuid, text) from public;
  revoke all on function public.hefisto_escopo_unidades() from public;
  revoke all on function public.hefisto_unidades_com_permissao(text[]) from public;
  begin
    execute 'revoke all on function public.hefisto_user_has_permission(uuid, text) from anon, authenticated';
    execute 'grant execute on function public.hefisto_user_has_permission(uuid, text) to service_role';
    execute 'revoke all on function public.hefisto_user_in_unit(uuid, text) from anon';
    execute 'grant execute on function public.hefisto_user_in_unit(uuid, text) to authenticated, service_role';
    execute 'revoke all on function public.hefisto_escopo_unidades() from anon';
    execute 'grant execute on function public.hefisto_escopo_unidades() to authenticated, service_role';
    execute 'revoke all on function public.hefisto_unidades_com_permissao(text[]) from anon';
    execute 'grant execute on function public.hefisto_unidades_com_permissao(text[]) to authenticated, service_role';
  exception when undefined_object then null;
  end;

  delete from hefisto_privado.snapshot_seguranca where etapa = '1b-01';
end $$;

commit;

select 'Rollback 1B-01 concluído' as resultado;
