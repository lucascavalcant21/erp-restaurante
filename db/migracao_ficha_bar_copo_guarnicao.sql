-- ═══════════════════════════════════════════════════════════════════════════
-- FICHA DO BAR: COPO, GUARNIÇÃO E GELO
--
-- Ficha de drink e ficha de prato não são o mesmo documento. Num drink, o copo
-- muda a percepção, o gelo muda a diluição e a guarnição faz parte da receita —
-- não são enfeite. Estes três campos não existiam.
--
-- `metodo_bar` já existe (db/migracao_ficha_metodo_bar.sql) e não é tocado.
--
-- Só adiciona colunas. Nada é apagado nem alterado. Idempotente.
-- Como rodar: cole no SQL Editor do Supabase e execute.
-- ═══════════════════════════════════════════════════════════════════════════

set lock_timeout = '5s';

alter table public.fichas_tecnicas
  add column if not exists copo         text,   -- taça/copo de serviço
  add column if not exists guarnicao    text,   -- decoração/garnish
  add column if not exists tipo_gelo    text;   -- sem gelo, cubo, triturado…

-- Faz o PostgREST enxergar as colunas novas sem esperar o cache expirar.
notify pgrst, 'reload schema';

-- Conferência
select
  count(*)                                  as fichas_do_bar,
  count(metodo_bar)                         as com_metodo,
  count(copo)                               as com_copo,
  count(guarnicao)                          as com_guarnicao
from public.fichas_tecnicas
where lower(coalesce(departamento, '')) = 'bar';
