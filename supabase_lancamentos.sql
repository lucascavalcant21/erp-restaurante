-- ============================================================================
-- Migração: tabela `lancamentos` (Fluxo de Caixa)
-- Rode este bloco no Supabase → SQL Editor → New query → Run.
-- Seguro reexecutar (IF NOT EXISTS / IF NOT EXISTS nas policies).
-- ============================================================================

create extension if not exists pgcrypto;  -- garante gen_random_uuid()

create table if not exists public.lancamentos (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  text not null,
  tipo        text not null check (tipo in ('entrada', 'saida')),
  categoria   text,
  descricao   text,
  valor       numeric(12,2) not null default 0,
  data        timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Índice para o filtro por unidade + ordenação por data (usado em fetchLancamentos)
create index if not exists idx_lancamentos_unidade_data
  on public.lancamentos (unidade_id, data desc);

-- Privilégios de tabela: tabelas criadas via SQL puro não herdam os GRANTs
-- padrão do Supabase. Sem isto, a chave anônima recebe "permission denied".
grant all on public.lancamentos to anon, authenticated;

-- RLS: o app usa a chave anônima (igual às demais tabelas operacionais).
-- Habilita RLS com política permissiva para anon/authenticated.
alter table public.lancamentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lancamentos' and policyname = 'lancamentos_all'
  ) then
    create policy "lancamentos_all"
      on public.lancamentos
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;
