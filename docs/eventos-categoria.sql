-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Categoria de Ingredientes
-- Cole no SQL Editor do Supabase. Seguro de rodar.
-- ═══════════════════════════════════════════════════════════════

alter table evento_ingredientes
  add column if not exists categoria text;

create index if not exists idx_evt_ing_categoria on evento_ingredientes(categoria);
