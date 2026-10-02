/*
 FOLGAS DE DOMINGO - SETEMBRO/2026
   13/09: Larissa, Alice e Andrey.
   20/09: Welligton e Matheus.
   27/09: Eduarda.

 Os três dias são domingo, por isso entram como "Folga de domingo", no mesmo
 molde do db/FOLGA_DOMINGO_23_08.sql.

 NADA É APAGADO
 Se alguém tiver ponto batido no dia da folga, o ponto continua lá. A última
 consulta lista quem ficou com folga E ponto no mesmo dia, para você decidir
 caso a caso. Trabalhar na folga de domingo não é proibido -- paga em dobro,
 Lei 605/49 art. 9.

 NOME QUE CASA COM MAIS DE UMA PESSOA para tudo antes de gravar e diz quem
 são: aí é só deixar o trecho do nome mais específico.

 Rodar de novo não duplica: a folga só entra se ainda não existir.

 Como rodar: cole no SQL Editor do Supabase.
*/

do $$
declare
  v_unidade text := 'seldeestrela';
  r         record;
  v_colab   uuid;
  v_quantos int;
  v_novas   int := 0;
begin
  for r in
    select * from (values
      ('LARISSA DA SILVA%',       '2026-09-13'), /* não confundir com Brenda Larissa */
      ('ALICE%',                  '2026-09-13'),
      ('%ANDREY%',                '2026-09-13'), /* nome do meio: Joseph Andrey Gomes da Silva */
      ('WELLIGTON%',              '2026-09-20'),
      ('MATHEUS DA SILVA PELLI%', '2026-09-20'),
      ('EDUARDA DE LIMA%',        '2026-09-27')
    ) as t(pessoa, dia)
  loop
    select count(*) into v_quantos
      from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa;

    if v_quantos = 0 then
      raise exception 'Não achei ninguém com nome % na unidade %.', r.pessoa, v_unidade;
    end if;
    if v_quantos > 1 then
      raise exception 'O trecho % casa com % pessoas: %. Deixe o nome mais específico.',
        r.pessoa, v_quantos,
        (select string_agg(nome, ', ') from public.colaboradores
          where unidade_id = v_unidade and upper(nome) like r.pessoa);
    end if;

    select id into v_colab
      from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa;

    insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
    select v_unidade, v_colab, r.dia::date, 'Folga de domingo'
     where not exists (
       select 1 from public.rh_folgas_esporadicas f
        where f.colaborador_id = v_colab and f.data_folga = r.dia::date
     );

    if found then
      v_novas := v_novas + 1;
      raise notice 'Folga de % em %', r.pessoa, to_char(r.dia::date, 'DD/MM/YYYY');
    else
      raise notice '% já tinha folga em %', r.pessoa, to_char(r.dia::date, 'DD/MM/YYYY');
    end if;
  end loop;

  raise notice 'Folgas novas: %', v_novas;
end $$;


/* Confira quem ficou com folga nos três domingos. */
select c.nome, to_char(f.data_folga, 'DD/MM/YYYY') as folga, f.descricao
  from public.rh_folgas_esporadicas f
  join public.colaboradores c on c.id = f.colaborador_id
 where f.unidade_id = 'seldeestrela'
   and f.data_folga in ('2026-09-13', '2026-09-20', '2026-09-27')
 order by f.data_folga, c.nome;


/* CONFERIR: quem tem folga E ponto batido no mesmo dia. O ideal é voltar
   ZERO linhas; se vier alguém, me diga se o ponto daquele dia sai ou fica. */
select c.nome,
       to_char(f.data_folga, 'DD/MM') as dia,
       (p.hora_entrada at time zone 'America/Sao_Paulo')::time as entrou,
       (p.hora_saida   at time zone 'America/Sao_Paulo')::time as saiu
  from public.rh_folgas_esporadicas f
  join public.colaboradores c  on c.id = f.colaborador_id
  join public.registro_ponto p on p.colaborador_id = f.colaborador_id
                              and p.data_referencia = f.data_folga
 where f.unidade_id = 'seldeestrela'
   and f.data_folga in ('2026-09-13', '2026-09-20', '2026-09-27')
   and p.hora_entrada is not null
 order by f.data_folga, c.nome;
