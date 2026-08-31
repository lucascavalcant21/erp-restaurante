/*
 CORRECOES DE PONTO - 27 a 30/08/2026 (Larissa, Eduarda, Andrey e Cedeine)

 LARISSA
   29/08 (sab): faltava so a saida. Entrada e intervalo ficam como estao.
     antes:  15:40 | 18:24 | 19:25 | --:--
     depois: 15:40 | 18:24 | 19:25 | 00:00
   30/08 (dom): o dia inteiro.
     depois: 15:40 | 16:40 | 17:40 | 23:00

 EDUARDA
   29/08 (sab): so a saida vai para 00:00 (estava 00:16).
     depois: mantem entrada e intervalo | saida 00:00
   30/08 (dom): o domingo dela e outro turno -- entra 11h e sai 19:20, como no
     domingo 23/08 (11:06 | 15:18 | 16:18 | 19:24). Nao e o 15:40 dos dias de
     semana, e por isso o dia dela e lancado por inteiro.
     depois: 11:00 | 15:00 | 16:00 | 19:20

 ANDREY - o app gravou a mesma hora em campos seguidos.
   28/08: estava 15:40 | 15:40 | 00:27 | 00:27
     depois: 15:40 | 16:50 | 17:50 | 23:40
   30/08: estava 15:40 | 15:41 | 16:58 | 18:01
     depois: 15:40 | 16:50 | 17:50 | 23:00

 CEDEINE - mesmo defeito: a saida do intervalo bateu duas vezes.
   27/08: estava 15:40 | 18:11 | 18:12 | 18:12
     depois: 15:40 | 16:40 | 17:40 | 00:00

 BRENDA - so a entrada tinha sido batida.
   27/08: estava 15:40 | --:-- | --:-- | --:--
     depois: 15:40 | 16:40 | 17:40 | 22:00

 A saida 00:00 e do dia seguinte no relogio, mas o dia trabalhado continua
 sendo o anterior: o turno comeca de tarde e atravessa a meia-noite. Por isso a
 data_referencia fica no dia de entrada e so o horario cai no seguinte -- e
 como ja estao gravados os 00:15, 00:16 e 00:42 das outras noites.

 COMO A CORRECAO E GRAVADA
 registro_ponto e o resumo que as telas mostram; ponto_marcacao e o livro do
 Anexo IX, imutavel e encadeado por hash. Corrigir nao reescreve marcacao:
 entra um 'ajuste' guardando o valor anterior e quem corrigiu.

 O "-03" no horario e obrigatorio: a coluna e timestamptz e a sessao do
 Supabase roda em UTC. Sem o fuso, o banco guardaria 15:40 UTC e a tela
 mostraria 12:40.

 Rodar de novo nao duplica nada.

 Como rodar: cole no SQL Editor do Supabase e execute.
*/

do $$
declare
  v_unidade   text := 'seldeestrela';
  v_autor     text := 'Correcao do proprietario (SQL Editor)';
  v_tem_livro boolean;
  r           record;
  v_colab     uuid;
  v_reg       uuid;
  v_data      date;
  v_campo     text;
  v_tipo      text;
  v_nova      timestamptz;
  v_antes     timestamptz;
  v_status    int;
  v_quantos   int;
begin
  select to_regclass('public.ponto_marcacao') is not null into v_tem_livro;
  if not v_tem_livro then
    raise notice 'ponto_marcacao nao existe: so o resumo sera corrigido.';
  end if;

  for r in
    select * from (values
      /* LARISSA - 29/08: so a saida, que ficou em aberto. */
      ('%LARISSA%', '2026-08-29', 'hora_saida',             'saida_trabalho',    '2026-08-30 00:00:00-03'),
      /* LARISSA - 30/08: o dia inteiro. */
      ('%LARISSA%', '2026-08-30', 'hora_entrada',           'entrada',           '2026-08-30 15:40:00-03'),
      ('%LARISSA%', '2026-08-30', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-30 16:40:00-03'),
      ('%LARISSA%', '2026-08-30', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-30 17:40:00-03'),
      ('%LARISSA%', '2026-08-30', 'hora_saida',             'saida_trabalho',    '2026-08-30 23:00:00-03'),

      /* EDUARDA - 29/08: so a saida (estava 00:16). */
      ('%EDUARDA%', '2026-08-29', 'hora_saida',             'saida_trabalho',    '2026-08-30 00:00:00-03'),
      /* EDUARDA - 30/08: turno de domingo, 11h as 19:20. */
      ('%EDUARDA%', '2026-08-30', 'hora_entrada',           'entrada',           '2026-08-30 11:00:00-03'),
      ('%EDUARDA%', '2026-08-30', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-30 15:00:00-03'),
      ('%EDUARDA%', '2026-08-30', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-30 16:00:00-03'),
      ('%EDUARDA%', '2026-08-30', 'hora_saida',             'saida_trabalho',    '2026-08-30 19:20:00-03'),

      /* ANDREY - 28/08: o app repetiu a mesma hora em campos seguidos. */
      ('%ANDREY%',  '2026-08-28', 'hora_entrada',           'entrada',           '2026-08-28 15:40:00-03'),
      ('%ANDREY%',  '2026-08-28', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-28 16:50:00-03'),
      ('%ANDREY%',  '2026-08-28', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-28 17:50:00-03'),
      ('%ANDREY%',  '2026-08-28', 'hora_saida',             'saida_trabalho',    '2026-08-28 23:40:00-03'),
      /* ANDREY - 30/08. */
      ('%ANDREY%',  '2026-08-30', 'hora_entrada',           'entrada',           '2026-08-30 15:40:00-03'),
      ('%ANDREY%',  '2026-08-30', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-30 16:50:00-03'),
      ('%ANDREY%',  '2026-08-30', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-30 17:50:00-03'),
      ('%ANDREY%',  '2026-08-30', 'hora_saida',             'saida_trabalho',    '2026-08-30 23:00:00-03'),

      /* CEDEINE - 27/08: a saida do intervalo bateu duas vezes. */
      ('%CEDEINE%', '2026-08-27', 'hora_entrada',           'entrada',           '2026-08-27 15:40:00-03'),
      ('%CEDEINE%', '2026-08-27', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-27 16:40:00-03'),
      ('%CEDEINE%', '2026-08-27', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-27 17:40:00-03'),
      ('%CEDEINE%', '2026-08-27', 'hora_saida',             'saida_trabalho',    '2026-08-28 00:00:00-03'),

      /* BRENDA - 27/08: so a entrada tinha sido batida. */
      ('%BRENDA%',  '2026-08-27', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-27 16:40:00-03'),
      ('%BRENDA%',  '2026-08-27', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-27 17:40:00-03'),
      ('%BRENDA%',  '2026-08-27', 'hora_saida',             'saida_trabalho',    '2026-08-27 22:00:00-03')
    ) as t(pessoa, dia, campo, tipo, hora)
  loop
    v_data  := r.dia::date;
    v_campo := r.campo;
    v_tipo  := r.tipo;
    v_nova  := r.hora::timestamptz;

    /* O nome procurado pode estar no meio ("Joseph Andrey Gomes da Silva"),
       por isso a busca e por trecho. E por isso mesmo ela precisa recusar
       empate: com dois nomes parecidos, um `limit 1` escolheria um deles em
       silencio e o ajuste cairia no ponto de outra pessoa. */
    /* count e id em consultas separadas: o Postgres nao tem min() para uuid. */
    select count(*) into v_quantos
      from public.colaboradores
     where unidade_id = v_unidade
       and upper(nome) like r.pessoa;

    if v_quantos = 0 then
      raise exception 'Nao achei ninguem com nome % na unidade %.', r.pessoa, v_unidade;
    end if;
    if v_quantos > 1 then
      raise exception 'O trecho % casa com % pessoas na unidade %: %. Deixe o nome mais especifico.',
        r.pessoa, v_quantos, v_unidade,
        (select string_agg(nome, ', ') from public.colaboradores
          where unidade_id = v_unidade and upper(nome) like r.pessoa);
    end if;

    select id into v_colab
      from public.colaboradores
     where unidade_id = v_unidade
       and upper(nome) like r.pessoa
     limit 1;

    execute format('select id, %I from public.registro_ponto where colaborador_id = $1 and data_referencia = $2', v_campo)
      into v_reg, v_antes
      using v_colab, v_data;

    /* 1) Livro legal primeiro. Se ele recusar, nada mais acontece. */
    if v_tem_livro then
      insert into public.ponto_marcacao
        (unidade_id, colaborador_id, tipo, tipo_alvo, marcado_em, data_referencia,
         origem, coletor, valor_anterior, registrado_por)
      select v_unidade, v_colab, 'ajuste', v_tipo, v_nova, v_data,
             'ajuste', '05', v_antes, v_autor
       where not exists (
         select 1 from public.ponto_marcacao m
          where m.colaborador_id = v_colab
            and m.data_referencia = v_data
            and m.tipo = 'ajuste'
            and m.tipo_alvo = v_tipo
            and m.marcado_em = v_nova
       );
    end if;

    /* 2) Resumo do dia, que e o que as telas leem.
       O status acompanha a etapa da jornada: 1 entrou, 2 saiu para o
       intervalo, 3 voltou, 4 encerrou. Usar greatest evita que corrigir o
       intervalo depois da saida jogue o dia de volta para "em intervalo". */
    v_status := case v_tipo
                  when 'entrada'           then 1
                  when 'saida_intervalo'   then 2
                  when 'retorno_intervalo' then 3
                  else 4
                end;

    if v_reg is null then
      execute format(
        'insert into public.registro_ponto (colaborador_id, unidade_id, data_referencia, %I, status_jornada, origem_batida)
         values ($1, $2, $3, $4, $5, ''manual'')', v_campo)
        using v_colab, v_unidade, v_data, v_nova, v_status;
    else
      execute format(
        'update public.registro_ponto set %I = $1, status_jornada = greatest(coalesce(status_jornada, 1), $2) where id = $3', v_campo)
        using v_nova, v_status, v_reg;
    end if;

    raise notice '% % % -> % (antes: %)', r.pessoa, r.dia, v_campo,
      to_char(v_nova at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      coalesce(to_char(v_antes at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'vazio');
  end loop;
end $$;


/* Confira:
   LARISSA 29/08 -> 15:40 | 18:24 | 19:25 | 00:00
   LARISSA 30/08 -> 15:40 | 16:40 | 17:40 | 23:00
   EDUARDA 29/08 -> (entrada e intervalo como estavam) | 00:00
   EDUARDA 30/08 -> 11:00 | 15:00 | 16:00 | 19:20
   ANDREY  28/08 -> 15:40 | 16:50 | 17:50 | 23:40
   ANDREY  30/08 -> 15:40 | 16:50 | 17:50 | 23:00
   CEDEINE 27/08 -> 15:40 | 16:40 | 17:40 | 00:00
   BRENDA  27/08 -> 15:40 | 16:40 | 17:40 | 22:00  */
select c.nome,
       to_char(p.data_referencia, 'DD/MM')                               as dia,
       (p.hora_entrada           at time zone 'America/Sao_Paulo')::time as entrada,
       (p.hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time as saiu_int,
       (p.hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time as voltou_int,
       (p.hora_saida             at time zone 'America/Sao_Paulo')::time as saida,
       p.status_jornada
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where c.unidade_id = 'seldeestrela'
   and (upper(c.nome) like '%LARISSA%' or upper(c.nome) like '%EDUARDA%'
        or upper(c.nome) like '%ANDREY%' or upper(c.nome) like '%CEDEINE%'
        or upper(c.nome) like '%BRENDA%')
   and p.data_referencia between '2026-08-27' and '2026-08-30'
 order by c.nome, p.data_referencia;
