-- ═══════════════════════════════════════════════════════════════
-- CERVEJAS — catálogo e estoque
-- Cole no SQL Editor do Supabase (projeto cerebro-erp).
-- ═══════════════════════════════════════════════════════════════

create table if not exists cervejas (
  id              uuid primary key default gen_random_uuid(),
  marca           text    not null,
  estilo          text    not null,        -- Pilsen, IPA, Stout, etc
  volume_ml       numeric not null,        -- 330, 350, 600, 1000
  alcool          numeric,                 -- 4.5%, 6.2%, etc
  preco_compra    numeric not null default 0,
  preco_venda     numeric not null default 0,
  quantidade      numeric not null default 0,
  minimo          numeric not null default 10,
  fornecedor      text,
  origem          text    default 'Brasil', -- Brasil, Importada
  unidade_id      text references unidades(id),
  created_at      timestamptz default now()
);

create index if not exists idx_cervejas_unidade on cervejas(unidade_id);
create index if not exists idx_cervejas_marca  on cervejas(marca);

alter table cervejas enable row level security;

revoke all on cervejas from anon;
grant all on cervejas to authenticated;

drop policy if exists "auth_all" on cervejas;
create policy "auth_all" on cervejas for all to authenticated using (true) with check (true);
