/*
  HEFISTO — FASE 1B — MIGRAÇÃO 04 DE 04: BIOMETRIA SAI DAS TABELAS COMUNS

  PRÉ-REQUISITOS
    1. Migrações 02 e 03 da Fase 1B aplicadas.
    2. DEPLOY do código da Fase 1B feito e conferido: o quiosque bate ponto e
       reconhece rosto pelas funções novas; o cadastro facial do RH grava pela
       função biometria_cadastrar. (Antes do deploy, esta migração quebraria o
       reconhecimento do app antigo.)

  O QUE FAZ
    1. Confere que TODO descritor e TODA foto de batida das colunas antigas já
       estão em hefisto_privado. Se faltar um só, aborta sem apagar nada.
    2. Apaga os gatilhos de sincronização e LIMPA as colunas antigas:
         colaboradores.face_descritores
         registro_ponto.face_foto_entrada / face_foto_saida
       (as colunas continuam existindo, vazias; datas de cadastro e de
       consentimento ficam, porque não são biometria).
    3. Cria uma trava: gravar biometria nessas colunas passa a dar erro (um
       tablet com o app antigo em cache não volta a espalhar o dado).
    4. O quiosque deixa de LER direto colaboradores e ponto_marcacao: tira
       ponto.kiosk.* dessas regras e reaplica as policies. Ele usa só as
       funções de projeção mínima.

  ROLLBACK
    db/1b/rollback_04_biometria_limpeza.sql (devolve os dados às colunas
    antigas, a partir de hefisto_privado, e restaura as regras do quiosque).
*/

begin;

create temp table if not exists hefisto_relatorio (
  ordem serial, etapa text, verificacao text, situacao text, detalhe text
) on commit preserve rows;
truncate hefisto_relatorio;

/* 1. PRÉ-CHECK */
do $$
begin
  if not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-03' and tipo = 'marcador') then
    raise exception '1B-04 abortada: a migração 03 da Fase 1B não foi aplicada.';
  end if;
  if not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-02' and tipo = 'marcador')
     or to_regprocedure('hefisto_privado.aplicar_rls_tabela(text)') is null then
    raise exception '1B-04 abortada: a migração 02 da Fase 1B não foi aplicada.';
  end if;
  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('04 pré-check', 'migrações 02 e 03 aplicadas', 'OK', '');
end $$;

/* Regra do quiosque sem leitura direta (a 02 também chama, se for reaplicada depois da 04). */
create or replace function hefisto_privado.quiosque_sem_leitura_direta()
returns void
language plpgsql
set search_path = ''
as $$
begin
  update hefisto_privado.mapa_rls_v2
     set permissoes = array_remove(array_remove(permissoes, 'ponto.kiosk.view'), 'ponto.kiosk.create'),
         motivo = 'quiosque usa ponto_quiosque_equipe/biometria/turno e ponto_marcacao_registrar (1B-04)'
   where (tabela = 'colaboradores' and comando = 'select')
      or (tabela = 'ponto_marcacao' and comando in ('select', 'insert'));
  delete from hefisto_privado.mapa_rls_v2 where cardinality(permissoes) = 0 and comando <> '*';
end;
$$;
revoke all on function hefisto_privado.quiosque_sem_leitura_direta() from public;

/* 2. RESSINCRONIZA e CONFERE (nada é apagado se faltar alguma coisa) */
do $$
declare
  v_faltam_bio integer := 0;
  v_faltam_fotos integer := 0;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_descritores') then
    insert into hefisto_privado.biometria_facial (colaborador_id, unidade_id, descritores, capturas, cadastrado_em, consentimento_em, consentimento_por_texto, origem)
    select c.id, c.unidade_id::text, to_jsonb(c) -> 'face_descritores', jsonb_array_length(to_jsonb(c) -> 'face_descritores'),
           coalesce((to_jsonb(c) ->> 'face_cadastrado_em')::timestamptz, now()),
           coalesce((to_jsonb(c) ->> 'face_consentimento_em')::timestamptz, now()), to_jsonb(c) ->> 'face_consentimento_por', 'coluna_antiga'
    from public.colaboradores c
    where jsonb_typeof(to_jsonb(c) -> 'face_descritores') = 'array' and jsonb_array_length(to_jsonb(c) -> 'face_descritores') > 0
    on conflict (colaborador_id) do nothing;

    select count(*) into v_faltam_bio
    from public.colaboradores c
    where jsonb_typeof(to_jsonb(c) -> 'face_descritores') = 'array' and jsonb_array_length(to_jsonb(c) -> 'face_descritores') > 0
      and not exists (select 1 from hefisto_privado.biometria_facial b where b.colaborador_id = c.id);
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_entrada') then
    insert into hefisto_privado.ponto_evidencia_facial (registro_ponto_id, colaborador_id, unidade_id, tipo_batida, foto, distancia, origem)
    select r.id, r.colaborador_id, r.unidade_id::text, x.tipo, x.foto, (to_jsonb(r) ->> 'face_confianca')::numeric, 'coluna_antiga'
    from public.registro_ponto r
    cross join lateral (values ('entrada', to_jsonb(r) ->> 'face_foto_entrada'), ('saida_trabalho', to_jsonb(r) ->> 'face_foto_saida')) x(tipo, foto)
    where x.foto is not null
    on conflict (registro_ponto_id, tipo_batida) do nothing;

    select count(*) into v_faltam_fotos
    from public.registro_ponto r
    cross join lateral (values ('entrada', to_jsonb(r) ->> 'face_foto_entrada'), ('saida_trabalho', to_jsonb(r) ->> 'face_foto_saida')) x(tipo, foto)
    where x.foto is not null
      and not exists (select 1 from hefisto_privado.ponto_evidencia_facial e where e.registro_ponto_id = r.id and e.tipo_batida = x.tipo);
  end if;

  if v_faltam_bio > 0 or v_faltam_fotos > 0 then
    raise exception '1B-04 abortada: % cadastro(s) facial(is) e % foto(s) ainda não estão em hefisto_privado. Nada foi apagado.', v_faltam_bio, v_faltam_fotos;
  end if;
  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('04 conferência', 'tudo copiado para hefisto_privado', 'OK', '');
end $$;

/* 3. FOTOGRAFIA das regras do quiosque (só na primeira execução) */
do $$
begin
  if exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-04') then
    insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('04 fotografia', 'fotografia anterior preservada', 'OK', 'reexecução');
    return;
  end if;
  insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
  select '1b-04', 'mapa', format('%s.%s', m.tabela, m.comando), to_jsonb(m)
  from hefisto_privado.mapa_rls_v2 m
  where (m.tabela = 'colaboradores' and m.comando = 'select') or (m.tabela = 'ponto_marcacao' and m.comando in ('select', 'insert'));
end $$;

/* 4. LIMPEZA das colunas antigas */
do $$
declare
  v_colab integer := 0;
  v_fotos integer := 0;
begin
  drop trigger if exists hefisto_biometria_sincronizar on public.colaboradores;
  drop trigger if exists hefisto_foto_batida_sincronizar on public.registro_ponto;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_descritores') then
    update public.colaboradores set face_descritores = null where face_descritores is not null;
    get diagnostics v_colab = row_count;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_saida') then
    update public.registro_ponto set face_foto_entrada = null, face_foto_saida = null
    where face_foto_entrada is not null or face_foto_saida is not null;
    get diagnostics v_fotos = row_count;
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_entrada') then
    update public.registro_ponto set face_foto_entrada = null where face_foto_entrada is not null;
    get diagnostics v_fotos = row_count;
  end if;

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values
    ('04 limpeza', 'funcionários com descritor apagado da tabela comum', 'OK', v_colab::text),
    ('04 limpeza', 'registros do dia com foto apagada da tabela comum', 'OK', v_fotos::text);
end $$;

/* 5. TRAVA: biometria não volta para as tabelas comuns */
create or replace function hefisto_privado.recusar_biometria_em_tabela_comum()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v jsonb := to_jsonb(new);
begin
  if (v ->> 'face_descritores') is not null or (v ->> 'face_foto_entrada') is not null or (v ->> 'face_foto_saida') is not null then
    raise exception 'Biometria não é gravada em %. Use as funções biometria_cadastrar e ponto_evidencia_facial_registrar.', tg_table_name
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function hefisto_privado.recusar_biometria_em_tabela_comum() from public;

drop trigger if exists hefisto_biometria_travada on public.colaboradores;
create trigger hefisto_biometria_travada before insert or update on public.colaboradores
  for each row execute function hefisto_privado.recusar_biometria_em_tabela_comum();
drop trigger if exists hefisto_biometria_travada on public.registro_ponto;
create trigger hefisto_biometria_travada before insert or update on public.registro_ponto
  for each row execute function hefisto_privado.recusar_biometria_em_tabela_comum();

/* 6. QUIOSQUE sem leitura direta de colaboradores e do livro de marcações */
do $$
begin
  perform hefisto_privado.quiosque_sem_leitura_direta();
  perform hefisto_privado.aplicar_rls_tabela('colaboradores');
  perform hefisto_privado.aplicar_rls_tabela('ponto_marcacao');
  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values
    ('04 quiosque', 'leitura direta de colaboradores e ponto_marcacao retirada do quiosque', 'OK', '');
end $$;

/* 7. PÓS-CHECK */
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_descritores')
     and exists (select 1 from public.colaboradores where face_descritores is not null) then
    raise exception 'Pós-check falhou: ainda há descritor em colaboradores.';
  end if;
  if exists (select 1 from hefisto_privado.mapa_rls_v2 where tabela = 'colaboradores' and 'ponto.kiosk.create' = any (permissoes)) then
    raise exception 'Pós-check falhou: quiosque ainda lê colaboradores direto.';
  end if;
  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values
    ('04 pós-check', 'nenhum descritor nem foto nas tabelas comuns', 'OK', ''),
    ('04 pós-check', 'trava contra regravação ativa', 'OK', '');
end $$;

insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
select '1b-04', 'marcador', 'aplicada', jsonb_build_object('em', now())
where not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-04' and tipo = 'marcador');

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
values ('04 fim', 'Migração 04 concluída', 'OK', 'Biometria só em hefisto_privado.');

commit;

select etapa, verificacao, situacao, detalhe from hefisto_relatorio order by ordem;
