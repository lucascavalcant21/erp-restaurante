-- Memorando diário consolidado: produção da Cozinha, produção do Bar e compras.
-- Execute no SQL Editor do Supabase. É seguro executar novamente.

create table if not exists public.memorandos_operacao (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  data_referencia date not null,
  cozinha jsonb not null default '{}'::jsonb,
  bar jsonb not null default '{}'::jsonb,
  compras_manuais jsonb not null default '[]'::jsonb,
  observacoes text,
  status text not null default 'rascunho' check (status in ('rascunho', 'confirmado')),
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, data_referencia)
);

create index if not exists idx_memorandos_operacao_unidade_data
  on public.memorandos_operacao (unidade_id, data_referencia desc);

alter table public.memorandos_operacao enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'memorandos_operacao'
      and policyname = 'memorandos_operacao_all'
  ) then
    create policy memorandos_operacao_all
      on public.memorandos_operacao for all
      using (true) with check (true);
  end if;
end $$;
