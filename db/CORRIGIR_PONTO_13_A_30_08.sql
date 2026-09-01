/*
 CORRECOES DE PONTO E ATESTADOS - 13 a 30/08/2026

 CONFERIR ANTES DE RODAR
 Voce escreveu "tirar o horario da Brenda de 27/09". 27/09 ainda nao aconteceu
 (hoje e 31/08), e no mesmo pedido veio "25 a 30/08 tudo atestado da Brenda" --
 que inclui o 27/08. Entendi como 27/08: as batidas dela saem e o dia entra no
 atestado. Se era 27/09 mesmo, me avise que eu troco.

 O QUE ESTE SCRIPT FAZ

 1) LANCA O TURNO PADRAO (15:40 | 16:40 | 17:40 | 00:00 do dia seguinte)
    Alice ....... 19/08 (qua) e 22/08 (sab)
    Andrey ...... 19/08 (qua)
    Cedeine ..... 19/08 (qua)
    Eduarda ..... 19/08 (qua)
    Larissa ..... 19/08 (qua)

 2) EDUARDA 13/08: saida as 18:10, logo depois do intervalo. Entrada e
    intervalo ficam como estao.

 3) APAGA O PONTO dos dias que viraram atestado. Registro de ponto e atestado
    no mesmo dia se contradizem: um diz que trabalhou, o outro que nao.
    Brenda ...... 25, 26, 27, 28, 29 e 30/08
    Cedeine ..... 28, 29 e 30/08
    Eduarda ..... 15 e 16/08

 4) LANCA OS ATESTADOS, cada um como UM periodo (e um documento so):
    Brenda ...... 25/08 a 30/08
    Cedeine ..... 28/08 a 30/08
    Eduarda ..... 15/08 a 16/08

 5) FOLGA DE DOMINGO DA EDUARDA: sai do 16/08 (que virou atestado) e vai para
    23/08.

 O livro do Anexo IX nao e reescrito: cada alteracao entra como 'ajuste' com o
 valor anterior e quem corrigiu. As remocoes tiram o RESUMO que as telas leem;
 as marcacoes originais, se existirem, continuam la.

 Rodar de novo nao duplica nada.
 Como rodar: cole no SQL Editor do Supabase.
*/

do $$
declare
  v_unidade text := 'seldeestrela';
  v_autor   text := 'Correcao do proprietario (SQL Editor)';
  v_livro   boolean;
  r         record;
  v_colab   uuid;
  v_quantos int;
  v_reg     uuid;
  v_antes   timestamptz;
  v_nova    timestamptz;
  v_status  int;
  v_n       int;
begin
  /* Cada trecho de nome abaixo precisa casar com UMA pessoa. "%LARISSA%"
     pegaria Brenda Larissa E Larissa da Silva, e escolher em silencio
     lancaria o ajuste no ponto de quem nao era -- por isso o script para. */
  select to_regclass('public.ponto_marcacao') is not null into v_livro;

  /* ─── 1 e 2) Horarios ─────────────────────────────────────────────────── */
  for r in
    select * from (values
      /* turno padrao: entrada, saida do intervalo, volta, saida */
      ('ALICE%',            '2026-08-19', 'hora_entrada',           'entrada',           '2026-08-19 15:40:00-03'),
      ('ALICE%',            '2026-08-19', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-19 16:40:00-03'),
      ('ALICE%',            '2026-08-19', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-19 17:40:00-03'),
      ('ALICE%',            '2026-08-19', 'hora_saida',             'saida_trabalho',    '2026-08-20 00:00:00-03'),
      ('ALICE%',            '2026-08-22', 'hora_entrada',           'entrada',           '2026-08-22 15:40:00-03'),
      ('ALICE%',            '2026-08-22', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-22 16:40:00-03'),
      ('ALICE%',            '2026-08-22', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-22 17:40:00-03'),
      ('ALICE%',            '2026-08-22', 'hora_saida',             'saida_trabalho',    '2026-08-23 00:00:00-03'),

      ('%ANDREY%',          '2026-08-19', 'hora_entrada',           'entrada',           '2026-08-19 15:40:00-03'),
      ('%ANDREY%',          '2026-08-19', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-19 16:40:00-03'),
      ('%ANDREY%',          '2026-08-19', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-19 17:40:00-03'),
      ('%ANDREY%',          '2026-08-19', 'hora_saida',             'saida_trabalho',    '2026-08-20 00:00:00-03'),

      ('CEDEINE%',          '2026-08-19', 'hora_entrada',           'entrada',           '2026-08-19 15:40:00-03'),
      ('CEDEINE%',          '2026-08-19', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-19 16:40:00-03'),
      ('CEDEINE%',          '2026-08-19', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-19 17:40:00-03'),
      ('CEDEINE%',          '2026-08-19', 'hora_saida',             'saida_trabalho',    '2026-08-20 00:00:00-03'),

      ('EDUARDA%',          '2026-08-19', 'hora_entrada',           'entrada',           '2026-08-19 15:40:00-03'),
      ('EDUARDA%',          '2026-08-19', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-19 16:40:00-03'),
      ('EDUARDA%',          '2026-08-19', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-19 17:40:00-03'),
      ('EDUARDA%',          '2026-08-19', 'hora_saida',             'saida_trabalho',    '2026-08-20 00:00:00-03'),
      /* 13/08: so a saida, logo depois do intervalo. */
      ('EDUARDA%',          '2026-08-13', 'hora_saida',             'saida_trabalho',    '2026-08-13 18:10:00-03'),

      ('LARISSA DA SILVA%', '2026-08-19', 'hora_entrada',           'entrada',           '2026-08-19 15:40:00-03'),
      ('LARISSA DA SILVA%', '2026-08-19', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-19 16:40:00-03'),
      ('LARISSA DA SILVA%', '2026-08-19', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-19 17:40:00-03'),
      ('LARISSA DA SILVA%', '2026-08-19', 'hora_saida',             'saida_trabalho',    '2026-08-20 00:00:00-03')
    ) as t(pessoa, dia, campo, tipo, hora)
  loop
    select count(*) into v_quantos from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa;
    if v_quantos = 0 then
      raise notice 'PULEI %: nao achei ninguem com esse nome.', r.pessoa; continue;
    end if;
    if v_quantos > 1 then
      raise exception 'O trecho % casa com % pessoas: %. Deixe o nome mais especifico.',
        r.pessoa, v_quantos,
        (select string_agg(nome, ', ') from public.colaboradores
          where unidade_id = v_unidade and upper(nome) like r.pessoa);
    end if;
    select id into v_colab from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa limit 1;

    v_nova := r.hora::timestamptz;
    execute format('select id, %I from public.registro_ponto where colaborador_id = $1 and data_referencia = $2', r.campo)
      into v_reg, v_antes using v_colab, r.dia::date;

    if v_livro then
      insert into public.ponto_marcacao
        (unidade_id, colaborador_id, tipo, tipo_alvo, marcado_em, data_referencia,
         origem, coletor, valor_anterior, registrado_por)
      select v_unidade, v_colab, 'ajuste', r.tipo, v_nova, r.dia::date,
             'ajuste', '05', v_antes, v_autor
       where not exists (
         select 1 from public.ponto_marcacao m
          where m.colaborador_id = v_colab and m.data_referencia = r.dia::date
            and m.tipo = 'ajuste' and m.tipo_alvo = r.tipo and m.marcado_em = v_nova);
    end if;

    v_status := case r.tipo when 'entrada' then 1 when 'saida_intervalo' then 2
                            when 'retorno_intervalo' then 3 else 4 end;
    if v_reg is null then
      execute format(
        'insert into public.registro_ponto (colaborador_id, unidade_id, data_referencia, %I, status_jornada, origem_batida)
         values ($1, $2, $3, $4, $5, ''manual'')', r.campo)
        using v_colab, v_unidade, r.dia::date, v_nova, v_status;
    else
      execute format(
        'update public.registro_ponto set %I = $1, status_jornada = greatest(coalesce(status_jornada,1), $2) where id = $3', r.campo)
        using v_nova, v_status, v_reg;
    end if;
    raise notice '% % % -> %', r.pessoa, r.dia, r.campo,
      to_char(v_nova at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI');
  end loop;

  /* ─── 3) Apaga o ponto dos dias de atestado ───────────────────────────── */
  for r in
    select * from (values
      ('BRENDA%',  '2026-08-25', '2026-08-30'),
      ('CEDEINE%', '2026-08-28', '2026-08-30'),
      ('EDUARDA%', '2026-08-15', '2026-08-16')
    ) as t(pessoa, de, ate)
  loop
    select count(*) into v_quantos from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa;
    if v_quantos <> 1 then
      raise notice 'PULEI a limpeza de %: casou com % pessoa(s).', r.pessoa, v_quantos; continue;
    end if;
    select id into v_colab from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa limit 1;

    delete from public.registro_ponto
     where colaborador_id = v_colab
       and data_referencia between r.de::date and r.ate::date;
    get diagnostics v_n = row_count;
    raise notice 'Ponto apagado de % (% a %): % dia(s)', r.pessoa, r.de, r.ate, v_n;

    /* ─── 4) Atestado como UM periodo ───────────────────────────────────── */
    insert into public.rh_atestados (unidade_id, colaborador_id, data_inicio, data_fim, observacao, registrado_por)
    select v_unidade, v_colab, r.de::date, r.ate::date, 'Atestado medico', v_autor
     where not exists (
       select 1 from public.rh_atestados a
        where a.colaborador_id = v_colab and a.data_inicio = r.de::date and a.data_fim = r.ate::date);
    get diagnostics v_n = row_count;
    raise notice 'Atestado de % (% a %): %', r.pessoa, r.de, r.ate,
      case when v_n > 0 then 'lancado' else 'ja existia' end;
  end loop;

  /* ─── 5) Folga de domingo da Eduarda: sai do 16/08, vai para 23/08 ────── */
  select count(*) into v_quantos from public.colaboradores
   where unidade_id = v_unidade and upper(nome) like 'EDUARDA%';
  if v_quantos = 1 then
    select id into v_colab from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like 'EDUARDA%' limit 1;

    delete from public.rh_folgas_esporadicas
     where colaborador_id = v_colab and data_folga = '2026-08-16';
    get diagnostics v_n = row_count;
    raise notice 'Folga da Eduarda em 16/08 removida (virou atestado): %', v_n;

    insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
    select v_unidade, v_colab, '2026-08-23'::date, 'Folga de domingo'
     where not exists (
       select 1 from public.rh_folgas_esporadicas f
        where f.colaborador_id = v_colab and f.data_folga = '2026-08-23');
    get diagnostics v_n = row_count;
    raise notice 'Folga da Eduarda em 23/08: %', case when v_n > 0 then 'lancada' else 'ja existia' end;
  else
    raise notice 'PULEI a folga da Eduarda: "EDUARDA%%" casou com % pessoa(s).', v_quantos;
  end if;
end $$;


/* CONFERENCIA 1 - os dias lancados. */
select c.nome, to_char(p.data_referencia, 'DD/MM') as dia,
       (p.hora_entrada           at time zone 'America/Sao_Paulo')::time as entrada,
       (p.hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time as saiu_int,
       (p.hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time as voltou_int,
       (p.hora_saida             at time zone 'America/Sao_Paulo')::time as saida
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where c.unidade_id = 'seldeestrela'
   and p.data_referencia in ('2026-08-13','2026-08-19','2026-08-22')
 order by c.nome, p.data_referencia;

/* CONFERENCIA 2 - atestados lancados. */
select c.nome, to_char(a.data_inicio,'DD/MM') as de, to_char(a.data_fim,'DD/MM') as ate, a.observacao
  from public.rh_atestados a
  join public.colaboradores c on c.id = a.colaborador_id
 where a.unidade_id = 'seldeestrela' and a.data_inicio >= '2026-08-01'
 order by c.nome, a.data_inicio;

/* CONFERENCIA 3 - tem que voltar ZERO: ponto lancado em dia de atestado. */
select c.nome, to_char(p.data_referencia,'DD/MM') as dia_com_ponto_e_atestado
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
  join public.rh_atestados a on a.colaborador_id = p.colaborador_id
                            and p.data_referencia between a.data_inicio and a.data_fim
 where c.unidade_id = 'seldeestrela'
 order by c.nome, p.data_referencia;
