-- Listas reutilizáveis de etiquetas (voz ou cadastro manual).
-- Execute no SQL Editor do Supabase. O script pode ser executado novamente.

create table if not exists public.listas_etiquetas (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null,
  nome text not null,
  setor text not null check (setor in ('cozinha', 'bar')),
  responsavel_id uuid,
  responsavel_nome text,
  itens jsonb not null default '[]'::jsonb,
  total_etiquetas integer not null default 0 check (total_etiquetas >= 0),
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listas_etiquetas_unidade_setor
  on public.listas_etiquetas (unidade_id, setor, created_at desc);

alter table public.listas_etiquetas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'listas_etiquetas'
      and policyname = 'listas_etiquetas_all'
  ) then
    create policy listas_etiquetas_all
      on public.listas_etiquetas for all
      using (true) with check (true);
  end if;
end $$;
