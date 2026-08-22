-- ─────────────────────────────────────────────────────────────────────────────
-- ALICE — 21/08/2026: entrada às 15:40
--
-- O que aconteceu: ela bateu 15:40, a tela confirmou, e nada foi gravado no dia
-- de hoje. Duas causas somadas, as duas já corrigidas no sistema:
--   · a tela lia o registro de ONTEM como se fosse o de hoje;
--   · a gravação não era conferida — o banco pode devolver sucesso sem escrever
--     nada, e era isso que produzia o "OK" mentiroso.
--
-- Este SQL põe a entrada dela em 15:40 de hoje. Trata os dois casos: corrige se
-- o dia já tem linha, cria se não tem.
--
-- O "-03" é obrigatório: a coluna é timestamptz e a sessão roda em UTC. Sem o
-- fuso, o banco guardaria 15:40 UTC e a tela mostraria 12:40.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_id  uuid;
  v_reg uuid;
begin
  select id into v_id
    from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(nome) like 'ALICE%'
   limit 1;

  if v_id is null then
    raise exception 'Alice não encontrada na unidade seldeestrela.';
  end if;

  select id into v_reg
    from public.registro_ponto
   where colaborador_id = v_id
     and data_referencia = '2026-08-21';

  if v_reg is null then
    insert into public.registro_ponto
      (colaborador_id, unidade_id, data_referencia, hora_entrada, status_jornada, origem_batida)
    values
      (v_id, 'seldeestrela', '2026-08-21'::date,
       '2026-08-21 15:40:00-03'::timestamptz, 1, 'manual');
    raise notice 'Dia 21/08 criado com entrada 15:40.';
  else
    update public.registro_ponto
       set hora_entrada   = '2026-08-21 15:40:00-03'::timestamptz,
           status_jornada = greatest(coalesce(status_jornada, 1), 1)
     where id = v_reg;
    raise notice 'Entrada de 21/08 corrigida para 15:40.';
  end if;
end $$;


-- ── A batida perdida pode ter caído no dia 20 ───────────────────────────────
-- Se a tela leu o registro de ontem, a batida de hoje foi escrita LÁ. Confira
-- o dia 20 dela: um horário do fim da tarde num campo de intervalo, quando ela
-- já tinha encerrado aquele dia, é a batida de hoje no lugar errado.
select c.nome,
       p.data_referencia,
       (p.hora_entrada           at time zone 'America/Sao_Paulo')::time as entrada,
       (p.hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time as saiu_int,
       (p.hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time as voltou_int,
       (p.hora_saida             at time zone 'America/Sao_Paulo')::time as saida,
       p.status_jornada
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where c.unidade_id = 'seldeestrela'
   and upper(c.nome) like 'ALICE%'
   and p.data_referencia between '2026-08-20' and '2026-08-21'
 order by p.data_referencia;
