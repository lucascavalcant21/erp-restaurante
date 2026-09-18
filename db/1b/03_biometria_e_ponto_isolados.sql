/*
  HEFISTO — FASE 1B — MIGRAÇÃO 03 DE 04: BIOMETRIA E PONTO ISOLADOS (SÓ ACRESCENTA)

  PRÉ-REQUISITO
    Migração 01 da Fase 1B aplicada (usa hefisto_user_can com a regra nova).

  POR QUE
    O quiosque de ponto baixava a linha INTEIRA de cada funcionário (CPF,
    salário, PIX, endereço) só para ter nome, cargo e o descritor facial. E quem
    lia colaboradores ou registro_ponto (RH, ponto, financeiro) levava junto os
    descritores de todos e as fotos das batidas.

  O QUE FAZ (nada é apagado aqui)
    1. Tabelas próprias no schema hefisto_privado, que a API REST não expõe:
         biometria_facial          descritores + consentimento (quem, quando, versão do termo)
         ponto_evidencia_facial    foto da batida + distância, com prazo de guarda
         biometria_acessos         quem leu descritores ou viu fotos, quando e por qual canal
       Nenhum usuário logado tem privilégio nelas: só as funções abaixo.
    2. MOVE em duas etapas (não é cópia para facilitar): copia o que existe hoje
       e mantém sincronizado por gatilho enquanto o app antigo estiver no ar. A
       migração 04, depois do deploy, APAGA as colunas antigas. Depois da 04 a
       biometria existe num lugar só.
    3. Funções com projeção mínima e permissão conferida no banco:
         ponto_quiosque_equipe(unidade)        id, nome, cargo e o que decide a área — sem CPF, salário, PIX
         ponto_quiosque_biometria(unidade)     id + descritores, só de quem tem cadastro facial
         ponto_quiosque_turno(colaborador)     só os horários de entrada
         ponto_marcacao_registrar(...)         grava a marcação; hora do cliente só em ajuste
         ponto_evidencia_facial_registrar(...) guarda a foto da batida
         ponto_evidencia_facial_ver(registro)  RH vê a foto (acesso registrado)
         biometria_situacao(unidade)           quem tem cadastro, sem descritor
         biometria_cadastrar / biometria_remover
         hefisto_privado.expurgar_evidencias_faciais()  apaga foto vencida

  ROLLBACK
    db/1b/rollback_03_biometria_e_ponto_isolados.sql (devolve às colunas antigas
    o que só existir nas tabelas novas e apaga funções, gatilhos e tabelas).
*/

begin;

create temp table if not exists hefisto_relatorio (
  ordem serial, etapa text, verificacao text, situacao text, detalhe text
) on commit preserve rows;
truncate hefisto_relatorio;

/* 1. PRÉ-CHECK */
do $$
declare
  v_faltando text;
begin
  if not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-01' and tipo = 'marcador') then
    raise exception '1B-03 abortada: a migração 01 da Fase 1B não foi aplicada.';
  end if;
  if to_regprocedure('hefisto_privado.inserir_linha(text,jsonb,text[])') is null then
    raise exception '1B-03 abortada: função hefisto_privado.inserir_linha (Etapa 1) ausente.';
  end if;
  select string_agg(format('%s.%s', t, c), ', ') into v_faltando
  from (values ('colaboradores', 'id'), ('colaboradores', 'unidade_id'), ('colaboradores', 'nome'),
               ('registro_ponto', 'id'), ('registro_ponto', 'colaborador_id'), ('registro_ponto', 'unidade_id'),
               ('registro_ponto', 'data_referencia'), ('ponto_marcacao', 'nsr'), ('ponto_marcacao', 'colaborador_id')) x(t, c)
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = x.t and column_name = x.c);
  if v_faltando is not null then raise exception '1B-03 abortada. Colunas ausentes: %', v_faltando; end if;
  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values ('03 pré-check', 'migração 01 e colunas do ponto', 'OK', '');
end $$;

/* 2. TABELAS PRIVADAS */
create table if not exists hefisto_privado.biometria_facial (
  colaborador_id uuid primary key,
  unidade_id text,
  descritores jsonb not null,
  capturas integer not null,
  cadastrado_em timestamptz not null default now(),
  cadastrado_por uuid,
  consentimento_em timestamptz not null default now(),
  consentimento_por uuid,
  consentimento_por_texto text,
  termo_versao text,
  origem text not null default 'cadastro',
  atualizado_em timestamptz not null default now()
);

create table if not exists hefisto_privado.ponto_evidencia_facial (
  id bigint generated always as identity primary key,
  registro_ponto_id uuid,
  colaborador_id uuid not null,
  unidade_id text,
  tipo_batida text not null,
  foto text,
  distancia numeric,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  expira_em timestamptz not null default now() + interval '90 days',
  origem text not null default 'batida'
);
create unique index if not exists ponto_evidencia_facial_registro_tipo_idx
  on hefisto_privado.ponto_evidencia_facial (registro_ponto_id, tipo_batida);
create index if not exists ponto_evidencia_facial_expira_idx on hefisto_privado.ponto_evidencia_facial (expira_em);

create table if not exists hefisto_privado.biometria_acessos (
  id bigint generated always as identity primary key,
  evento text not null,
  unidade_id text,
  colaborador_id uuid,
  quantidade integer,
  auth_user_id uuid,
  request_id text,
  canal text,
  em timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['biometria_facial', 'ponto_evidencia_facial', 'biometria_acessos'] loop
    execute format('revoke all on hefisto_privado.%I from public', t);
    begin
      execute format('revoke all on hefisto_privado.%I from anon, authenticated', t);
    exception when undefined_object then null;
    end;
  end loop;
end $$;

/* 3. SINCRONIZAÇÃO com as colunas antigas (enquanto o app antigo estiver no ar) */
create or replace function hefisto_privado.sincronizar_biometria_antiga()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desc jsonb := to_jsonb(new) -> 'face_descritores';
begin
  if v_desc is null or jsonb_typeof(v_desc) <> 'array' or jsonb_array_length(v_desc) = 0 then
    delete from hefisto_privado.biometria_facial where colaborador_id = new.id and origem = 'coluna_antiga';
    return new;
  end if;
  insert into hefisto_privado.biometria_facial as b (colaborador_id, unidade_id, descritores, capturas, cadastrado_em,
                                                     consentimento_em, consentimento_por_texto, origem)
  values (new.id, new.unidade_id::text, v_desc, jsonb_array_length(v_desc),
          coalesce((to_jsonb(new) ->> 'face_cadastrado_em')::timestamptz, now()),
          coalesce((to_jsonb(new) ->> 'face_consentimento_em')::timestamptz, (to_jsonb(new) ->> 'face_cadastrado_em')::timestamptz, now()),
          to_jsonb(new) ->> 'face_consentimento_por', 'coluna_antiga')
  on conflict (colaborador_id) do update
    set descritores = excluded.descritores, capturas = excluded.capturas, unidade_id = excluded.unidade_id,
        cadastrado_em = excluded.cadastrado_em, atualizado_em = now()
    where b.origem = 'coluna_antiga';
  return new;
end;
$$;

create or replace function hefisto_privado.sincronizar_foto_batida_antiga()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novo jsonb := to_jsonb(new);
  v_velho jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
  if v_novo ->> 'face_foto_entrada' is not null and v_novo ->> 'face_foto_entrada' is distinct from v_velho ->> 'face_foto_entrada' then
    insert into hefisto_privado.ponto_evidencia_facial (registro_ponto_id, colaborador_id, unidade_id, tipo_batida, foto, distancia, criado_em, origem)
    values (new.id, new.colaborador_id, new.unidade_id::text, 'entrada', v_novo ->> 'face_foto_entrada',
            (v_novo ->> 'face_confianca')::numeric, now(), 'coluna_antiga')
    on conflict (registro_ponto_id, tipo_batida) do update set foto = excluded.foto, distancia = excluded.distancia;
  end if;
  if v_novo ->> 'face_foto_saida' is not null and v_novo ->> 'face_foto_saida' is distinct from v_velho ->> 'face_foto_saida' then
    insert into hefisto_privado.ponto_evidencia_facial (registro_ponto_id, colaborador_id, unidade_id, tipo_batida, foto, distancia, criado_em, origem)
    values (new.id, new.colaborador_id, new.unidade_id::text, 'saida_trabalho', v_novo ->> 'face_foto_saida',
            (v_novo ->> 'face_confianca')::numeric, now(), 'coluna_antiga')
    on conflict (registro_ponto_id, tipo_batida) do update set foto = excluded.foto, distancia = excluded.distancia;
  end if;
  return new;
end;
$$;

do $$
begin
  drop trigger if exists hefisto_biometria_sincronizar on public.colaboradores;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_descritores') then
    create trigger hefisto_biometria_sincronizar after insert or update of face_descritores on public.colaboradores
      for each row execute function hefisto_privado.sincronizar_biometria_antiga();
  end if;

  drop trigger if exists hefisto_foto_batida_sincronizar on public.registro_ponto;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_entrada') then
    create trigger hefisto_foto_batida_sincronizar after insert or update on public.registro_ponto
      for each row execute function hefisto_privado.sincronizar_foto_batida_antiga();
  end if;
end $$;

/* 4. CÓPIA do que existe hoje (idempotente) */
do $$
declare
  v_bio integer := 0;
  v_fotos integer := 0;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_descritores') then
    insert into hefisto_privado.biometria_facial (colaborador_id, unidade_id, descritores, capturas, cadastrado_em,
                                                  consentimento_em, consentimento_por_texto, origem)
    select c.id, c.unidade_id::text, to_jsonb(c) -> 'face_descritores', jsonb_array_length(to_jsonb(c) -> 'face_descritores'),
           coalesce((to_jsonb(c) ->> 'face_cadastrado_em')::timestamptz, now()),
           coalesce((to_jsonb(c) ->> 'face_consentimento_em')::timestamptz, (to_jsonb(c) ->> 'face_cadastrado_em')::timestamptz, now()),
           to_jsonb(c) ->> 'face_consentimento_por', 'coluna_antiga'
    from public.colaboradores c
    where jsonb_typeof(to_jsonb(c) -> 'face_descritores') = 'array' and jsonb_array_length(to_jsonb(c) -> 'face_descritores') > 0
    on conflict (colaborador_id) do nothing;
    get diagnostics v_bio = row_count;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'face_foto_entrada') then
    insert into hefisto_privado.ponto_evidencia_facial (registro_ponto_id, colaborador_id, unidade_id, tipo_batida, foto, distancia, criado_em, origem)
    select r.id, r.colaborador_id, r.unidade_id::text, x.tipo, x.foto, (to_jsonb(r) ->> 'face_confianca')::numeric,
           coalesce((to_jsonb(r) ->> 'created_at')::timestamptz, now()), 'coluna_antiga'
    from public.registro_ponto r
    cross join lateral (values ('entrada', to_jsonb(r) ->> 'face_foto_entrada'), ('saida_trabalho', to_jsonb(r) ->> 'face_foto_saida')) x(tipo, foto)
    where x.foto is not null
    on conflict (registro_ponto_id, tipo_batida) do nothing;
    get diagnostics v_fotos = row_count;
  end if;

  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values
    ('03 cópia', 'cadastros faciais copiados para hefisto_privado', 'OK', v_bio::text),
    ('03 cópia', 'fotos de batida copiadas para hefisto_privado', 'OK', v_fotos::text);
end $$;

/* 5. FUNÇÕES */

/* Registro de acesso a biometria (quem, o quê, quanto, request id e canal). */
create or replace function hefisto_privado.registrar_acesso_biometria(p_evento text, p_unidade text, p_colaborador uuid, p_quantidade integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into hefisto_privado.biometria_acessos (evento, unidade_id, colaborador_id, quantidade, auth_user_id, request_id, canal)
  select p_evento, p_unidade, p_colaborador, p_quantidade, auth.uid(),
         public.hefisto_contexto_auditoria() ->> 'request_id', public.hefisto_contexto_auditoria() ->> 'canal'
$$;

/* Unidade de um colaborador (lida no banco: o cliente não escolhe). */
create or replace function hefisto_privado.unidade_do_colaborador(p_colaborador_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.unidade_id::text from public.colaboradores c where c.id = p_colaborador_id
$$;

create or replace function hefisto_privado.exigir(p_permissoes text[], p_unidade text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare p text;
begin
  if auth.uid() is null then raise exception 'Sessão ausente.' using errcode = '42501'; end if;
  if p_unidade is null then raise exception 'Unidade inválida.' using errcode = '42501'; end if;
  foreach p in array p_permissoes loop
    if public.hefisto_user_can(p, p_unidade) then return; end if;
  end loop;
  raise exception 'Sem permissão para esta operação nesta unidade.' using errcode = '42501';
end;
$$;

/* Equipe para o quiosque: SÓ o que identifica e decide a área. */
create or replace function public.ponto_quiosque_equipe(p_unidade_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform hefisto_privado.exigir(array['ponto.kiosk.view', 'ponto.kiosk.create'], p_unidade_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id,
             'nome', c.nome,
             'cargo', to_jsonb(c) ->> 'cargo',
             'setor', to_jsonb(c) ->> 'setor',
             'area_escala', to_jsonb(c) ->> 'area_escala',
             'tipo_contrato', to_jsonb(c) ->> 'tipo_contrato',
             'status', to_jsonb(c) ->> 'status',
             'ativo', (to_jsonb(c) -> 'ativo'),
             'acesso_todas_areas', coalesce((to_jsonb(c) ->> 'acesso_todas_areas')::boolean, false),
             'tem_biometria', exists (select 1 from hefisto_privado.biometria_facial b where b.colaborador_id = c.id)
           ) order by c.nome)
    from public.colaboradores c
    where c.unidade_id::text = p_unidade_id
      and coalesce(to_jsonb(c) ->> 'tipo_contrato', '') <> 'Freelancer'
      and coalesce((to_jsonb(c) ->> 'ativo')::boolean, true)
      and lower(coalesce(to_jsonb(c) ->> 'status', 'ativo')) not in ('inativo', 'desligado')
  ), '[]'::jsonb);
end;
$$;

/* Descritores para o reconhecimento: só id + vetores, só de quem tem cadastro, acesso registrado. */
create or replace function public.ponto_quiosque_biometria(p_unidade_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lista jsonb;
begin
  perform hefisto_privado.exigir(array['ponto.kiosk.create'], p_unidade_id);
  select coalesce(jsonb_agg(jsonb_build_object('id', b.colaborador_id, 'descritores', b.descritores)), '[]'::jsonb)
  into v_lista
  from hefisto_privado.biometria_facial b
  join public.colaboradores c on c.id = b.colaborador_id
  where c.unidade_id::text = p_unidade_id
    and coalesce(to_jsonb(c) ->> 'tipo_contrato', '') <> 'Freelancer'
    and coalesce((to_jsonb(c) ->> 'ativo')::boolean, true)
    and lower(coalesce(to_jsonb(c) ->> 'status', 'ativo')) not in ('inativo', 'desligado');
  perform hefisto_privado.registrar_acesso_biometria('descritores_lidos_quiosque', p_unidade_id, null, jsonb_array_length(v_lista));
  return v_lista;
end;
$$;

/* Horário contratado de UM colaborador, para a trava de entrada antes do turno. */
create or replace function public.ponto_quiosque_turno(p_colaborador_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_unidade text := hefisto_privado.unidade_do_colaborador(p_colaborador_id);
begin
  perform hefisto_privado.exigir(array['ponto.kiosk.create', 'ponto.clock.create', 'ponto.clock.edit'], v_unidade);
  return (
    select jsonb_build_object(
      'horario_entrada', to_jsonb(c) -> 'horario_entrada',
      'horario_dom_entrada', to_jsonb(c) -> 'horario_dom_entrada',
      'horario_por_dia', to_jsonb(c) -> 'horario_por_dia',
      'horarios_dia', to_jsonb(c) -> 'horarios_dia')
    from public.colaboradores c where c.id = p_colaborador_id
  );
end;
$$;

/* Marcação no livro legal. A hora é do servidor; hora informada pelo cliente
   só vale em ajuste/importação e exige permissão de corrigir ponto. */
create or replace function public.ponto_marcacao_registrar(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colab uuid := (p_dados ->> 'colaborador_id')::uuid;
  v_unidade text := hefisto_privado.unidade_do_colaborador(v_colab);
  v_tipo text := p_dados ->> 'tipo';
  v_linha jsonb;
  v_dados jsonb;
begin
  if v_unidade is null or v_unidade is distinct from (p_dados ->> 'unidade_id') then
    raise exception 'Funcionário não pertence a esta unidade.' using errcode = '42501';
  end if;
  if v_tipo = 'ajuste' or (p_dados ->> 'marcado_em') is not null then
    perform hefisto_privado.exigir(array['ponto.clock.edit'], v_unidade);
  elsif v_tipo in ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida_trabalho') then
    perform hefisto_privado.exigir(array['ponto.kiosk.create', 'ponto.clock.create', 'ponto.clock.edit'], v_unidade);
    /* Batida ao vivo só cai no dia de hoje ou no de ontem (jornada que virou a meia-noite). */
    if (p_dados ->> 'data_referencia')::date not in ((now() at time zone 'America/Sao_Paulo')::date,
                                                     (now() at time zone 'America/Sao_Paulo')::date - 1) then
      raise exception 'Data de referência fora do dia da batida.' using errcode = '22023';
    end if;
  else
    raise exception 'Tipo de marcação inválido.' using errcode = '22023';
  end if;

  /* Só campos da marcação; nulos saem (a tabela usa os padrões). cpf, nsr e hash são do banco. */
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_dados
  from jsonb_each(p_dados) e(k, v)
  where k in ('unidade_id', 'colaborador_id', 'tipo', 'marcado_em', 'data_referencia', 'origem', 'latitude', 'longitude',
              'valor_anterior', 'tipo_alvo', 'registrado_por', 'motivo')
    and v <> 'null'::jsonb;

  v_linha := hefisto_privado.inserir_linha('ponto_marcacao', v_dados,
    array['unidade_id', 'colaborador_id', 'tipo', 'marcado_em', 'data_referencia', 'origem', 'latitude', 'longitude',
          'valor_anterior', 'tipo_alvo', 'registrado_por', 'motivo']);
  return jsonb_build_object('nsr', v_linha -> 'nsr', 'marcado_em', v_linha -> 'marcado_em', 'hash', v_linha -> 'hash');
end;
$$;

/* Foto da batida por reconhecimento facial, no registro do dia (hoje ou ontem, fuso de Brasília). */
create or replace function public.ponto_evidencia_facial_registrar(p_colaborador_id uuid, p_tipo_batida text, p_foto text, p_distancia numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidade text := hefisto_privado.unidade_do_colaborador(p_colaborador_id);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_registro uuid;
begin
  perform hefisto_privado.exigir(array['ponto.kiosk.create'], v_unidade);
  if p_tipo_batida not in ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida_trabalho') then
    raise exception 'Tipo de batida inválido.' using errcode = '22023';
  end if;
  if p_foto is not null and (length(p_foto) > 120000 or p_foto !~ '^[A-Za-z0-9+/=]+$') then
    raise exception 'Foto da batida inválida (formato ou tamanho).' using errcode = '22023';
  end if;
  select r.id into v_registro
  from public.registro_ponto r
  where r.colaborador_id = p_colaborador_id and r.data_referencia in (v_hoje, v_hoje - 1)
  order by r.data_referencia desc
  limit 1;
  if v_registro is null then
    raise exception 'Registro do dia não encontrado para anexar a conferência facial.' using errcode = 'P0002';
  end if;

  insert into hefisto_privado.ponto_evidencia_facial (registro_ponto_id, colaborador_id, unidade_id, tipo_batida, foto, distancia, criado_por)
  values (v_registro, p_colaborador_id, v_unidade, p_tipo_batida, p_foto, p_distancia, auth.uid())
  on conflict (registro_ponto_id, tipo_batida) do update
    set foto = excluded.foto, distancia = excluded.distancia, criado_por = excluded.criado_por, criado_em = now(),
        expira_em = now() + interval '90 days';

  /* Marca a origem no resumo do dia (dado não biométrico), se as colunas existirem. */
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'registro_ponto' and column_name = 'origem_batida') then
    execute 'update public.registro_ponto set origem_batida = ''facial'' where id = $1' using v_registro;
  end if;
  return jsonb_build_object('ok', true, 'registro_ponto_id', v_registro);
end;
$$;

/* RH vê a foto da batida para conferir uma contestação. Cada visualização fica registrada. */
create or replace function public.ponto_evidencia_facial_ver(p_registro_ponto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidade text;
  v_colab uuid;
  v_lista jsonb;
begin
  select r.unidade_id::text, r.colaborador_id into v_unidade, v_colab from public.registro_ponto r where r.id = p_registro_ponto_id;
  perform hefisto_privado.exigir(array['ponto.clock.view_history'], v_unidade);
  select coalesce(jsonb_agg(jsonb_build_object('tipo_batida', e.tipo_batida, 'foto', e.foto, 'distancia', e.distancia, 'criado_em', e.criado_em)
                  order by e.criado_em), '[]'::jsonb)
  into v_lista
  from hefisto_privado.ponto_evidencia_facial e
  where e.registro_ponto_id = p_registro_ponto_id and e.expira_em > now();
  perform hefisto_privado.registrar_acesso_biometria('foto_batida_vista', v_unidade, v_colab, jsonb_array_length(v_lista));
  return v_lista;
end;
$$;

/* Quem tem cadastro facial na unidade (sem descritor). */
create or replace function public.biometria_situacao(p_unidade_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform hefisto_privado.exigir(array['rh.employees.view', 'rh.employees.edit'], p_unidade_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object('colaborador_id', b.colaborador_id, 'cadastrado_em', b.cadastrado_em,
                                        'consentimento_em', b.consentimento_em, 'capturas', b.capturas, 'termo_versao', b.termo_versao))
    from hefisto_privado.biometria_facial b
    join public.colaboradores c on c.id = b.colaborador_id
    where c.unidade_id::text = p_unidade_id
  ), '[]'::jsonb);
end;
$$;

/* Cadastro facial: valida o formato, grava consentimento com autor e versão do termo. */
create or replace function public.biometria_cadastrar(p_colaborador_id uuid, p_descritores jsonb, p_termo_versao text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidade text := hefisto_privado.unidade_do_colaborador(p_colaborador_id);
  v_capturas integer;
begin
  perform hefisto_privado.exigir(array['rh.employees.edit'], v_unidade);
  if jsonb_typeof(p_descritores) <> 'array' then raise exception 'Descritores inválidos.' using errcode = '22023'; end if;
  v_capturas := jsonb_array_length(p_descritores);
  if v_capturas < 3 or v_capturas > 10 then raise exception 'Envie de 3 a 10 capturas.' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_descritores) d
    where jsonb_typeof(d) <> 'array' or jsonb_array_length(d) <> 128
       or exists (select 1 from jsonb_array_elements(d) n where jsonb_typeof(n) <> 'number')
  ) then
    raise exception 'Cada captura precisa ter 128 números.' using errcode = '22023';
  end if;
  if coalesce(trim(p_termo_versao), '') = '' then raise exception 'Informe a versão do termo de consentimento.' using errcode = '22023'; end if;

  insert into hefisto_privado.biometria_facial as b (colaborador_id, unidade_id, descritores, capturas, cadastrado_em, cadastrado_por,
                                                     consentimento_em, consentimento_por, termo_versao, origem, atualizado_em)
  values (p_colaborador_id, v_unidade, p_descritores, v_capturas, now(), auth.uid(), now(), auth.uid(), p_termo_versao, 'cadastro', now())
  on conflict (colaborador_id) do update
    set descritores = excluded.descritores, capturas = excluded.capturas, unidade_id = excluded.unidade_id,
        cadastrado_em = now(), cadastrado_por = excluded.cadastrado_por, consentimento_em = now(),
        consentimento_por = excluded.consentimento_por, termo_versao = excluded.termo_versao, origem = 'cadastro', atualizado_em = now();

  /* Situação visível para o RH na ficha (datas, não o descritor). */
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_cadastrado_em') then
    execute 'update public.colaboradores set face_cadastrado_em = now() where id = $1' using p_colaborador_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'face_consentimento_em') then
    execute 'update public.colaboradores set face_consentimento_em = now() where id = $1' using p_colaborador_id;
  end if;
  perform hefisto_privado.registrar_acesso_biometria('biometria_cadastrada', v_unidade, p_colaborador_id, v_capturas);
  return jsonb_build_object('ok', true, 'capturas', v_capturas);
end;
$$;

/* Remove o cadastro facial em TODO lugar (tabela nova e colunas antigas). */
create or replace function public.biometria_remover(p_colaborador_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidade text := hefisto_privado.unidade_do_colaborador(p_colaborador_id);
  c text;
begin
  perform hefisto_privado.exigir(array['rh.employees.edit'], v_unidade);
  delete from hefisto_privado.biometria_facial where colaborador_id = p_colaborador_id;
  foreach c in array array['face_descritores', 'face_cadastrado_em', 'face_consentimento_em', 'face_consentimento_por'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = c) then
      execute format('update public.colaboradores set %I = null where id = $1', c) using p_colaborador_id;
    end if;
  end loop;
  perform hefisto_privado.registrar_acesso_biometria('biometria_removida', v_unidade, p_colaborador_id, null);
  return jsonb_build_object('ok', true);
end;
$$;

/* Apaga fotos de batida vencidas. Rodar por agendamento (pg_cron) ou à mão. */
create or replace function hefisto_privado.expurgar_evidencias_faciais()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  delete from hefisto_privado.ponto_evidencia_facial where expira_em <= now();
  get diagnostics v_n = row_count;
  insert into hefisto_privado.biometria_acessos (evento, quantidade) values ('fotos_expurgadas', v_n);
  return v_n;
end;
$$;

/* 6. PRIVILÉGIOS */
do $$
declare f text;
begin
  foreach f in array array[
    'public.ponto_quiosque_equipe(text)', 'public.ponto_quiosque_biometria(text)', 'public.ponto_quiosque_turno(uuid)',
    'public.ponto_marcacao_registrar(jsonb)', 'public.ponto_evidencia_facial_registrar(uuid,text,text,numeric)',
    'public.ponto_evidencia_facial_ver(uuid)', 'public.biometria_situacao(text)',
    'public.biometria_cadastrar(uuid,jsonb,text)', 'public.biometria_remover(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    begin
      execute format('revoke all on function %s from anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    exception when undefined_object then null;
    end;
  end loop;
  foreach f in array array[
    'hefisto_privado.registrar_acesso_biometria(text,text,uuid,integer)', 'hefisto_privado.unidade_do_colaborador(uuid)',
    'hefisto_privado.exigir(text[],text)', 'hefisto_privado.expurgar_evidencias_faciais()',
    'hefisto_privado.sincronizar_biometria_antiga()', 'hefisto_privado.sincronizar_foto_batida_antiga()'
  ] loop
    execute format('revoke all on function %s from public', f);
  end loop;
end $$;

/* 7. PÓS-CHECK */
do $$
declare
  v_lista text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    select string_agg(t, ', ') into v_lista
    from unnest(array['hefisto_privado.biometria_facial', 'hefisto_privado.ponto_evidencia_facial', 'hefisto_privado.biometria_acessos']) t
    where has_table_privilege('authenticated', t, 'SELECT') or has_table_privilege('authenticated', t, 'INSERT');
    if v_lista is not null then raise exception 'Pós-check falhou: usuário logado acessa direto %', v_lista; end if;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    select string_agg(f, ', ') into v_lista
    from unnest(array['public.ponto_quiosque_equipe(text)', 'public.ponto_quiosque_biometria(text)', 'public.biometria_cadastrar(uuid,jsonb,text)',
                      'public.ponto_evidencia_facial_ver(uuid)', 'public.ponto_marcacao_registrar(jsonb)']) f
    where has_function_privilege('anon', f, 'EXECUTE');
    if v_lista is not null then raise exception 'Pós-check falhou: anônimo executa %', v_lista; end if;
  end if;
  insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe) values
    ('03 pós-check', 'tabelas de biometria sem acesso direto', 'OK', ''),
    ('03 pós-check', 'funções do quiosque e da biometria fechadas ao anônimo', 'OK', '');
end $$;

insert into hefisto_privado.snapshot_seguranca (etapa, tipo, objeto, dados)
select '1b-03', 'marcador', 'aplicada', jsonb_build_object('em', now())
where not exists (select 1 from hefisto_privado.snapshot_seguranca where etapa = '1b-03' and tipo = 'marcador');

insert into hefisto_relatorio (etapa, verificacao, situacao, detalhe)
values ('03 fim', 'Migração 03 concluída', 'OK', 'Faça o deploy do código da Fase 1B antes da migração 04.');

commit;

select etapa, verificacao, situacao, detalhe from hefisto_relatorio order by ordem;
