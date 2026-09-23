/*
 FOLGA DE DOMINGO - 23/08/2026
 Alice, Andrey, Eduarda, Larissa, Cedeine e Brenda.

 23/08/2026 e o unico "dia 23" que cai num domingo por aqui: 23/09 e quarta e
 23/10 e sexta.

 A BATIDA DA EDUARDA NESSE DIA E APAGADA
 Havia ponto lancado para ela em 23/08 (11:06 | 15:18 | 16:18 | 19:24), mas
 ela nao trabalhou: era a folga dela. O resumo do dia sai.

 O que sai e o registro_ponto, que e o RESUMO que as telas leem e o que entra
 na folha. O livro do Anexo IX (ponto_marcacao) nao e tocado: se aquelas horas
 chegaram a ser batidas no aparelho, a marcacao original continua la, e e por
 isso que apagar o resumo e reversivel. O script imprime os valores antes de
 apagar, entao fica registrado tambem na saida do proprio SQL.

 A ultima consulta confere que ninguem mais ficou com folga E ponto no mesmo
 dia. Trabalhar na propria folga em domingo nao e proibido -- paga em dobro,
 Lei 605/49 art. 9 --, mas aqui nao e o caso.

 Rodar de novo nao duplica: a folga so entra se ainda nao existir.

 Como rodar: cole no SQL Editor do Supabase.
*/

do $$
declare
  v_unidade text := 'seldeestrela';
  v_data    date := '2026-08-23';
  r         record;
  v_colab   uuid;
  v_quantos int;
  v_novas   int := 0;
begin
  for r in
    select * from (values
      ('ALICE%'),
      ('%ANDREY%'),          /* nome do meio: Joseph Andrey Gomes da Silva */
      ('EDUARDA%'),
      ('LARISSA DA SILVA%'), /* nao confundir com Brenda Larissa */
      ('CEDEINE%'),
      ('BRENDA%')
    ) as t(pessoa)
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

    select id into v_colab
      from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa
     limit 1;

    insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
    select v_unidade, v_colab, v_data, 'Folga de domingo'
     where not exists (
       select 1 from public.rh_folgas_esporadicas f
        where f.colaborador_id = v_colab and f.data_folga = v_data
     );

    if found then
      v_novas := v_novas + 1;
      raise notice 'Folga de % em %', r.pessoa, to_char(v_data, 'DD/MM/YYYY');
    else
      raise notice '% ja tinha folga em %', r.pessoa, to_char(v_data, 'DD/MM/YYYY');
    end if;
  end loop;

  raise notice 'Folgas novas: %', v_novas;
end $$;


/* A Eduarda nao trabalhou no 23/08: o resumo do dia dela sai.
   Mostra o que sera apagado antes de apagar. */
do $$
declare
  v_unidade text := 'seldeestrela';
  v_data    date := '2026-08-23';
  v_colab   uuid;
  v_quantos int;
  r         record;
begin
  select count(*) into v_quantos
    from public.colaboradores
   where unidade_id = v_unidade and upper(nome) like 'EDUARDA%';
  if v_quantos <> 1 then
    raise notice 'PULEI a remocao: "EDUARDA%%" casou com % pessoa(s).', v_quantos;
    return;
  end if;

  select id into v_colab
    from public.colaboradores
   where unidade_id = v_unidade and upper(nome) like 'EDUARDA%'
   limit 1;

  for r in
    select (hora_entrada           at time zone 'America/Sao_Paulo')::time as e,
           (hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time as si,
           (hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time as ri,
           (hora_saida             at time zone 'America/Sao_Paulo')::time as s
      from public.registro_ponto
     where colaborador_id = v_colab and data_referencia = v_data
  loop
    raise notice 'Apagando o dia % da Eduarda: % | % | % | %',
      to_char(v_data, 'DD/MM'), coalesce(r.e::text,'--'), coalesce(r.si::text,'--'),
      coalesce(r.ri::text,'--'), coalesce(r.s::text,'--');
  end loop;

  delete from public.registro_ponto
   where colaborador_id = v_colab and data_referencia = v_data;
  get diagnostics v_quantos = row_count;
  raise notice 'Resumos apagados: % (0 = ja estava sem ponto nesse dia)', v_quantos;
end $$;


/* Confira quem ficou com folga no dia. */
select c.nome, to_char(f.data_folga, 'DD/MM/YYYY') as folga, f.descricao
  from public.rh_folgas_esporadicas f
  join public.colaboradores c on c.id = f.colaborador_id
 where f.unidade_id = 'seldeestrela'
   and f.data_folga = '2026-08-23'
 order by c.nome;


/* CONFERIR: tem que voltar ZERO linhas -- ninguem com folga E ponto no dia. */
select c.nome,
       (p.hora_entrada at time zone 'America/Sao_Paulo')::time as entrou,
       (p.hora_saida   at time zone 'America/Sao_Paulo')::time as saiu
  from public.rh_folgas_esporadicas f
  join public.colaboradores c  on c.id = f.colaborador_id
  join public.registro_ponto p on p.colaborador_id = f.colaborador_id
                              and p.data_referencia = f.data_folga
 where f.unidade_id = 'seldeestrela'
   and f.data_folga = '2026-08-23'
   and p.hora_entrada is not null
 order by c.nome;
