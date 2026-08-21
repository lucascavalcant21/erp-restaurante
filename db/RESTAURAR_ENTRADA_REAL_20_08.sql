-- ─────────────────────────────────────────────────────────────────────────────
-- RESTAURAR A HORA REAL DA ENTRADA — 20/08/2026
--
-- O que dá para recuperar e o que NÃO dá:
--
-- A linha do dia é criada (INSERT) na batida de ENTRADA, então created_at
-- guarda o instante real em que a pessoa bateu — o valor que a tolerância
-- sobrescreveu em hora_entrada. Essa dá para restaurar.
--
-- As outras três batidas (saída p/ intervalo, volta e saída do trabalho) são
-- UPDATE na mesma linha. O horário ajustado gravou por cima do real e não
-- existe histórico. Esses NÃO têm como voltar — a informação nunca foi salva.
--
-- GUARDA IMPORTANTE: as linhas importadas de agosto têm created_at igual ao
-- momento da importação, não da batida. Por isso o filtro exige
-- origem_batida <> 'manual' E created_at no mesmo dia da referência. Sem isso,
-- este UPDATE destruiria a folha que acabamos de importar.
--
-- Como rodar: execute o SELECT primeiro, confira linha por linha, e só depois
-- tire os comentários do UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Conferência: o que mudaria ──────────────────────────────────────────
select c.nome,
       p.data_referencia,
       p.origem_batida,
       (p.hora_entrada at time zone 'America/Sao_Paulo')::time as gravado,
       (p.created_at   at time zone 'America/Sao_Paulo')::time as real_da_batida,
       round(extract(epoch from (p.hora_entrada - p.created_at)) / 60) as diferenca_min
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where p.unidade_id = 'seldeestrela'
   and p.data_referencia = '2026-08-20'
   and coalesce(p.origem_batida, '') <> 'manual'
   and p.created_at is not null
   and (p.created_at at time zone 'America/Sao_Paulo')::date = p.data_referencia
 order by c.nome;


-- ── 2. Restauração (descomente depois de conferir o SELECT acima) ──────────
-- Só mexe onde a diferença é de no máximo 15 min: diferença maior não é
-- tolerância, é outra coisa, e aí o certo é olhar caso a caso.
--
-- update public.registro_ponto p
--    set hora_entrada = p.created_at
--  where p.unidade_id = 'seldeestrela'
--    and p.data_referencia = '2026-08-20'
--    and coalesce(p.origem_batida, '') <> 'manual'
--    and p.created_at is not null
--    and (p.created_at at time zone 'America/Sao_Paulo')::date = p.data_referencia
--    and abs(extract(epoch from (p.hora_entrada - p.created_at)) / 60) <= 15;
