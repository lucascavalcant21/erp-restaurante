/*
 CORREÇÕES DE SETEMBRO/2026 - JOSEPH E LARISSA

 JOSEPH ANDREY GOMES DA SILVA
   19/09: saída às 23:30.
   26/09: intervalo das 17:00 às 18:00 e saída à meia-noite.

 LARISSA DA SILVA UHE
   04/09, 16/09, 17/09, 19/09 e 26/09: saída à meia-noite.
   20/09: intervalo das 17:00 às 18:00 e saída às 23:45.

 Por que existe: pela tela de Corrigir batida seriam treze correções feitas
 uma a uma. Aqui sai tudo de uma vez, com o mesmo efeito - inclusive o
 registro no livro legal, que é o que a tela faz e um UPDATE solto não faria.
 COMO A CORREÇÃO É GRAVADA
 registro_ponto é o resumo que as telas mostram; ponto_marcacao é o livro do
 Anexo IX, imutável e encadeado por hash. A Portaria MTP 671/2021 não deixa
 reescrever marcação: corrigir é INSERIR um 'ajuste' guardando o valor
 anterior e quem corrigiu. É o que o bloco abaixo faz, nessa ordem.
 A SAÍDA À MEIA-NOITE é gravada como 00:00 do dia SEGUINTE (a de 26/09 é
 27/09 00:00), mas o dia de referência continua sendo o do turno - senão a
 jornada apareceria partida em dois dias.
 O "-03" no horário é obrigatório: a coluna é timestamptz e a sessão do
 Supabase roda em UTC. Sem o fuso, o banco guardaria 23:30 UTC e a tela
 mostraria 20:30.
 DIA SEM REGISTRO: só foram pedidas saída e intervalo, nenhuma entrada. Se
 algum dos dias não tiver linha nenhuma, a correção daquele dia é pulada
 e sai um aviso - criar um dia só com saída deixaria o espelho com uma
 jornada sem começo.
 Rodar de novo não duplica nada: o ajuste só entra se ainda não existir um
 igual, e o resumo é reescrito com o mesmo valor.
 Como rodar: cole no SQL Editor do Supabase e execute.
*/

do $$
declare
  v_unidade  text := 'seldeestrela';
  v_autor    text := 'Correção do proprietário (SQL Editor)';
  v_tem_livro boolean;

  r          record;
  v_colab    uuid;
  v_reg      uuid;
  v_data     date;
  v_campo    text;
  v_tipo     text;
  v_nova     timestamptz;
  v_antes    timestamptz;
  v_status   int;
begin
  select to_regclass('public.ponto_marcacao') is not null into v_tem_livro;
  if not v_tem_livro then
    raise notice 'ponto_marcacao não existe: só o resumo será corrigido. Rode db/migracao_ponto_nsr.sql para ter o livro legal.';
  end if;

/*
 Cada linha: pessoa, dia, campo do resumo, tipo da batida, hora corrigida.
*/
  for r in
    select * from (values
      ('JOSEPH ANDREY%', '2026-09-19', 'hora_saida',             'saida_trabalho',    '2026-09-19 23:30:00-03'),
      ('JOSEPH ANDREY%', '2026-09-26', 'hora_saida_intervalo',   'saida_intervalo',   '2026-09-26 17:00:00-03'),
      ('JOSEPH ANDREY%', '2026-09-26', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-09-26 18:00:00-03'),
      ('JOSEPH ANDREY%', '2026-09-26', 'hora_saida',             'saida_trabalho',    '2026-09-27 00:00:00-03'),

      ('LARISSA DA SILVA UHE%', '2026-09-04', 'hora_saida',             'saida_trabalho',    '2026-09-05 00:00:00-03'),
      ('LARISSA DA SILVA UHE%', '2026-09-16', 'hora_saida',             'saida_trabalho',    '2026-09-17 00:00:00-03'),
      ('LARISSA DA SILVA UHE%', '2026-09-17', 'hora_saida',             'saida_trabalho',    '2026-09-18 00:00:00-03'),
      ('LARISSA DA SILVA UHE%', '2026-09-19', 'hora_saida',             'saida_trabalho',    '2026-09-20 00:00:00-03'),
      ('LARISSA DA SILVA UHE%', '2026-09-20', 'hora_saida_intervalo',   'saida_intervalo',   '2026-09-20 17:00:00-03'),
      ('LARISSA DA SILVA UHE%', '2026-09-20', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-09-20 18:00:00-03'),
      ('LARISSA DA SILVA UHE%', '2026-09-20', 'hora_saida',             'saida_trabalho',    '2026-09-20 23:45:00-03'),
      ('LARISSA DA SILVA UHE%', '2026-09-26', 'hora_saida',             'saida_trabalho',    '2026-09-27 00:00:00-03')
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
      raise exception 'Não achei ninguém com nome % na unidade %.', r.pessoa, v_unidade;
    end if;

/*
 Valor anterior, para o livro registrar o que estava lá antes.
*/
    v_reg := null;
    v_antes := null;
    execute format('select id, %I from public.registro_ponto where colaborador_id = $1 and data_referencia = $2', v_campo)
      into v_reg, v_antes
      using v_colab, v_data;

    if v_reg is null then
      raise notice 'PULEI % % em %: o dia não tem registro (falta a entrada). Lance a entrada pela tela Corrigir batida e rode de novo.',
        r.pessoa, v_campo, to_char(v_data, 'DD/MM');
      continue;
    end if;

/*
 1) Livro legal primeiro. Se ele recusar, nada mais acontece: resumo
 corrigido sem marcação é pior do que correção nenhuma.
*/
    if v_tem_livro then
      insert into public.ponto_marcacao
        (unidade_id, colaborador_id, tipo, tipo_alvo, marcado_em, data_referencia,
         origem, coletor, valor_anterior, registrado_por)
      select v_unidade, v_colab, 'ajuste', v_tipo, v_nova, v_data,
/*
 coletor '05' = outro: correção digitada, não batida em coletor.
*/
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

/*
 2) Resumo do dia, que é o que as telas leem. greatest preserva o
 andamento: corrigir o intervalo não pode reabrir um dia que já tem saída.
*/
    v_status := case v_tipo
                  when 'entrada' then 1 when 'saida_intervalo' then 2
                  when 'retorno_intervalo' then 3 else 4 end;

    execute format(
      'update public.registro_ponto set %I = $1, status_jornada = greatest(coalesce(status_jornada, 1), $2) where id = $3', v_campo)
      using v_nova, v_status, v_reg;

    raise notice '% % -> % (antes: %)', r.pessoa, v_campo,
      to_char(v_nova at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      coalesce(to_char(v_antes at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'vazio');
  end loop;
end $$;


/*
 Confira.
 Joseph:  19/09 saída 23:30; 26/09 intervalo 17:00 / 18:00 e saída 00:00.
 Larissa: 04, 16, 17, 19 e 26/09 saída 00:00; 20/09 intervalo 17:00 / 18:00
          e saída 23:45.
*/
select c.nome,
       to_char(p.data_referencia, 'DD/MM')                                  as dia,
       (p.hora_entrada           at time zone 'America/Sao_Paulo')::time    as entrada,
       (p.hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time    as saiu_int,
       (p.hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time    as voltou_int,
       (p.hora_saida             at time zone 'America/Sao_Paulo')::time    as saida,
       p.status_jornada
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where c.unidade_id = 'seldeestrela'
   and ((upper(c.nome) like 'JOSEPH ANDREY%'
         and p.data_referencia in ('2026-09-19', '2026-09-26'))
     or (upper(c.nome) like 'LARISSA DA SILVA UHE%'
         and p.data_referencia in ('2026-09-04', '2026-09-16', '2026-09-17',
                                   '2026-09-19', '2026-09-20', '2026-09-26')))
 order by c.nome, p.data_referencia;
