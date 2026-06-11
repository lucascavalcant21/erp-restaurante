-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Adicionar tabela de Compras Realizadas
-- Cole no SQL Editor do Supabase. SEGURO de rodar — só adiciona.
-- ═══════════════════════════════════════════════════════════════

create table if not exists evento_compras (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references eventos(id) on delete cascade,
  ingrediente_id  uuid not null references evento_ingredientes(id) on delete cascade,
  comprado        boolean not null default false,
  qtd_comprada    numeric,
  valor_pago      numeric not null default 0,
  fornecedor      text,
  data_compra     date,
  observacao      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (evento_id, ingrediente_id)
);

create index if not exists idx_evt_compras_evento     on evento_compras(evento_id);
create index if not exists idx_evt_compras_ingrediente on evento_compras(ingrediente_id);

alter table evento_compras enable row level security;
revoke all on evento_compras from anon;
grant all on evento_compras to authenticated;

drop policy if exists "auth_all" on evento_compras;
create policy "auth_all" on evento_compras for all to authenticated using (true) with check (true);
