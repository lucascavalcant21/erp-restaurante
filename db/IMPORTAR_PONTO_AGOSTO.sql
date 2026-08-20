-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTAÇÃO DO PONTO — AGOSTO/2026 (folhas de jornada diária)
--
-- Gerado a partir das 6 folhas, com as correções que você confirmou.
-- Cobre 01/08 a 2026-08-18. O dia 19 NÃO é tocado: é hoje, e já está no tablet.
--
-- Já vem com a unidade seldeestrela preenchida: cole e rode, sem editar nada.
-- No fim tem a consulta de conferência.
--
-- Cada batida entra com origem_batida = 'manual': o histórico precisa
-- distinguir o que foi digitado do que foi batido no aparelho com GPS.
-- ═══════════════════════════════════════════════════════════════════════════

-- A tabela de atestado, se ainda nao existir. O import depende dela, entao
-- cria aqui em vez de obrigar a rodar outro arquivo antes e falhar no meio.
create table if not exists public.rh_atestados (
  id             uuid primary key default gen_random_uuid(),
  unidade_id     text,
  colaborador_id uuid not null,
  data_inicio    date not null,
  data_fim       date not null,
  parcial        boolean not null default false,
  cid            text,
  medico         text,
  observacao     text,
  arquivo_url    text,
  registrado_por text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_rh_atestados_colab
  on public.rh_atestados (colaborador_id, data_inicio);
alter table public.rh_atestados enable row level security;
do $pol$
begin
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'rh_atestados'
                    and policyname = 'rh_atestados_all') then
    create policy rh_atestados_all on public.rh_atestados
      for all using (true) with check (true);
  end if;
end $pol$;
grant select, insert, update, delete on public.rh_atestados to anon, authenticated;

-- Compara nome ignorando acento e espaço repetido. A extensão unaccent nem
-- sempre está instalada, então a troca é feita à mão — são poucas letras e
-- evita depender de algo que pode não existir no projeto.
create or replace function unaccent_simples(txt text) returns text as $fn$
  select btrim(regexp_replace(
    translate(
      coalesce(txt, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '\s+', ' ', 'g'
  ));
$fn$ language sql immutable;

begin;


-- ── LARISSA DA SILVA UHE · Chef de Garçom ────────────────────────
do $$
declare
  v_id uuid;
  v_sets text;
begin
  -- Casa o nome sem depender de acento, espaço duplo ou maiúscula: "CEDEINE
  -- DEL VALLE" e "Cedeine  del Valle" são a mesma pessoa.
  select id into v_id from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(unaccent_simples(nome)) = upper(unaccent_simples('LARISSA DA SILVA UHE'))
   limit 1;

  if v_id is null then
    -- Cria com cargo desde já: a coluna é NOT NULL, então inserir só o nome
    -- era recusado. Os demais campos entram no UPDATE logo abaixo, que só usa
    -- coluna que existe de verdade neste banco.
    insert into public.colaboradores (unidade_id, nome, cargo)
    values ('seldeestrela', 'LARISSA DA SILVA UHE', 'Chef de Garçom')
    returning id into v_id;
    raise notice 'CRIADO (conferir se nao e duplicata): LARISSA DA SILVA UHE';
  else
    raise notice 'ja existia: LARISSA DA SILVA UHE';
  end if;

  -- Horário de trabalho da folha. Folga na segunda (dias_trabalho sem o 1).
  --
  -- Monta o UPDATE só com as colunas que existem de verdade neste banco. A
  -- primeira versão listava tudo direto e parou no "column ativo does not
  -- exist" — cada instalação tem um conjunto um pouco diferente, e não dá para
  -- adivinhar de fora.
  select string_agg(format('%I = %L', t.coluna, t.valor), ', ')
    into v_sets
    from (values
      ('cargo', 'Chef de Garçom'),
      ('data_admissao', '2026-07-21'),
      ('horario_entrada', '15:40'),
      ('horario_saida', '00:00'),
      ('horario_dom_entrada', null::text),
      ('horario_dom_saida', null::text),
      ('tempo_intervalo', '60'),
      ('dias_trabalho', '0,2,3,4,5,6'),
      ('tipo_contrato', 'Fixo')
    ) as t(coluna, valor)
   where exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = 'colaboradores'
        and ic.column_name = t.coluna
   );

  if v_sets is not null then
    execute format('update public.colaboradores set %s where id = %L', v_sets, v_id);
  end if;

  -- Regrava o período inteiro, para rodar de novo não duplicar.
  delete from public.registro_ponto
   where colaborador_id = v_id
     and data_referencia between '2026-08-01' and '2026-08-18';

  insert into public.registro_ponto
    (colaborador_id, unidade_id, data_referencia, hora_entrada, hora_saida_intervalo,
     hora_retorno_intervalo, hora_saida, status_jornada, origem_batida)
  -- Os literais da lista VALUES chegam como texto; sem o cast o Postgres
  -- recusa com "column data_referencia is of type date but expression is of
  -- type text". Ele nao converte texto para data sozinho neste contexto.
  select v_id, 'seldeestrela', d.data_referencia::date, d.entrada::timestamptz,
         d.int_ini::timestamptz, d.int_fim::timestamptz, d.saida::timestamptz, 4, 'manual'
    from (values
    ('2026-08-01', '2026-08-01 15:40:00', '2026-08-01 16:40:00', '2026-08-01 17:40:00', '2026-08-02 00:25:00'),
    ('2026-08-02', '2026-08-02 15:40:00', '2026-08-02 16:40:00', '2026-08-02 17:40:00', '2026-08-03 00:30:00'),
    ('2026-08-04', '2026-08-04 15:40:00', '2026-08-04 16:40:00', '2026-08-04 17:40:00', '2026-08-05 00:25:00'),
    ('2026-08-05', '2026-08-05 15:40:00', '2026-08-05 16:40:00', '2026-08-05 17:40:00', '2026-08-06 00:00:00'),
    ('2026-08-06', '2026-08-06 15:40:00', '2026-08-06 16:40:00', '2026-08-06 17:40:00', '2026-08-07 00:50:00'),
    ('2026-08-07', '2026-08-07 15:40:00', '2026-08-07 18:30:00', '2026-08-07 19:30:00', '2026-08-08 00:30:00'),
    ('2026-08-08', '2026-08-08 15:40:00', '2026-08-08 16:40:00', '2026-08-08 17:40:00', '2026-08-09 00:51:00'),
    ('2026-08-09', '2026-08-09 15:40:00', '2026-08-09 17:40:00', '2026-08-09 18:40:00', '2026-08-10 00:15:00'),
    ('2026-08-11', '2026-08-11 15:40:00', '2026-08-11 18:20:00', '2026-08-11 19:20:00', '2026-08-12 00:34:00'),
    ('2026-08-12', '2026-08-12 15:40:00', '2026-08-12 16:40:00', '2026-08-12 17:40:00', '2026-08-13 00:25:00'),
    ('2026-08-13', '2026-08-13 15:40:00', '2026-08-13 17:40:00', '2026-08-13 18:40:00', '2026-08-14 00:30:00'),
    ('2026-08-14', '2026-08-14 15:40:00', '2026-08-14 19:00:00', '2026-08-14 20:00:00', '2026-08-15 00:00:00'),
    ('2026-08-15', '2026-08-15 15:40:00', '2026-08-15 16:40:00', '2026-08-15 17:40:00', '2026-08-16 00:00:00'),
    ('2026-08-16', '2026-08-16 15:40:00', '2026-08-16 16:40:00', '2026-08-16 17:40:00', '2026-08-17 00:00:00'),
    ('2026-08-18', '2026-08-18 15:40:00', '2026-08-18 16:40:00', '2026-08-18 17:40:00', '2026-08-19 00:15:00')
    ) as d(data_referencia, entrada, int_ini, int_fim, saida);

  delete from public.rh_atestados
   where colaborador_id = v_id and data_inicio between '2026-08-01' and '2026-08-18';

  delete from public.rh_folgas_esporadicas
   where colaborador_id = v_id and data_folga in ('2026-08-23');
  insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
  values ('seldeestrela', v_id, '2026-08-23', 'Folga (folha de agosto)');
end $$;


-- ── ALICE TERESINHA VISINTAINER XAVIER · Auxiliar de Cozinha ────────────────────────
do $$
declare
  v_id uuid;
  v_sets text;
begin
  -- Casa o nome sem depender de acento, espaço duplo ou maiúscula: "CEDEINE
  -- DEL VALLE" e "Cedeine  del Valle" são a mesma pessoa.
  select id into v_id from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(unaccent_simples(nome)) = upper(unaccent_simples('ALICE TERESINHA VISINTAINER XAVIER'))
   limit 1;

  if v_id is null then
    -- Cria com cargo desde já: a coluna é NOT NULL, então inserir só o nome
    -- era recusado. Os demais campos entram no UPDATE logo abaixo, que só usa
    -- coluna que existe de verdade neste banco.
    insert into public.colaboradores (unidade_id, nome, cargo)
    values ('seldeestrela', 'ALICE TERESINHA VISINTAINER XAVIER', 'Auxiliar de Cozinha')
    returning id into v_id;
    raise notice 'CRIADO (conferir se nao e duplicata): ALICE TERESINHA VISINTAINER XAVIER';
  else
    raise notice 'ja existia: ALICE TERESINHA VISINTAINER XAVIER';
  end if;

  -- Horário de trabalho da folha. Folga na segunda (dias_trabalho sem o 1).
  --
  -- Monta o UPDATE só com as colunas que existem de verdade neste banco. A
  -- primeira versão listava tudo direto e parou no "column ativo does not
  -- exist" — cada instalação tem um conjunto um pouco diferente, e não dá para
  -- adivinhar de fora.
  select string_agg(format('%I = %L', t.coluna, t.valor), ', ')
    into v_sets
    from (values
      ('cargo', 'Auxiliar de Cozinha'),
      ('data_admissao', '2026-03-01'),
      ('horario_entrada', '15:40'),
      ('horario_saida', '00:00'),
      ('horario_dom_entrada', null::text),
      ('horario_dom_saida', null::text),
      ('tempo_intervalo', '60'),
      ('dias_trabalho', '0,2,3,4,5,6'),
      ('tipo_contrato', 'Fixo')
    ) as t(coluna, valor)
   where exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = 'colaboradores'
        and ic.column_name = t.coluna
   );

  if v_sets is not null then
    execute format('update public.colaboradores set %s where id = %L', v_sets, v_id);
  end if;

  -- Regrava o período inteiro, para rodar de novo não duplicar.
  delete from public.registro_ponto
   where colaborador_id = v_id
     and data_referencia between '2026-08-01' and '2026-08-18';

  insert into public.registro_ponto
    (colaborador_id, unidade_id, data_referencia, hora_entrada, hora_saida_intervalo,
     hora_retorno_intervalo, hora_saida, status_jornada, origem_batida)
  -- Os literais da lista VALUES chegam como texto; sem o cast o Postgres
  -- recusa com "column data_referencia is of type date but expression is of
  -- type text". Ele nao converte texto para data sozinho neste contexto.
  select v_id, 'seldeestrela', d.data_referencia::date, d.entrada::timestamptz,
         d.int_ini::timestamptz, d.int_fim::timestamptz, d.saida::timestamptz, 4, 'manual'
    from (values
    ('2026-08-01', '2026-08-01 15:40:00', '2026-08-01 18:00:00', '2026-08-01 19:00:00', '2026-08-02 00:24:00'),
    ('2026-08-02', '2026-08-02 15:40:00', '2026-08-02 17:00:00', '2026-08-02 18:00:00', '2026-08-03 00:25:00'),
    ('2026-08-04', '2026-08-04 15:40:00', '2026-08-04 18:09:00', '2026-08-04 19:09:00', '2026-08-05 00:15:00'),
    ('2026-08-05', '2026-08-05 15:47:00', '2026-08-05 18:10:00', '2026-08-05 19:10:00', '2026-08-06 00:51:00'),
    ('2026-08-06', '2026-08-06 15:40:00', '2026-08-06 18:36:00', '2026-08-06 19:36:00', '2026-08-07 00:51:00'),
    ('2026-08-07', '2026-08-07 15:40:00', '2026-08-07 17:25:00', '2026-08-07 18:25:00', '2026-08-08 00:51:00'),
    ('2026-08-08', '2026-08-08 15:40:00', '2026-08-08 16:40:00', '2026-08-08 17:40:00', '2026-08-09 00:15:00'),
    ('2026-08-09', '2026-08-09 15:40:00', '2026-08-09 17:47:00', '2026-08-09 18:47:00', '2026-08-10 00:39:00'),
    ('2026-08-11', '2026-08-11 15:40:00', '2026-08-11 17:20:00', '2026-08-11 18:20:00', '2026-08-12 00:39:00'),
    ('2026-08-12', '2026-08-12 15:40:00', '2026-08-12 18:06:00', '2026-08-12 19:06:00', '2026-08-12 23:56:00'),
    ('2026-08-13', '2026-08-13 15:43:00', '2026-08-13 17:53:00', '2026-08-13 18:53:00', '2026-08-14 00:35:00'),
    ('2026-08-14', '2026-08-14 15:40:00', '2026-08-14 17:40:00', '2026-08-14 18:40:00', '2026-08-15 00:09:00'),
    ('2026-08-15', '2026-08-15 15:40:00', '2026-08-15 17:54:00', '2026-08-15 18:54:00', '2026-08-16 00:49:00'),
    ('2026-08-18', '2026-08-18 15:40:00', '2026-08-18 18:05:00', '2026-08-18 19:05:00', '2026-08-19 00:02:00')
    ) as d(data_referencia, entrada, int_ini, int_fim, saida);

  delete from public.rh_atestados
   where colaborador_id = v_id and data_inicio between '2026-08-01' and '2026-08-18';

  delete from public.rh_folgas_esporadicas
   where colaborador_id = v_id and data_folga in ('2026-08-16');
  insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
  values ('seldeestrela', v_id, '2026-08-16', 'Folga (folha de agosto)');
end $$;


-- ── CEDEINE DEL VALLE TABLANTE FLORES · Chefe de Cozinha ────────────────────────
do $$
declare
  v_id uuid;
  v_sets text;
begin
  -- Casa o nome sem depender de acento, espaço duplo ou maiúscula: "CEDEINE
  -- DEL VALLE" e "Cedeine  del Valle" são a mesma pessoa.
  select id into v_id from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(unaccent_simples(nome)) = upper(unaccent_simples('CEDEINE DEL VALLE TABLANTE FLORES'))
   limit 1;

  if v_id is null then
    -- Cria com cargo desde já: a coluna é NOT NULL, então inserir só o nome
    -- era recusado. Os demais campos entram no UPDATE logo abaixo, que só usa
    -- coluna que existe de verdade neste banco.
    insert into public.colaboradores (unidade_id, nome, cargo)
    values ('seldeestrela', 'CEDEINE DEL VALLE TABLANTE FLORES', 'Chefe de Cozinha')
    returning id into v_id;
    raise notice 'CRIADO (conferir se nao e duplicata): CEDEINE DEL VALLE TABLANTE FLORES';
  else
    raise notice 'ja existia: CEDEINE DEL VALLE TABLANTE FLORES';
  end if;

  -- Horário de trabalho da folha. Folga na segunda (dias_trabalho sem o 1).
  --
  -- Monta o UPDATE só com as colunas que existem de verdade neste banco. A
  -- primeira versão listava tudo direto e parou no "column ativo does not
  -- exist" — cada instalação tem um conjunto um pouco diferente, e não dá para
  -- adivinhar de fora.
  select string_agg(format('%I = %L', t.coluna, t.valor), ', ')
    into v_sets
    from (values
      ('cargo', 'Chefe de Cozinha'),
      ('data_admissao', '2025-05-08'),
      ('horario_entrada', '15:40'),
      ('horario_saida', '00:00'),
      ('horario_dom_entrada', '09:00'),
      ('horario_dom_saida', '17:20'),
      ('tempo_intervalo', '60'),
      ('dias_trabalho', '0,2,3,4,5,6'),
      ('tipo_contrato', 'Fixo')
    ) as t(coluna, valor)
   where exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = 'colaboradores'
        and ic.column_name = t.coluna
   );

  if v_sets is not null then
    execute format('update public.colaboradores set %s where id = %L', v_sets, v_id);
  end if;

  -- Regrava o período inteiro, para rodar de novo não duplicar.
  delete from public.registro_ponto
   where colaborador_id = v_id
     and data_referencia between '2026-08-01' and '2026-08-18';

  insert into public.registro_ponto
    (colaborador_id, unidade_id, data_referencia, hora_entrada, hora_saida_intervalo,
     hora_retorno_intervalo, hora_saida, status_jornada, origem_batida)
  -- Os literais da lista VALUES chegam como texto; sem o cast o Postgres
  -- recusa com "column data_referencia is of type date but expression is of
  -- type text". Ele nao converte texto para data sozinho neste contexto.
  select v_id, 'seldeestrela', d.data_referencia::date, d.entrada::timestamptz,
         d.int_ini::timestamptz, d.int_fim::timestamptz, d.saida::timestamptz, 4, 'manual'
    from (values
    ('2026-08-01', '2026-08-01 15:40:00', '2026-08-01 17:00:00', '2026-08-01 18:00:00', '2026-08-02 00:24:00'),
    ('2026-08-02', '2026-08-02 09:00:00', '2026-08-02 11:00:00', '2026-08-02 12:00:00', '2026-08-02 17:25:00'),
    ('2026-08-04', '2026-08-04 15:00:00', '2026-08-04 17:00:00', '2026-08-04 18:00:00', '2026-08-05 00:25:00'),
    ('2026-08-05', '2026-08-05 15:40:00', '2026-08-05 17:00:00', '2026-08-05 18:00:00', '2026-08-06 00:02:00'),
    ('2026-08-06', '2026-08-06 15:40:00', '2026-08-06 17:00:00', '2026-08-06 18:00:00', '2026-08-07 00:50:00'),
    ('2026-08-07', '2026-08-07 15:40:00', '2026-08-07 17:00:00', '2026-08-07 18:00:00', '2026-08-08 00:34:00'),
    ('2026-08-08', '2026-08-08 15:44:00', '2026-08-08 16:44:00', '2026-08-08 17:44:00', '2026-08-09 00:51:00'),
    ('2026-08-09', '2026-08-09 09:00:00', '2026-08-09 11:00:00', '2026-08-09 12:00:00', '2026-08-09 17:44:00'),
    ('2026-08-11', '2026-08-11 15:40:00', '2026-08-11 18:00:00', '2026-08-11 19:00:00', '2026-08-12 00:38:00'),
    ('2026-08-12', '2026-08-12 15:40:00', '2026-08-12 17:00:00', '2026-08-12 18:00:00', '2026-08-12 23:56:00'),
    ('2026-08-13', '2026-08-13 15:40:00', '2026-08-13 18:00:00', '2026-08-13 19:00:00', '2026-08-14 00:33:00'),
    ('2026-08-14', '2026-08-14 15:40:00', '2026-08-14 17:00:00', '2026-08-14 18:00:00', '2026-08-15 00:41:00'),
    ('2026-08-15', '2026-08-15 15:40:00', '2026-08-15 18:00:00', '2026-08-15 19:00:00', '2026-08-16 00:05:00'),
    ('2026-08-16', '2026-08-16 09:00:00', '2026-08-16 11:00:00', '2026-08-16 12:00:00', '2026-08-16 18:00:00'),
    ('2026-08-18', '2026-08-18 15:40:00', '2026-08-18 17:00:00', '2026-08-18 18:00:00', '2026-08-19 00:02:00')
    ) as d(data_referencia, entrada, int_ini, int_fim, saida);

  delete from public.rh_atestados
   where colaborador_id = v_id and data_inicio between '2026-08-01' and '2026-08-18';

  delete from public.rh_folgas_esporadicas
   where colaborador_id = v_id and data_folga in ('2026-08-23');
  insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
  values ('seldeestrela', v_id, '2026-08-23', 'Folga (folha de agosto)');
end $$;


-- ── BRENDA LARISSA RIBEIRO MARTINS · Garçom ────────────────────────
do $$
declare
  v_id uuid;
  v_sets text;
begin
  -- Casa o nome sem depender de acento, espaço duplo ou maiúscula: "CEDEINE
  -- DEL VALLE" e "Cedeine  del Valle" são a mesma pessoa.
  select id into v_id from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(unaccent_simples(nome)) = upper(unaccent_simples('BRENDA LARISSA RIBEIRO MARTINS'))
   limit 1;

  if v_id is null then
    -- Cria com cargo desde já: a coluna é NOT NULL, então inserir só o nome
    -- era recusado. Os demais campos entram no UPDATE logo abaixo, que só usa
    -- coluna que existe de verdade neste banco.
    insert into public.colaboradores (unidade_id, nome, cargo)
    values ('seldeestrela', 'BRENDA LARISSA RIBEIRO MARTINS', 'Garçom')
    returning id into v_id;
    raise notice 'CRIADO (conferir se nao e duplicata): BRENDA LARISSA RIBEIRO MARTINS';
  else
    raise notice 'ja existia: BRENDA LARISSA RIBEIRO MARTINS';
  end if;

  -- Horário de trabalho da folha. Folga na segunda (dias_trabalho sem o 1).
  --
  -- Monta o UPDATE só com as colunas que existem de verdade neste banco. A
  -- primeira versão listava tudo direto e parou no "column ativo does not
  -- exist" — cada instalação tem um conjunto um pouco diferente, e não dá para
  -- adivinhar de fora.
  select string_agg(format('%I = %L', t.coluna, t.valor), ', ')
    into v_sets
    from (values
      ('cargo', 'Garçom'),
      ('data_admissao', '2026-06-10'),
      ('horario_entrada', '15:40'),
      ('horario_saida', '00:00'),
      ('horario_dom_entrada', null::text),
      ('horario_dom_saida', null::text),
      ('tempo_intervalo', '60'),
      ('dias_trabalho', '0,2,3,4,5,6'),
      ('tipo_contrato', 'Fixo')
    ) as t(coluna, valor)
   where exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = 'colaboradores'
        and ic.column_name = t.coluna
   );

  if v_sets is not null then
    execute format('update public.colaboradores set %s where id = %L', v_sets, v_id);
  end if;

  -- Regrava o período inteiro, para rodar de novo não duplicar.
  delete from public.registro_ponto
   where colaborador_id = v_id
     and data_referencia between '2026-08-01' and '2026-08-18';

  insert into public.registro_ponto
    (colaborador_id, unidade_id, data_referencia, hora_entrada, hora_saida_intervalo,
     hora_retorno_intervalo, hora_saida, status_jornada, origem_batida)
  -- Os literais da lista VALUES chegam como texto; sem o cast o Postgres
  -- recusa com "column data_referencia is of type date but expression is of
  -- type text". Ele nao converte texto para data sozinho neste contexto.
  select v_id, 'seldeestrela', d.data_referencia::date, d.entrada::timestamptz,
         d.int_ini::timestamptz, d.int_fim::timestamptz, d.saida::timestamptz, 4, 'manual'
    from (values
    ('2026-08-01', '2026-08-01 15:40:00', '2026-08-01 16:40:00', '2026-08-01 17:40:00', '2026-08-02 00:25:00'),
    ('2026-08-02', '2026-08-02 15:40:00', '2026-08-02 18:10:00', '2026-08-02 19:10:00', '2026-08-03 00:18:00'),
    ('2026-08-04', '2026-08-04 15:40:00', '2026-08-04 16:50:00', '2026-08-04 17:50:00', '2026-08-05 00:37:00'),
    ('2026-08-05', '2026-08-05 15:40:00', '2026-08-05 17:20:00', '2026-08-05 18:20:00', '2026-08-06 00:00:00'),
    ('2026-08-06', '2026-08-06 15:40:00', '2026-08-06 16:10:00', '2026-08-06 17:10:00', '2026-08-07 00:00:00'),
    ('2026-08-07', '2026-08-07 15:40:00', '2026-08-07 17:00:00', '2026-08-07 18:00:00', '2026-08-08 00:30:00'),
    ('2026-08-08', '2026-08-08 15:40:00', '2026-08-08 17:35:00', '2026-08-08 18:35:00', '2026-08-09 00:45:00'),
    ('2026-08-09', '2026-08-09 15:40:00', '2026-08-09 21:15:00', '2026-08-09 22:15:00', '2026-08-09 23:55:00'),
    ('2026-08-11', '2026-08-11 15:40:00', '2026-08-11 17:40:00', '2026-08-11 18:40:00', '2026-08-12 00:40:00'),
    ('2026-08-12', '2026-08-12 15:40:00', '2026-08-12 18:20:00', '2026-08-12 19:20:00', '2026-08-13 00:40:00'),
    ('2026-08-13', '2026-08-13 15:40:00', '2026-08-13 18:10:00', '2026-08-13 19:10:00', '2026-08-14 00:15:00'),
    ('2026-08-14', '2026-08-14 15:40:00', '2026-08-14 17:30:00', '2026-08-14 18:30:00', '2026-08-15 00:20:00'),
    ('2026-08-15', '2026-08-15 15:40:00', '2026-08-15 17:05:00', '2026-08-15 18:05:00', '2026-08-16 00:10:00'),
    ('2026-08-16', '2026-08-16 15:40:00', '2026-08-16 17:00:00', '2026-08-16 18:00:00', '2026-08-17 00:00:00'),
    ('2026-08-18', '2026-08-18 15:40:00', '2026-08-18 16:40:00', '2026-08-18 17:40:00', '2026-08-19 00:00:00')
    ) as d(data_referencia, entrada, int_ini, int_fim, saida);

  delete from public.rh_atestados
   where colaborador_id = v_id and data_inicio between '2026-08-01' and '2026-08-18';


end $$;


-- ── EDUARDA DE LIMA OLIVEIRA · Bartender ────────────────────────
do $$
declare
  v_id uuid;
  v_sets text;
begin
  -- Casa o nome sem depender de acento, espaço duplo ou maiúscula: "CEDEINE
  -- DEL VALLE" e "Cedeine  del Valle" são a mesma pessoa.
  select id into v_id from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(unaccent_simples(nome)) = upper(unaccent_simples('EDUARDA DE LIMA OLIVEIRA'))
   limit 1;

  if v_id is null then
    -- Cria com cargo desde já: a coluna é NOT NULL, então inserir só o nome
    -- era recusado. Os demais campos entram no UPDATE logo abaixo, que só usa
    -- coluna que existe de verdade neste banco.
    insert into public.colaboradores (unidade_id, nome, cargo)
    values ('seldeestrela', 'EDUARDA DE LIMA OLIVEIRA', 'Bartender')
    returning id into v_id;
    raise notice 'CRIADO (conferir se nao e duplicata): EDUARDA DE LIMA OLIVEIRA';
  else
    raise notice 'ja existia: EDUARDA DE LIMA OLIVEIRA';
  end if;

  -- Horário de trabalho da folha. Folga na segunda (dias_trabalho sem o 1).
  --
  -- Monta o UPDATE só com as colunas que existem de verdade neste banco. A
  -- primeira versão listava tudo direto e parou no "column ativo does not
  -- exist" — cada instalação tem um conjunto um pouco diferente, e não dá para
  -- adivinhar de fora.
  select string_agg(format('%I = %L', t.coluna, t.valor), ', ')
    into v_sets
    from (values
      ('cargo', 'Bartender'),
      ('data_admissao', '2026-06-23'),
      ('horario_entrada', '15:40'),
      ('horario_saida', '00:00'),
      ('horario_dom_entrada', '11:00'),
      ('horario_dom_saida', '19:20'),
      ('tempo_intervalo', '60'),
      ('dias_trabalho', '0,2,3,4,5,6'),
      ('tipo_contrato', 'Fixo')
    ) as t(coluna, valor)
   where exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = 'colaboradores'
        and ic.column_name = t.coluna
   );

  if v_sets is not null then
    execute format('update public.colaboradores set %s where id = %L', v_sets, v_id);
  end if;

  -- Regrava o período inteiro, para rodar de novo não duplicar.
  delete from public.registro_ponto
   where colaborador_id = v_id
     and data_referencia between '2026-08-01' and '2026-08-18';

  insert into public.registro_ponto
    (colaborador_id, unidade_id, data_referencia, hora_entrada, hora_saida_intervalo,
     hora_retorno_intervalo, hora_saida, status_jornada, origem_batida)
  -- Os literais da lista VALUES chegam como texto; sem o cast o Postgres
  -- recusa com "column data_referencia is of type date but expression is of
  -- type text". Ele nao converte texto para data sozinho neste contexto.
  select v_id, 'seldeestrela', d.data_referencia::date, d.entrada::timestamptz,
         d.int_ini::timestamptz, d.int_fim::timestamptz, d.saida::timestamptz, 4, 'manual'
    from (values
    ('2026-08-01', '2026-08-01 15:40:00', '2026-08-01 16:40:00', '2026-08-01 17:40:00', '2026-08-01 23:30:00'),
    ('2026-08-02', '2026-08-02 11:00:00', '2026-08-02 11:30:00', '2026-08-02 12:30:00', '2026-08-02 19:00:00'),
    ('2026-08-04', '2026-08-04 15:40:00', '2026-08-04 17:15:00', '2026-08-04 18:15:00', '2026-08-05 00:38:00'),
    ('2026-08-05', '2026-08-05 15:30:00', '2026-08-05 16:57:00', '2026-08-05 17:57:00', '2026-08-05 23:46:00'),
    ('2026-08-06', '2026-08-06 16:10:00', '2026-08-06 17:30:00', '2026-08-06 18:16:00', '2026-08-07 00:35:00'),
    ('2026-08-07', '2026-08-07 15:30:00', '2026-08-07 16:57:00', '2026-08-07 17:57:00', '2026-08-08 00:30:00'),
    ('2026-08-08', '2026-08-08 15:40:00', '2026-08-08 17:10:00', '2026-08-08 18:10:00', '2026-08-09 00:00:00'),
    ('2026-08-09', '2026-08-09 11:00:00', '2026-08-09 16:15:00', '2026-08-09 17:15:00', '2026-08-09 22:45:00'),
    ('2026-08-11', '2026-08-11 15:40:00', '2026-08-11 16:40:00', '2026-08-11 17:40:00', '2026-08-11 23:45:00'),
    ('2026-08-12', '2026-08-12 15:37:00', '2026-08-12 17:01:00', '2026-08-12 18:01:00', '2026-08-12 23:15:00'),
    ('2026-08-13', '2026-08-13 15:40:00', '2026-08-13 17:26:00', '2026-08-13 18:26:00', '2026-08-14 00:00:00'),
    ('2026-08-14', '2026-08-14 15:40:00', '2026-08-14 17:35:00', '2026-08-14 18:35:00', '2026-08-14 23:55:00'),
    ('2026-08-18', '2026-08-18 15:40:00', '2026-08-18 17:08:00', '2026-08-18 18:08:00', '2026-08-18 23:36:00')
    ) as d(data_referencia, entrada, int_ini, int_fim, saida);

  delete from public.rh_atestados
   where colaborador_id = v_id and data_inicio between '2026-08-01' and '2026-08-18';
  insert into public.rh_atestados (unidade_id, colaborador_id, data_inicio, data_fim, parcial, observacao, registrado_por)
  values ('seldeestrela', v_id, '2026-08-15', '2026-08-15', false, 'Atestado do dia inteiro (folha de agosto)', 'Importação da folha de agosto');
  insert into public.rh_atestados (unidade_id, colaborador_id, data_inicio, data_fim, parcial, observacao, registrado_por)
  values ('seldeestrela', v_id, '2026-08-13', '2026-08-13', true, 'Saiu no meio do turno com atestado', 'Importação da folha de agosto');
  delete from public.rh_folgas_esporadicas
   where colaborador_id = v_id and data_folga in ('2026-08-16');
  insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
  values ('seldeestrela', v_id, '2026-08-16', 'Folga (folha de agosto)');
end $$;


-- ── JOSEPH ANDREY GOMES DA SILVA · Cozinheiro III ────────────────────────
do $$
declare
  v_id uuid;
  v_sets text;
begin
  -- Casa o nome sem depender de acento, espaço duplo ou maiúscula: "CEDEINE
  -- DEL VALLE" e "Cedeine  del Valle" são a mesma pessoa.
  select id into v_id from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(unaccent_simples(nome)) = upper(unaccent_simples('JOSEPH ANDREY GOMES DA SILVA'))
   limit 1;

  if v_id is null then
    -- Cria com cargo desde já: a coluna é NOT NULL, então inserir só o nome
    -- era recusado. Os demais campos entram no UPDATE logo abaixo, que só usa
    -- coluna que existe de verdade neste banco.
    insert into public.colaboradores (unidade_id, nome, cargo)
    values ('seldeestrela', 'JOSEPH ANDREY GOMES DA SILVA', 'Cozinheiro III')
    returning id into v_id;
    raise notice 'CRIADO (conferir se nao e duplicata): JOSEPH ANDREY GOMES DA SILVA';
  else
    raise notice 'ja existia: JOSEPH ANDREY GOMES DA SILVA';
  end if;

  -- Horário de trabalho da folha. Folga na segunda (dias_trabalho sem o 1).
  --
  -- Monta o UPDATE só com as colunas que existem de verdade neste banco. A
  -- primeira versão listava tudo direto e parou no "column ativo does not
  -- exist" — cada instalação tem um conjunto um pouco diferente, e não dá para
  -- adivinhar de fora.
  select string_agg(format('%I = %L', t.coluna, t.valor), ', ')
    into v_sets
    from (values
      ('cargo', 'Cozinheiro III'),
      ('data_admissao', '2026-04-17'),
      ('horario_entrada', '15:40'),
      ('horario_saida', '00:00'),
      ('horario_dom_entrada', null::text),
      ('horario_dom_saida', null::text),
      ('tempo_intervalo', '60'),
      ('dias_trabalho', '0,2,3,4,5,6'),
      ('tipo_contrato', 'Fixo')
    ) as t(coluna, valor)
   where exists (
     select 1 from information_schema.columns ic
      where ic.table_schema = 'public' and ic.table_name = 'colaboradores'
        and ic.column_name = t.coluna
   );

  if v_sets is not null then
    execute format('update public.colaboradores set %s where id = %L', v_sets, v_id);
  end if;

  -- Regrava o período inteiro, para rodar de novo não duplicar.
  delete from public.registro_ponto
   where colaborador_id = v_id
     and data_referencia between '2026-08-01' and '2026-08-18';

  insert into public.registro_ponto
    (colaborador_id, unidade_id, data_referencia, hora_entrada, hora_saida_intervalo,
     hora_retorno_intervalo, hora_saida, status_jornada, origem_batida)
  -- Os literais da lista VALUES chegam como texto; sem o cast o Postgres
  -- recusa com "column data_referencia is of type date but expression is of
  -- type text". Ele nao converte texto para data sozinho neste contexto.
  select v_id, 'seldeestrela', d.data_referencia::date, d.entrada::timestamptz,
         d.int_ini::timestamptz, d.int_fim::timestamptz, d.saida::timestamptz, 4, 'manual'
    from (values
    ('2026-08-01', '2026-08-01 15:40:00', '2026-08-01 16:00:00', '2026-08-01 17:00:00', '2026-08-02 00:24:00'),
    ('2026-08-02', '2026-08-02 15:40:00', '2026-08-02 16:00:00', '2026-08-02 17:00:00', '2026-08-03 00:14:00'),
    ('2026-08-04', '2026-08-04 15:40:00', '2026-08-04 17:00:00', '2026-08-04 18:00:00', '2026-08-05 00:37:00'),
    ('2026-08-05', '2026-08-05 15:40:00', '2026-08-05 17:20:00', '2026-08-05 18:20:00', '2026-08-06 00:02:00'),
    ('2026-08-06', '2026-08-06 15:40:00', '2026-08-06 17:20:00', '2026-08-06 18:20:00', '2026-08-07 00:49:00'),
    ('2026-08-07', '2026-08-07 15:40:00', '2026-08-07 17:24:00', '2026-08-07 18:24:00', '2026-08-08 00:34:00'),
    ('2026-08-08', '2026-08-08 15:40:00', '2026-08-08 18:00:00', '2026-08-08 19:00:00', '2026-08-09 00:50:00'),
    ('2026-08-09', '2026-08-09 15:40:00', '2026-08-09 17:00:00', '2026-08-09 18:00:00', '2026-08-10 00:13:00'),
    ('2026-08-11', '2026-08-11 15:40:00', '2026-08-11 16:40:00', '2026-08-11 17:40:00', '2026-08-12 00:40:00'),
    ('2026-08-12', '2026-08-12 15:40:00', '2026-08-12 18:20:00', '2026-08-12 19:20:00', '2026-08-12 23:50:00'),
    ('2026-08-13', '2026-08-13 15:40:00', '2026-08-13 18:00:00', '2026-08-13 19:00:00', '2026-08-14 00:30:00'),
    ('2026-08-14', '2026-08-14 15:40:00', '2026-08-14 18:10:00', '2026-08-14 19:10:00', '2026-08-15 00:41:00'),
    ('2026-08-15', '2026-08-15 15:40:00', '2026-08-15 16:55:00', '2026-08-15 17:55:00', '2026-08-16 00:05:00'),
    ('2026-08-18', '2026-08-18 15:40:00', '2026-08-18 17:10:00', '2026-08-18 18:10:00', '2026-08-19 00:00:00')
    ) as d(data_referencia, entrada, int_ini, int_fim, saida);

  delete from public.rh_atestados
   where colaborador_id = v_id and data_inicio between '2026-08-01' and '2026-08-18';

  delete from public.rh_folgas_esporadicas
   where colaborador_id = v_id and data_folga in ('2026-08-16');
  insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
  values ('seldeestrela', v_id, '2026-08-16', 'Folga (folha de agosto)');
end $$;


commit;


-- ── CONFERÊNCIA: rode depois e compare com as folhas ───────────────────────
select c.nome,
       count(*)                                          as dias_lancados,
       min(p.data_referencia)                            as primeiro,
       max(p.data_referencia)                            as ultimo,
       count(*) filter (where p.hora_saida is null)      as sem_saida
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where p.unidade_id = 'seldeestrela'
   and p.data_referencia between '2026-08-01' and '2026-08-18'
 group by c.nome
 order by c.nome;
-- Esperado: Larissa 15 · Alice 14 · Cedeine 15 · Brenda 15 · Eduarda 13 · Joseph 14
