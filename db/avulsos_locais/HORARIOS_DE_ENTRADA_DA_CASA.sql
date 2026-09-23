/*
 HORARIO DE ENTRADA DE CADA PESSOA

 A REGRA DA CASA
   Terca a sabado ...... 15:40 para todos
   Domingo ............. Cedeine 09:00, Eduarda 11:00, os demais 15:40
   Segunda ............. fechado

 POR QUE ISSO IMPORTA
 O bloqueio de bater antes do turno JA existe no app, mas ele nao tem regra
 propria: le o cadastro da pessoa. Se `horario_entrada` estiver vazio, o app
 LIBERA a batida a qualquer hora (de proposito -- travar o ponto de alguem por
 falta de cadastro seria pior). Ou seja, a regra so vale de verdade depois que
 este script roda.

 O mesmo cadastro decide o calculo da folha: a jornada paga comeca na batida
 ou na hora do turno, o que vier depois.

 COMO O APP LE (nesta ordem)
   1. horarios_dia[dia]  -> so quando horario_por_dia = true
   2. horario_dom_entrada -> so no domingo
   3. horario_entrada     -> o fixo, todos os outros dias
 Domingo sem `horario_dom_entrada` cai no fixo, entao os demais ficam 15:40 no
 domingo sem precisar de linha propria.

 Rodar de novo nao muda nada.

 Como rodar: cole no SQL Editor do Supabase.
*/

/* ────────────────────────────────────────────────────────────────────────
   1) COMO ESTA HOJE -- rode sozinha primeiro.
   ──────────────────────────────────────────────────────────────────────── */
select nome,
       coalesce(nullif(horario_entrada, ''), '(vazio -- entrada liberada!)') as ter_a_sab,
       coalesce(nullif(horario_dom_entrada, ''), '(usa o fixo)')             as domingo,
       coalesce(horario_por_dia, false)                                      as por_dia_da_semana
  from public.colaboradores
 where unidade_id = 'seldeestrela'
 order by nome;


/* ────────────────────────────────────────────────────────────────────────
   2) GRAVA A REGRA.
   ──────────────────────────────────────────────────────────────────────── */
do $$
declare
  v_unidade text := 'seldeestrela';
  r         record;
  v_quantos int;
begin
  /* Terca a sabado: 15:40 para todo mundo da unidade. */
  update public.colaboradores
     set horario_entrada = '15:40'
   where unidade_id = v_unidade
     and coalesce(horario_entrada, '') <> '15:40';
  get diagnostics v_quantos = row_count;
  raise notice 'Entrada fixa 15:40 aplicada em % pessoa(s).', v_quantos;

  /* Domingo, so quem tem hora diferente. O trecho do nome precisa casar com
     UMA pessoa: "%LARISSA%" pegaria Brenda Larissa E Larissa da Silva, e a
     regra iria para a errada em silencio. */
  for r in
    select * from (values
      ('CEDEINE%', '09:00'),
      ('EDUARDA%', '11:00')
    ) as t(pessoa, hora)
  loop
    select count(*) into v_quantos
      from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa;

    if v_quantos = 0 then
      raise notice 'PULEI %: nao achei ninguem com esse nome.', r.pessoa;
      continue;
    end if;
    if v_quantos > 1 then
      raise exception 'O trecho % casa com % pessoas: %. Deixe o nome mais especifico.',
        r.pessoa, v_quantos,
        (select string_agg(nome, ', ') from public.colaboradores
          where unidade_id = v_unidade and upper(nome) like r.pessoa);
    end if;

    update public.colaboradores
       set horario_dom_entrada = r.hora
     where unidade_id = v_unidade and upper(nome) like r.pessoa;
    raise notice 'Domingo de % -> %', r.pessoa, r.hora;
  end loop;

  /* Quem tem jornada por dia da semana ligada ignora os dois campos acima e
     manda no proprio JSON -- que este script nao mexe. Avisa para nao ficar
     a impressao de que a regra pegou todo mundo. */
  select count(*) into v_quantos
    from public.colaboradores
   where unidade_id = v_unidade and coalesce(horario_por_dia, false);
  if v_quantos > 0 then
    raise notice 'ATENCAO: % pessoa(s) usam jornada por dia da semana e seguem o JSON delas, nao estes campos.', v_quantos;
  end if;
end $$;


/* ────────────────────────────────────────────────────────────────────────
   3) CONFERENCIA -- ter a sab 15:40; domingo so Cedeine 09:00 e Eduarda 11:00.
   ──────────────────────────────────────────────────────────────────────── */
select nome,
       horario_entrada                                          as ter_a_sab,
       coalesce(nullif(horario_dom_entrada, ''), horario_entrada) as domingo,
       coalesce(horario_por_dia, false)                          as por_dia_da_semana
  from public.colaboradores
 where unidade_id = 'seldeestrela'
 order by nome;
