-- ═══════════════════════════════════════════════════════════════════════════
-- PERSISTÊNCIA DE CUSTOS E TAXAS NAS FICHAS TÉCNICAS
-- Adds columns for packaging cost, card machine fee, and tax directly to fichas_tecnicas
-- ═══════════════════════════════════════════════════════════════════════════

set lock_timeout = '5s';

alter table public.fichas_tecnicas
  add column if not exists custo_embalagem        numeric(14,2) default 0,
  add column if not exists custo_embalagens_total  numeric(14,2) default 0,
  add column if not exists taxa_maquininha         numeric(5,2),
  add column if not exists imposto_pct             numeric(5,2);
