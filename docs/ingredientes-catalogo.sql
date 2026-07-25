-- Catálogo de ingredientes: nomes, embalagem, fornecedores e histórico de preço.
-- Esta migração não cria nem altera saldo, lote ou movimentação de estoque.

alter table public.insumos
  add column if not exists nome_interno text,
  add column if not exists codigo_interno text,
  add column if not exists fornecedor text,
  add column if not exists fornecedor_atual_id uuid references public.fornecedores(id) on delete set null,
  add column if not exists densidade_g_ml numeric,
  add column if not exists preco_normalizado numeric,
  add column if not exists preco_normalizado_anterior numeric,
  add column if not exists variacao_preco_pct numeric,
  add column if not exists preco_atualizado_em timestamptz default now();

alter table public.insumos
  drop constraint if exists insumos_densidade_g_ml_check;
alter table public.insumos
  add constraint insumos_densidade_g_ml_check
  check (densidade_g_ml is null or densidade_g_ml > 0);

create unique index if not exists insumos_codigo_interno_unidade_uidx
  on public.insumos (unidade_id, lower(codigo_interno))
  where codigo_interno is not null and btrim(codigo_interno) <> '';

create index if not exists insumos_catalogo_unidade_idx
  on public.insumos (unidade_id, nome);

create table if not exists public.insumos_fornecedores (
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (insumo_id, fornecedor_id)
);

create index if not exists insumos_fornecedores_fornecedor_idx
  on public.insumos_fornecedores (fornecedor_id, insumo_id);

create table if not exists public.insumos_precos_historico (
  id uuid primary key default gen_random_uuid(),
  unidade_id text,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  insumo_nome text not null,
  custo_anterior numeric,
  custo_novo numeric not null,
  created_at timestamptz not null default now()
);

alter table public.insumos_precos_historico
  add column if not exists fornecedor_id uuid references public.fornecedores(id) on delete set null,
  add column if not exists fornecedor_nome text,
  add column if not exists embalagem_quantidade_anterior numeric,
  add column if not exists embalagem_unidade_anterior text,
  add column if not exists embalagem_quantidade_nova numeric,
  add column if not exists embalagem_unidade_nova text,
  add column if not exists valor_anterior numeric,
  add column if not exists valor_novo numeric,
  add column if not exists preco_normalizado_anterior numeric,
  add column if not exists preco_normalizado_novo numeric,
  add column if not exists diferenca_valor numeric,
  add column if not exists diferenca_percentual numeric,
  add column if not exists usuario_id uuid,
  add column if not exists usuario_nome text,
  add column if not exists origem text default 'Cadastro de ingredientes';

create index if not exists insumos_precos_historico_consulta_idx
  on public.insumos_precos_historico (unidade_id, insumo_id, created_at desc);

alter table public.insumos_fornecedores enable row level security;
alter table public.insumos_precos_historico enable row level security;

revoke all on public.insumos_fornecedores from anon;
revoke all on public.insumos_precos_historico from anon;
grant select, insert, update, delete on public.insumos_fornecedores to authenticated;
grant select, insert, update, delete on public.insumos_precos_historico to authenticated;

drop policy if exists "auth_full_access" on public.insumos_fornecedores;
create policy "auth_full_access" on public.insumos_fornecedores
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_full_access" on public.insumos_precos_historico;
create policy "auth_full_access" on public.insumos_precos_historico
  for all to authenticated using (true) with check (true);
