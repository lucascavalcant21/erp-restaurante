-- ═══════════════════════════════════════════════════════════════
-- DRINKS — cardápio detalhado de drinks e mocktails do Bar
-- Cole no SQL Editor do Supabase (projeto cerebro-erp).
-- ═══════════════════════════════════════════════════════════════

create table if not exists drinks (
  id               uuid primary key default gen_random_uuid(),
  nome             text    not null,
  tipo             text    not null,       -- 'Drink' | 'Mocktail'
  copo             text,                   -- Rocks, Coupe, Highball, etc
  ml               numeric,                -- volume em mL
  preco_venda      numeric not null default 0,
  preco_custo      numeric not null default 0,
  destilado        text,                   -- vodka, rum, gin (null para mocktail)
  xarope_sim       boolean default false,
  xarope_qual      text,                   -- nome do xarope
  sabor            text,                   -- morango, maçã, etc
  chantilly        boolean default false,
  guarnacao        text,                   -- limão, hortelã, cereja, etc
  unidade_id       text references unidades(id),
  created_at       timestamptz default now()
);

create index if not exists idx_drinks_unidade on drinks(unidade_id);
create index if not exists idx_drinks_nome   on drinks(nome);
create index if not exists idx_drinks_tipo   on drinks(tipo);

alter table drinks enable row level security;

revoke all on drinks from anon;
grant all on drinks to authenticated;

drop policy if exists "auth_all" on drinks;
create policy "auth_all" on drinks for all to authenticated using (true) with check (true);
