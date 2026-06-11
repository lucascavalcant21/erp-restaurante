-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Receitas/Preparos com porção e modo de preparo
-- ═══════════════════════════════════════════════════════════════

alter table evento_preparos
  add column if not exists porcao_sugerida numeric;

alter table evento_preparos
  add column if not exists modo_preparo text;
