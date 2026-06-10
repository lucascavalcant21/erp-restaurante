-- ═══════════════════════════════════════════════════════════════
-- EVENTOS — planejamento financeiro de eventos gastronômicos
-- (baseado no app Dia dos Namorados)
-- Cole no SQL Editor do Supabase (projeto cerebro-erp).
-- ═══════════════════════════════════════════════════════════════

-- ─── Tabela principal: evento ───────────────────────────────────
create table if not exists eventos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  subtitulo       text,
  tag             text,                              -- ex: nome da loja
  data_evento     date not null,
  banner_url      text,
  charge_mode     text not null default 'couple',    -- 'couple' | 'person'
  capacidade      int  not null default 12,          -- nº de mesas/lugares

  -- Menu do evento
  preco_unit      numeric not null default 0,        -- preço por casal/pessoa
  entradas_inc    int     not null default 1,
  principais_inc  int     not null default 2,
  sobremesas_inc  int     not null default 1,
  drinks_inc      int     not null default 2,

  -- Configurações financeiras
  impostos_rate   numeric not null default 0.08,
  credito_rate    numeric not null default 0.0299,
  debito_rate     numeric not null default 0.0149,
  credito_mix     numeric not null default 0.7,
  meta_lucro      numeric not null default 0,
  margem_seg      numeric not null default 10,       -- % buffer lista compras

  status          text    not null default 'ativo',  -- ativo | encerrado | cancelado
  unidade_id      text references unidades(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_eventos_unidade on eventos(unidade_id);
create index if not exists idx_eventos_data    on eventos(data_evento);
create index if not exists idx_eventos_status  on eventos(status);

-- ─── Ingredientes do evento (cozinha + bar) ─────────────────────
create table if not exists evento_ingredientes (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references eventos(id) on delete cascade,
  tipo          text not null,                      -- 'food' | 'bar'
  nome          text not null,
  custo_unit    numeric not null default 0,         -- custo da embalagem
  peso_unit     numeric not null default 1000,      -- peso/volume base
  unidade       text not null default 'g',          -- 'g' | 'ml'
  created_at    timestamptz default now()
);

create index if not exists idx_evt_ing_evento on evento_ingredientes(evento_id);
create index if not exists idx_evt_ing_tipo   on evento_ingredientes(tipo);

-- ─── Preparos / sub-receitas ────────────────────────────────────
create table if not exists evento_preparos (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references eventos(id) on delete cascade,
  tipo            text not null,                    -- 'food' | 'bar'
  nome            text not null,
  rendimento      numeric not null default 1000,
  unidade         text not null default 'g',
  base_ingredients jsonb not null default '[]'::jsonb,  -- [{id, qty}]
  created_at      timestamptz default now()
);

create index if not exists idx_evt_prep_evento on evento_preparos(evento_id);

-- ─── Pratos ─────────────────────────────────────────────────────
create table if not exists evento_pratos (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references eventos(id) on delete cascade,
  nome          text not null,
  categoria     text not null,                      -- Entrada | Principal | Sobremesa
  rendimento    numeric not null default 1,
  descricao     text,
  tags          jsonb not null default '[]'::jsonb,
  ingredients   jsonb not null default '[]'::jsonb, -- [{id, qty, type: 'food'|'prep'}]
  created_at    timestamptz default now()
);

create index if not exists idx_evt_pratos_evento on evento_pratos(evento_id);

-- ─── Drinks ─────────────────────────────────────────────────────
create table if not exists evento_drinks (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references eventos(id) on delete cascade,
  nome          text not null,
  has_alcohol   boolean not null default true,
  is_extra      boolean not null default false,
  preco_venda   numeric not null default 0,
  descricao     text,
  ingredients   jsonb not null default '[]'::jsonb, -- [{id, qty, type: 'bar'|'prep'}]
  created_at    timestamptz default now()
);

create index if not exists idx_evt_drinks_evento on evento_drinks(evento_id);

-- ─── Reservas ───────────────────────────────────────────────────
create table if not exists evento_reservas (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references eventos(id) on delete cascade,
  nome            text not null,
  mesa            int,
  horario         text,                             -- ex: '19:00', '21:30'
  sinal           numeric not null default 0,
  status          text not null default 'pending',  -- pending | paid
  payment_method  text default 'credit',            -- credit | debit | pix
  menu_choices    jsonb not null default '[]'::jsonb, -- ids de pratos
  drink_choices   jsonb not null default '[]'::jsonb, -- ids de drinks
  extra_drinks    jsonb not null default '[]'::jsonb, -- [{drinkId, qty}]
  observacao      text,
  created_at      timestamptz default now()
);

create index if not exists idx_evt_res_evento on evento_reservas(evento_id);
create index if not exists idx_evt_res_mesa   on evento_reservas(mesa);

-- ─── Custos Fixos ───────────────────────────────────────────────
create table if not exists evento_custos_fixos (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references eventos(id) on delete cascade,
  nome            text not null,
  categoria       text not null,                    -- cmo | decoracao | musica | infra | marketing | outros
  area            text,                             -- cozinha | salao | bar (só para CMO)
  role            text,                             -- cargo específico
  is_extra        boolean default false,
  person_count    int     not null default 1,
  value_per_person numeric not null default 0,
  created_at      timestamptz default now()
);

create index if not exists idx_evt_cf_evento on evento_custos_fixos(evento_id);

-- ─── RLS ─────────────────────────────────────────────────────────
alter table eventos               enable row level security;
alter table evento_ingredientes   enable row level security;
alter table evento_preparos       enable row level security;
alter table evento_pratos         enable row level security;
alter table evento_drinks         enable row level security;
alter table evento_reservas       enable row level security;
alter table evento_custos_fixos   enable row level security;

revoke all on eventos               from anon;
revoke all on evento_ingredientes   from anon;
revoke all on evento_preparos       from anon;
revoke all on evento_pratos         from anon;
revoke all on evento_drinks         from anon;
revoke all on evento_reservas       from anon;
revoke all on evento_custos_fixos   from anon;

grant all on eventos               to authenticated;
grant all on evento_ingredientes   to authenticated;
grant all on evento_preparos       to authenticated;
grant all on evento_pratos         to authenticated;
grant all on evento_drinks         to authenticated;
grant all on evento_reservas       to authenticated;
grant all on evento_custos_fixos   to authenticated;

drop policy if exists "auth_all" on eventos;
create policy "auth_all" on eventos for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on evento_ingredientes;
create policy "auth_all" on evento_ingredientes for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on evento_preparos;
create policy "auth_all" on evento_preparos for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on evento_pratos;
create policy "auth_all" on evento_pratos for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on evento_drinks;
create policy "auth_all" on evento_drinks for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on evento_reservas;
create policy "auth_all" on evento_reservas for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on evento_custos_fixos;
create policy "auth_all" on evento_custos_fixos for all to authenticated using (true) with check (true);

-- ─── Bucket de banners ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('eventos-banners', 'eventos-banners', true)
on conflict (id) do nothing;

drop policy if exists "Public read banners" on storage.objects;
create policy "Public read banners" on storage.objects for select using (bucket_id = 'eventos-banners');

drop policy if exists "Auth upload banners" on storage.objects;
create policy "Auth upload banners" on storage.objects for insert to authenticated with check (bucket_id = 'eventos-banners');

drop policy if exists "Auth update banners" on storage.objects;
create policy "Auth update banners" on storage.objects for update to authenticated using (bucket_id = 'eventos-banners');

drop policy if exists "Auth delete banners" on storage.objects;
create policy "Auth delete banners" on storage.objects for delete to authenticated using (bucket_id = 'eventos-banners');
