-- ─────────────────────────────────────────────────────────────────────────────
-- CONTROLE DE ACESSO: USUÁRIOS, PERFIS, ESCOPOS E AUDITORIA
--
-- É o que as telas "Usuários e acessos" e "Perfis de acesso" usam. Sem estas
-- tabelas a rota /api/admin/access-control responde "Não foi possível concluir
-- a operação".
--
-- Seguro rodar mesmo que já existam: tudo é "if not exists" e nenhuma coluna
-- é apagada ou alterada.
--
-- ATENÇÃO — além disto, a rota exige a variável SUPABASE_SERVICE_ROLE_KEY
-- configurada no servidor (Vercel → Settings → Environment Variables).
-- Sem ela, a tela continua dando erro mesmo com as tabelas criadas.
--
-- Como rodar: cole no SQL Editor do Supabase e execute.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PERFIS: conjuntos reutilizáveis de permissões ───────────────────────────
create table if not exists public.perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  descricao text,
  tipo text not null default 'personalizado',
  -- Perfis versionados: editar cria uma versão nova e aposenta a anterior.
  version integer not null default 1,
  is_current boolean not null default true,
  supersedes_id uuid,
  sistema boolean not null default false,
  permissoes jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfis_acesso add column if not exists permissoes jsonb not null default '[]'::jsonb;
alter table public.perfis_acesso add column if not exists version integer not null default 1;
alter table public.perfis_acesso add column if not exists is_current boolean not null default true;
alter table public.perfis_acesso add column if not exists supersedes_id uuid;
alter table public.perfis_acesso add column if not exists sistema boolean not null default false;

-- A tabela pode ja existir com outro formato: garante o que a rota usa.
alter table public.perfis_acesso add column if not exists nome text;
alter table public.perfis_acesso add column if not exists codigo text;
alter table public.perfis_acesso add column if not exists descricao text;
alter table public.perfis_acesso add column if not exists tipo text default 'personalizado';
alter table public.perfis_acesso add column if not exists ativo boolean not null default true;
alter table public.perfis_acesso add column if not exists created_by uuid;
alter table public.perfis_acesso add column if not exists created_at timestamptz not null default now();
alter table public.perfis_acesso add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_perfis_acesso_atual on public.perfis_acesso (is_current, ativo, nome);

-- ── USUÁRIOS DO SISTEMA ─────────────────────────────────────────────────────
create table if not exists public.usuarios_erp (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  nome text not null,
  login text unique,
  email text,
  perfil_id uuid references public.perfis_acesso(id) on delete set null,
  colaborador_id uuid,
  setor text,
  unidade_id text,
  status text not null default 'ativo',
  ativo boolean not null default true,
  -- Segurança do login
  exigir_troca_senha boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  ultimo_acesso timestamptz,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesma proteção da tabela de perfis: completa o que faltar.
alter table public.usuarios_erp add column if not exists auth_user_id uuid;
alter table public.usuarios_erp add column if not exists nome text;
alter table public.usuarios_erp add column if not exists login text;
alter table public.usuarios_erp add column if not exists email text;
alter table public.usuarios_erp add column if not exists perfil_id uuid;
alter table public.usuarios_erp add column if not exists setor text;
alter table public.usuarios_erp add column if not exists unidade_id text;
alter table public.usuarios_erp add column if not exists status text not null default 'ativo';
alter table public.usuarios_erp add column if not exists ativo boolean not null default true;
alter table public.usuarios_erp add column if not exists criado_por uuid;
alter table public.usuarios_erp add column if not exists created_at timestamptz not null default now();
alter table public.usuarios_erp add column if not exists updated_at timestamptz not null default now();
alter table public.usuarios_erp add column if not exists exigir_troca_senha boolean not null default true;
alter table public.usuarios_erp add column if not exists failed_attempts integer not null default 0;
alter table public.usuarios_erp add column if not exists locked_until timestamptz;
alter table public.usuarios_erp add column if not exists ultimo_acesso timestamptz;
alter table public.usuarios_erp add column if not exists colaborador_id uuid;

create index if not exists idx_usuarios_erp_perfil on public.usuarios_erp (perfil_id);
create index if not exists idx_usuarios_erp_status on public.usuarios_erp (status, ativo);

-- ── ESCOPO: até onde cada usuário enxerga ───────────────────────────────────
create table if not exists public.usuario_escopos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios_erp(id) on delete cascade,
  empresa_id uuid,
  unidade_id text,
  setor_id text,
  -- "todos" | "unidade" | "setor" | "proprio"
  data_scope text not null default 'unidade',
  created_at timestamptz not null default now()
);

create index if not exists idx_usuario_escopos_usuario on public.usuario_escopos (usuario_id);

-- ── AUDITORIA: quem mexeu em acesso, quando e o que mudou ───────────────────
create table if not exists public.permissoes_auditoria (
  id uuid primary key default gen_random_uuid(),
  ator_auth_user_id uuid,
  alvo_tipo text,
  alvo_id uuid,
  evento text not null,
  antes jsonb,
  depois jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_permissoes_auditoria_alvo
  on public.permissoes_auditoria (alvo_tipo, alvo_id, created_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- A administração passa pela rota do servidor, que usa a service role e ignora
-- RLS. Aqui a política só libera leitura para quem já está autenticado.
do $$
declare t text;
begin
  foreach t in array array['perfis_acesso','usuarios_erp','usuario_escopos','permissoes_auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_leitura') then
      execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_leitura', t);
    end if;
  end loop;
end $$;
