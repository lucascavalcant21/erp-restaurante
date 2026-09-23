/*
  HEFISTO — FASE 1B — ROLLBACK DA MIGRAÇÃO 04

  Devolve descritores e fotos às colunas antigas (a partir de hefisto_privado),
  tira a trava, recria os gatilhos de sincronização da 03 e devolve ao quiosque
  a leitura direta de colaboradores e do livro de marcações.
  Use só se o app antigo precisar voltar ao ar.
*/

begin;

do $$
declare
  v_snap record;
begin
  if not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-04' and tipo = 'marcador') then
    raise exception 'Rollback 1B-04: a migração 04 não está aplicada.';
  end if;

  drop trigger if exists hefisto_biometria_travada on public.colaboradores;
  drop trigger if exists hefisto_biometria_travada on public.registro_ponto;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_descritores') then
    update public.colaboradores c set face_descritores = b.descritores
    from hefisto_privado.biometria_facial b where b.colaborador_id = c.id;
    create trigger hefisto_biometria_sincronizar after insert or update of face_descritores on public.colaboradores
      for each row execute function hefisto_privado.sincronizar_biometria_antiga();
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_entrada') then
    update public.registro_ponto r set face_foto_entrada = e.foto
    from hefisto_privado.ponto_evidencia_facial e where e.registro_ponto_id = r.id and e.tipo_batida = 'entrada';
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_saida') then
      update public.registro_ponto r set face_foto_saida = e.foto
      from hefisto_privado.ponto_evidencia_facial e where e.registro_ponto_id = r.id and e.tipo_batida = 'saida_trabalho';
    end if;
    create trigger hefisto_foto_batida_sincronizar after insert or update on public.registro_ponto
      for each row execute function hefisto_privado.sincronizar_foto_batida_antiga();
  end if;

  for v_snap in select dados from hefisto_privado.snapshot_seguranca where etapa = '1b-04' and tipo = 'mapa' loop
    insert into hefisto_privado.mapa_rls_v2 (tabela, comando, permissoes, escopo, pai, fk, origem, motivo)
    values (v_snap.dados ->> 'tabela', v_snap.dados ->> 'comando',
            array(select jsonb_array_elements_text(v_snap.dados -> 'permissoes')),
            v_snap.dados ->> 'escopo', v_snap.dados ->> 'pai', v_snap.dados ->> 'fk', v_snap.dados ->> 'origem', v_snap.dados ->> 'motivo')
    on conflict (tabela, comando) do update set permissoes = excluded.permissoes, motivo = excluded.motivo;
  end loop;
  perform hefisto_privado.aplicar_rls_tabela('colaboradores');
  perform hefisto_privado.aplicar_rls_tabela('ponto_marcacao');

  drop function if exists hefisto_privado.recusar_biometria_em_tabela_comum();
  drop function if exists hefisto_privado.quiosque_sem_leitura_direta();
  delete from hefisto_privado.snapshot_seguranca where etapa = '1b-04';
end $$;

commit;

select 'Rollback 1B-04 concluído' as resultado;
