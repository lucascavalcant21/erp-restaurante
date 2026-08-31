/*
 FOLGA DE DOMINGO - 23/08/2026
 Alice, Andrey, Eduarda, Larissa, Cedeine e Brenda.

 23/08/2026 e o unico "dia 23" que cai num domingo por aqui: 23/09 e quarta e
 23/10 e sexta.

 ATENCAO - CONFERIR A EDUARDA
 Ela tem ponto batido nesse dia (11:06 | 15:18 | 16:18 | 19:24). Registrar a
 folga NAO apaga a batida, e as duas coisas juntas sao validas: quem trabalha
 na propria folga em domingo recebe em dobro (Lei 605/49, art. 9). Mas pode
 ser que ela nao devesse estar na lista. A ultima consulta abaixo mostra quem
 tem folga E ponto no mesmo dia, para voce decidir.

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


/* Confira quem ficou com folga no dia. */
select c.nome, to_char(f.data_folga, 'DD/MM/YYYY') as folga, f.descricao
  from public.rh_folgas_esporadicas f
  join public.colaboradores c on c.id = f.colaborador_id
 where f.unidade_id = 'seldeestrela'
   and f.data_folga = '2026-08-23'
 order by c.nome;


/* CONFERIR: quem tem folga E ponto batido no mesmo dia.
   Nao e erro por si so -- trabalhar na folga em domingo paga em dobro --,
   mas vale saber quem foi. */
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
