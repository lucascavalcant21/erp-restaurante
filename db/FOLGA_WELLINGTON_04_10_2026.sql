/*
 FOLGA DE DOMINGO DO WELLINGTON (INATIVO) - 04/10/2026
 Unidade: seldeestrela

 Insere a folga de domingo (04/10/2026) em rh_folgas_esporadicas para o colaborador Wellington (inativo).
 Como rodar: copie e cole no SQL Editor do Supabase.
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
      ('%WELLIG%', '2026-10-04')
    ) as t(pessoa, dia)
  loop
    select count(*) into v_quantos
      from public.colaboradores
     where unidade_id = v_unidade and upper(nome) like r.pessoa;

    if v_quantos = 0 then
      select count(*) into v_quantos
        from public.colaboradores
       where unidade_id = v_unidade and upper(nome) like '%WELLING%';
      if v_quantos = 0 then
        raise exception 'Não achei ninguém com nome % na unidade %.', r.pessoa, v_unidade;
      else
        select id into v_colab
          from public.colaboradores
         where unidade_id = v_unidade and upper(nome) like '%WELLING%';
      end if;
    elsif v_quantos > 1 then
      raise exception 'Mais de uma pessoa encontrada: %. Deixe o nome mais específico.',
        (select string_agg(nome, ', ') from public.colaboradores where unidade_id = v_unidade and upper(nome) like r.pessoa);
    else
      select id into v_colab
        from public.colaboradores
       where unidade_id = v_unidade and upper(nome) like r.pessoa;
    end if;

    -- Se existia folga lançada por engano no dia 04/09/2026, remove
    delete from public.rh_folgas_esporadicas
     where colaborador_id = v_colab and data_folga = '2026-09-04'::date;

    -- Insere a folga no domingo 04/10/2026
    insert into public.rh_folgas_esporadicas (unidade_id, colaborador_id, data_folga, descricao)
    select v_unidade, v_colab, r.dia::date, 'Folga de domingo'
     where not exists (
       select 1 from public.rh_folgas_esporadicas f
        where f.colaborador_id = v_colab and f.data_folga = r.dia::date
     );

    if found then
      v_novas := v_novas + 1;
      raise notice 'Folga de domingo registrada para % no dia %', (select nome from public.colaboradores where id = v_colab), to_char(r.dia::date, 'DD/MM/YYYY');
    else
      raise notice '% já possuía folga de domingo em %', (select nome from public.colaboradores where id = v_colab), to_char(r.dia::date, 'DD/MM/YYYY');
    end if;
  end loop;

  raise notice 'Folgas inseridas: %', v_novas;
end $$;

-- Conferência:
select c.nome, c.status, to_char(f.data_folga, 'DD/MM/YYYY') as data_folga, f.descricao
  from public.rh_folgas_esporadicas f
  join public.colaboradores c on c.id = f.colaborador_id
 where f.unidade_id = 'seldeestrela'
   and (upper(c.nome) like '%WELLIG%' or upper(c.nome) like '%WELLING%')
 order by f.data_folga desc;
