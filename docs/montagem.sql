-- ═══════════════════════════════════════════════════════════════
-- MONTAGEM — fichas de montagem de pratos e drinks
-- Cole no SQL Editor do Supabase (projeto cerebro-erp).
-- ═══════════════════════════════════════════════════════════════

create table if not exists montagem (
  id              uuid primary key default gen_random_uuid(),
  nome            text    not null,
  tipo            text    not null,      -- 'prato' | 'drink'
  departamento    text    not null,      -- 'bar' | 'cozinha'
  descritivo      text,                  -- passo a passo de montagem
  foto_url        text,                  -- URL da foto (Supabase Storage)
  tempo_preparo   int,                   -- em minutos
  rendimento      text,                  -- ex: "1 porção", "350ml"
  observacoes     text,                  -- dicas, alertas
  unidade_id      text references unidades(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_montagem_unidade on montagem(unidade_id);
create index if not exists idx_montagem_nome    on montagem(nome);
create index if not exists idx_montagem_tipo    on montagem(tipo);
create index if not exists idx_montagem_dept    on montagem(departamento);

alter table montagem enable row level security;

revoke all on montagem from anon;
grant all on montagem to authenticated;

drop policy if exists "auth_all" on montagem;
create policy "auth_all" on montagem for all to authenticated using (true) with check (true);

-- ─── Storage bucket para fotos de montagem ───────────────────────
insert into storage.buckets (id, name, public)
values ('montagem-fotos', 'montagem-fotos', true)
on conflict (id) do nothing;

drop policy if exists "Public read" on storage.objects;
create policy "Public read" on storage.objects for select using (bucket_id = 'montagem-fotos');

drop policy if exists "Auth upload" on storage.objects;
create policy "Auth upload" on storage.objects for insert to authenticated with check (bucket_id = 'montagem-fotos');

drop policy if exists "Auth update" on storage.objects;
create policy "Auth update" on storage.objects for update to authenticated using (bucket_id = 'montagem-fotos');

drop policy if exists "Auth delete" on storage.objects;
create policy "Auth delete" on storage.objects for delete to authenticated using (bucket_id = 'montagem-fotos');
