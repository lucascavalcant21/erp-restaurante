-- Seleção, exclusão segura e auditoria de ações em lote das fichas técnicas.

alter table public.fichas_tecnicas
  add column if not exists ativo boolean not null default true;

create index if not exists fichas_tecnicas_unidade_ativo_idx
  on public.fichas_tecnicas (unidade_id, ativo);

create table if not exists public.fichas_lote_auditoria (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references public.unidades(id) on delete set null,
  usuario_id uuid,
  usuario_nome text,
  acao text not null check (acao in ('exclusao', 'inativacao', 'duplicacao', 'impressao', 'pdf', 'livro')),
  ficha_ids uuid[] not null default '{}',
  ficha_nomes text[] not null default '{}',
  quantidade integer not null default 0,
  origem text not null default 'Tela de fichas técnicas',
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fichas_lote_auditoria_unidade_data_idx
  on public.fichas_lote_auditoria (unidade_id, created_at desc);

alter table public.fichas_lote_auditoria enable row level security;

drop policy if exists "fichas_lote_auditoria_auth_full" on public.fichas_lote_auditoria;
create policy "fichas_lote_auditoria_auth_full"
  on public.fichas_lote_auditoria for all
  to authenticated using (true) with check (true);

grant select, insert on public.fichas_lote_auditoria to authenticated;
