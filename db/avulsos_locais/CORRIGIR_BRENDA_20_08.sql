-- ─────────────────────────────────────────────────────────────────────────────
-- BRENDA — 20/08/2026: volta do intervalo às 17:11
--
-- Por que o horário vai com "-03": a coluna é timestamptz e a sessão do
-- Supabase roda em UTC. Escrever '2026-08-20 17:11:00' guardaria 17:11 UTC e a
-- tela mostraria 14:11 — foi exatamente o erro de 3 horas da importação de
-- agosto. Com o fuso explícito o banco guarda 20:11 UTC e a tela mostra 17:11,
-- independente da sessão de quem roda.
--
-- O status volta para 3 (voltou do intervalo) só se a jornada ainda não tiver
-- sido encerrada: greatest preserva o 4 de quem já bateu a saída.
--
-- Como rodar: cole no SQL Editor do Supabase e execute.
-- ─────────────────────────────────────────────────────────────────────────────

-- Antes:
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
   and upper(c.nome) like 'BRENDA%'
   and p.data_referencia = '2026-08-20';


update public.registro_ponto p
   set hora_retorno_intervalo = '2026-08-20 17:11:00-03'::timestamptz,
       status_jornada         = greatest(coalesce(p.status_jornada, 3), 3)
  from public.colaboradores c
 where c.id = p.colaborador_id
   and c.unidade_id = 'seldeestrela'
   and upper(c.nome) like 'BRENDA%'
   and p.data_referencia = '2026-08-20';


-- Depois (tem que sair voltou_int = 17:11:00):
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
   and upper(c.nome) like 'BRENDA%'
   and p.data_referencia = '2026-08-20';
