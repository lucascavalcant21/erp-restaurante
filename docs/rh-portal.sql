-- ════════════════════════════════════════════════════════════════════════════
-- RH + PORTAL DO COLABORADOR — novas tabelas (multiunidade + RLS)
-- Rode no Supabase → SQL Editor.
-- Ligação colaborador↔portal: pelo e-mail do funcionário (= e-mail de login).
-- ════════════════════════════════════════════════════════════════════════════

-- Documentos do funcionário (contrato, RG, comprovantes, etc.)
create table if not exists func_documentos (
  id uuid primary key default gen_random_uuid(),
  func_id uuid references funcionarios(id) on delete cascade,
  tipo text default 'Documento',         -- Contrato | RG | Comprovante | Outro
  titulo text not null,
  arquivo_url text,                        -- Supabase Storage
  unidade_id text references unidades(id),
  created_at timestamptz default now()
);

-- Folha de pagamento (holerite) — recria com campo de arquivo
drop table if exists holerites cascade;
create table holerites (
  id uuid primary key default gen_random_uuid(),
  func_id uuid references funcionarios(id) on delete cascade,
  mes int, ano int, bruto numeric default 0, liquido numeric default 0,
  detalhes jsonb, arquivo_url text,
  unidade_id text references unidades(id), created_at timestamptz default now()
);

-- Avisos / comunicados (reuniões, etc.) — func_id null = para todos da unidade
create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, corpo text, tipo text default 'info',  -- info|reuniao|alerta
  func_id uuid references funcionarios(id) on delete cascade,
  unidade_id text references unidades(id), data timestamptz default now(),
  created_at timestamptz default now()
);

-- Advertências
create table if not exists advertencias (
  id uuid primary key default gen_random_uuid(),
  func_id uuid references funcionarios(id) on delete cascade,
  gravidade text default 'leve',          -- leve|media|grave
  motivo text not null, descricao text, data date default current_date,
  unidade_id text references unidades(id), created_at timestamptz default now()
);

-- Produções atribuídas (tarefas do dia/semana por funcionário)
create table if not exists producoes (
  id uuid primary key default gen_random_uuid(),
  func_id uuid references funcionarios(id) on delete cascade,
  titulo text not null, descricao text,
  periodo text default 'dia',             -- dia|semana
  data date default current_date, status text default 'pendente',  -- pendente|feito
  unidade_id text references unidades(id), created_at timestamptz default now()
);

-- Cursos (da empresa ou do próprio colaborador) — PDF/vídeo
create table if not exists cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descricao text,
  origem text default 'empresa',          -- empresa|colaborador
  tipo_arquivo text default 'pdf',         -- pdf|video|link
  arquivo_url text,
  func_id uuid references funcionarios(id) on delete cascade,  -- null = para todos
  unidade_id text references unidades(id),
  status text default 'ativo', created_at timestamptz default now()
);

-- ── Segurança (RLS + bloqueio anon + acesso a logados) ─────────
do $$
declare t text;
begin
  foreach t in array array['func_documentos','holerites','avisos','advertencias','producoes','cursos']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('drop policy if exists "auth_full_access" on public.%I;', t);
    execute format('create policy "auth_full_access" on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ── Storage: bucket de anexos (contrato, holerite, cursos) ─────
insert into storage.buckets (id, name, public) values ('anexos','anexos', true)
on conflict (id) do nothing;
-- Leitura pública dos anexos + upload por usuários logados:
drop policy if exists "anexos_read" on storage.objects;
create policy "anexos_read" on storage.objects for select using (bucket_id = 'anexos');
drop policy if exists "anexos_write" on storage.objects;
create policy "anexos_write" on storage.objects for insert to authenticated with check (bucket_id = 'anexos');
drop policy if exists "anexos_update" on storage.objects;
create policy "anexos_update" on storage.objects for update to authenticated using (bucket_id = 'anexos');
drop policy if exists "anexos_delete" on storage.objects;
create policy "anexos_delete" on storage.objects for delete to authenticated using (bucket_id = 'anexos');
