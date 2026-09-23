/*
 LARISSA - 26/08/2026: entrada 15:40 e saida 23:49

 O que estava gravado: 15:39 | 16:25 | 17:25 | 00:49.
 O que vai ficar:      15:40 | 16:25 | 17:25 | 23:49.

 A entrada de 15:39 e um minuto antes do turno, que comeca 15:40. A saida
 estava como 00:49 do dia 27; o correto e 23:49 do proprio dia 26, ou seja,
 nao virou a meia-noite.

 O intervalo (16:25 e 17:25) nao muda.

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
begin
  select to_regclass('public.ponto_marcacao') is not null into v_tem_livro;
  if not v_tem_livro then
    raise notice 'ponto_marcacao nao existe: so o resumo sera corrigido.';
  end if;

  for r in
    select * from (values
      ('LARISSA%', '2026-08-26', 'hora_entrada', 'entrada',        '2026-08-26 15:40:00-03'),
      ('LARISSA%', '2026-08-26', 'hora_saida',   'saida_trabalho', '2026-08-26 23:49:00-03')
    ) as t(pessoa, dia, campo, tipo, hora)
  loop
    v_data  := r.dia::date;
    v_campo := r.campo;
    v_tipo  := r.tipo;
    v_nova  := r.hora::timestamptz;

    select id into v_colab
      from public.colaboradores
     where unidade_id = v_unidade
       and upper(nome) like r.pessoa
     limit 1;

    if v_colab is null then
      raise exception 'Nao achei ninguem com nome % na unidade %.', r.pessoa, v_unidade;
    end if;

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

    /* 2) Resumo do dia, que e o que as telas leem. */
    v_status := case v_tipo when 'entrada' then 1 else 4 end;

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

    raise notice '% % -> % (antes: %)', r.pessoa, v_campo,
      to_char(v_nova at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      coalesce(to_char(v_antes at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'vazio');
  end loop;
end $$;


/* Confira: tem que sair 15:40 | 16:25 | 17:25 | 23:49. */
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
   and upper(c.nome) like 'LARISSA%'
   and p.data_referencia = '2026-08-26';
