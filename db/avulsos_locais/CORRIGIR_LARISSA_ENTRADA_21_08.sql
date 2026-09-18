-- ─────────────────────────────────────────────────────────────────────────────
-- LARISSA — 21/08/2026: entrada às 15:40
--
-- Por que existe: a batida do dia 21 não foi registrada porque o botão do
-- tablet estava quebrado. A entrada dela é 15:40 e é isso que vai no sistema.
--
-- Trata os dois casos: se o dia já tem linha (por causa de outra batida), só
-- corrige a entrada; se não tem, cria a linha. Sem isso, um simples UPDATE não
-- faria nada quando a batida falhou por completo — e o dia ficaria como falta.
--
-- O "-03" no horário é obrigatório: a coluna é timestamptz e a sessão do
-- Supabase roda em UTC. Sem o fuso, o banco guardaria 15:40 UTC e a tela
-- mostraria 12:40.
--
-- Como rodar: cole no SQL Editor do Supabase e execute.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_id  uuid;
  v_reg uuid;
begin
  select id into v_id
    from public.colaboradores
   where unidade_id = 'seldeestrela'
     and upper(nome) like 'LARISSA%'
   limit 1;

  if v_id is null then
    raise exception 'Larissa não encontrada na unidade seldeestrela.';
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
    raise notice 'Dia criado com a entrada às 15:40.';
  else
    update public.registro_ponto
       set hora_entrada = '2026-08-21 15:40:00-03'::timestamptz,
           -- greatest preserva o andamento: se ela já bateu intervalo ou saída
           -- depois, corrigir a entrada não pode voltar o dia para o começo.
           status_jornada = greatest(coalesce(status_jornada, 1), 1)
     where id = v_reg;
    raise notice 'Entrada corrigida para 15:40.';
  end if;
end $$;


-- Confira (entrada tem que sair 15:40:00):
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
   and upper(c.nome) like 'LARISSA%'
   and p.data_referencia = '2026-08-21';
