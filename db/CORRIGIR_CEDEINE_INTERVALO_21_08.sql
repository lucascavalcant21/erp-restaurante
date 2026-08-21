-- ─────────────────────────────────────────────────────────────────────────────
-- CEDEINE — 21/08/2026: apagar o intervalo batido junto com a entrada
--
-- O que aconteceu: a batida de entrada e a de saída para intervalo entraram
-- juntas, então o dia ficou com um intervalo que não existiu. Deixar assim
-- desconta do tempo trabalhado um período em que ela estava trabalhando.
--
-- O que este SQL faz: zera os dois horários do intervalo e devolve o dia ao
-- estado "trabalhando" (status 1), para que a próxima batida dela seja a saída
-- para o intervalo de verdade. A entrada não é tocada.
--
-- greatest não serve aqui: o status precisa VOLTAR, e é justamente o caso em
-- que voltar é o certo.
--
-- Como rodar: execute o SELECT, confira, depois rode o UPDATE e o SELECT final.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Antes ────────────────────────────────────────────────────────────────
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
   and upper(c.nome) like 'CEDEINE%'
   and p.data_referencia = '2026-08-21';


-- ── 2. Correção ─────────────────────────────────────────────────────────────
update public.registro_ponto p
   set hora_saida_intervalo   = null,
       hora_retorno_intervalo = null,
       -- Volta para "trabalhando": a próxima batida dela é a saída para o
       -- intervalo. Sem isso o tablet pediria a volta de um intervalo que não
       -- começou.
       status_jornada = 1
  from public.colaboradores c
 where c.id = p.colaborador_id
   and c.unidade_id = 'seldeestrela'
   and upper(c.nome) like 'CEDEINE%'
   and p.data_referencia = '2026-08-21'
   and p.hora_saida is null;   -- guarda: se o dia já foi encerrado, não mexe


-- ── 3. Depois (saiu_int e voltou_int têm que sair vazios) ───────────────────
select c.nome,
       p.data_referencia,
       (p.hora_entrada           at time zone 'America/Sao_Paulo')::time as entrada,
       (p.hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time as saiu_int,
       (p.hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time as voltou_int,
       p.status_jornada
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where c.unidade_id = 'seldeestrela'
   and upper(c.nome) like 'CEDEINE%'
   and p.data_referencia = '2026-08-21';


-- ── 4. Rastro no livro de marcações ─────────────────────────────────────────
-- Só rode este bloco DEPOIS de migracao_ponto_nsr.sql. A Portaria não permite
-- apagar marcação: a correção entra como uma linha de 'ajuste' ao lado da
-- original, com valor anterior, autor e motivo. Se o livro ainda não existe,
-- pule — o UPDATE acima já resolveu o dia.
--
-- insert into public.ponto_marcacao
--   (unidade_id, colaborador_id, tipo, tipo_alvo, marcado_em, data_referencia,
--    origem, valor_anterior, registrado_por, motivo)
-- select 'seldeestrela', c.id, 'ajuste', 'saida_intervalo',
--        p.hora_entrada, '2026-08-21'::date, 'ajuste',
--        p.hora_saida_intervalo, 'Lucas',
--        'Saida para intervalo registrada junto com a entrada por engano; intervalo nao ocorreu.'
--   from public.registro_ponto p
--   join public.colaboradores c on c.id = p.colaborador_id
--  where c.unidade_id = 'seldeestrela'
--    and upper(c.nome) like 'CEDEINE%'
--    and p.data_referencia = '2026-08-21';
