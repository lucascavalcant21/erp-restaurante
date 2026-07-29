-- ─────────────────────────────────────────────────────────────────────────────
-- PERDA E EMPANAMENTO NO INGREDIENTE
-- Perda (limpeza/aparo): informa-se peso bruto e perda em g; o app calcula o %.
-- Empanamento: o produto GANHA peso e tem um custo adicional (empanado).
-- Esses fatores passam a valer por ingrediente (o FC sai da ficha técnica).
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.insumos add column if not exists peso_bruto_padrao numeric(14,3);  -- referência p/ a perda (g)
alter table public.insumos add column if not exists perda_g           numeric(14,3);  -- perda em g sobre o peso bruto
alter table public.insumos add column if not exists perda_pct         numeric(8,3);   -- perda calculada (%)
alter table public.insumos add column if not exists empanado          boolean default false;
alter table public.insumos add column if not exists ganho_pct         numeric(8,3);   -- ganho de peso do empanado (%)
alter table public.insumos add column if not exists custo_empanado_kg numeric(14,4);  -- custo do empanamento por kg final (R$)
