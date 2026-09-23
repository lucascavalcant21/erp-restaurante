/*
  HEFISTO — FASE 1B — ROLLBACK DA MIGRAÇÃO 03

  Recusa rodar com a 04 aplicada (desfaça a 04 antes).
  Antes de apagar as tabelas novas, devolve às colunas antigas o que só existe
  nelas (cadastro facial ou foto gravados pelo app novo). Apaga funções,
  gatilhos e as tabelas biometria_facial e ponto_evidencia_facial.
  O registro de ACESSOS à biometria (hefisto_privado.biometria_acessos) é
  mantido: trilha de auditoria não se apaga.
*/

begin;

do $$
declare f text;
begin
  if not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-03' and tipo = 'marcador') then
    raise exception 'Rollback 1B-03: a migração 03 não está aplicada.';
  end if;
  if exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-04' and tipo = 'marcador') then
    raise exception 'Rollback 1B-03 recusado: desfaça antes a migração 04.';
  end if;

  drop trigger if exists hefisto_biometria_sincronizar on public.colaboradores;
  drop trigger if exists hefisto_foto_batida_sincronizar on public.registro_ponto;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_descritores') then
    update public.colaboradores c set face_descritores = b.descritores
    from hefisto_privado.biometria_facial b
    where b.colaborador_id = c.id and c.face_descritores is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_entrada') then
    update public.registro_ponto r set face_foto_entrada = e.foto
    from hefisto_privado.ponto_evidencia_facial e
    where e.registro_ponto_id = r.id and e.tipo_batida = 'entrada' and r.face_foto_entrada is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_saida') then
    update public.registro_ponto r set face_foto_saida = e.foto
    from hefisto_privado.ponto_evidencia_facial e
    where e.registro_ponto_id = r.id and e.tipo_batida = 'saida_trabalho' and r.face_foto_saida is null;
  end if;

  foreach f in array array[
    'public.ponto_quiosque_equipe(text)', 'public.ponto_quiosque_biometria(text)', 'public.ponto_quiosque_turno(uuid)',
    'public.ponto_marcacao_registrar(jsonb)', 'public.ponto_evidencia_facial_registrar(uuid,text,text,numeric)',
    'public.ponto_evidencia_facial_ver(uuid)', 'public.biometria_situacao(text)',
    'public.biometria_cadastrar(uuid,jsonb,text)', 'public.biometria_remover(uuid)',
    'hefisto_privado.expurgar_evidencias_faciais()', 'hefisto_privado.exigir(text[],text)',
    'hefisto_privado.unidade_do_colaborador(uuid)', 'hefisto_privado.registrar_acesso_biometria(text,text,uuid,integer)',
    'hefisto_privado.sincronizar_biometria_antiga()', 'hefisto_privado.sincronizar_foto_batida_antiga()'
  ] loop
    execute format('drop function if exists %s', f);
  end loop;

  drop table if exists hefisto_privado.ponto_evidencia_facial;
  drop table if exists hefisto_privado.biometria_facial;
  delete from hefisto_privado.snapshot_seguranca where etapa = '1b-03';
end $$;

commit;

select 'Rollback 1B-03 concluído' as resultado;
