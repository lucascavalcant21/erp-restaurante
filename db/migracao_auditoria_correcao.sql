-- ─────────────────────────────────────────────────────────────────────────────
-- CORREÇÃO DA AUDITORIA (hefisto_auditoria)
--
-- Por que existe: a baixa do inventário não aparecia em /dashboard/gestao/auditoria.
-- O insert era feito com .catch(() => {}), então qualquer recusa do banco sumia
-- sem deixar rastro — justamente na tabela que existe para deixar rastro.
--
-- A causa mais provável está na criação original (migracao_hefisto_auditoria.sql):
-- unidade_id, usuario_id e registro_id foram declarados como uuid, mas no ERP
-- inteiro esses ids trafegam como TEXTO ("matriz" é o fallback quando não há
-- unidade cadastrada). Um id que não seja uuid derruba o INSERT inteiro com
-- "invalid input syntax for type uuid" — e a leitura da tela quebra do mesmo
-- jeito, porque o filtro .eq("unidade_id", ...) manda texto.
--
-- Esta migração cobre de uma vez as quatro possibilidades: tabela inexistente,
-- coluna faltando, tipo errado e permissão/RLS.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Tabela, caso nunca tenha sido criada. Já nasce com os ids em texto.
create table if not exists public.hefisto_auditoria (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text,
  usuario_id         text,
  usuario_nome       text,
  comando            text,              -- texto original digitado/ditado
  intencao           jsonb,             -- intenção estruturada interpretada
  acao               text,              -- id da ação executada
  modulo             text,
  registro_id        text,              -- registro afetado (quando houver)
  valor_anterior     numeric(16,4),
  valor_novo         numeric(16,4),
  resultado          text,              -- sucesso | erro | cancelado | pendente
  erro               text,
  exigiu_confirmacao boolean default false,
  dispositivo        text,
  created_at         timestamptz not null default now()
);

-- 2) Colunas que podem faltar em bancos criados por versões anteriores.
alter table public.hefisto_auditoria add column if not exists unidade_id         text;
alter table public.hefisto_auditoria add column if not exists usuario_id         text;
alter table public.hefisto_auditoria add column if not exists usuario_nome       text;
alter table public.hefisto_auditoria add column if not exists comando            text;
alter table public.hefisto_auditoria add column if not exists intencao           jsonb;
alter table public.hefisto_auditoria add column if not exists acao               text;
alter table public.hefisto_auditoria add column if not exists modulo             text;
alter table public.hefisto_auditoria add column if not exists registro_id        text;
alter table public.hefisto_auditoria add column if not exists valor_anterior     numeric(16,4);
alter table public.hefisto_auditoria add column if not exists valor_novo         numeric(16,4);
alter table public.hefisto_auditoria add column if not exists resultado          text;
alter table public.hefisto_auditoria add column if not exists erro               text;
alter table public.hefisto_auditoria add column if not exists exigiu_confirmacao boolean default false;
alter table public.hefisto_auditoria add column if not exists dispositivo        text;
alter table public.hefisto_auditoria add column if not exists created_at         timestamptz not null default now();

-- 3) Ids do ERP são texto. Converte só o que ainda estiver como uuid — os
--    valores já gravados continuam válidos, uuid vira a própria string.
do $$
declare coluna record;
begin
  for coluna in
    select column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'hefisto_auditoria'
       and column_name in ('unidade_id', 'usuario_id', 'registro_id')
       and data_type    = 'uuid'
  loop
    execute format(
      'alter table public.hefisto_auditoria alter column %I type text using %I::text',
      coluna.column_name, coluna.column_name
    );
  end loop;
end $$;

create index if not exists idx_hefisto_aud_unidade on public.hefisto_auditoria (unidade_id, created_at desc);
create index if not exists idx_hefisto_aud_usuario on public.hefisto_auditoria (usuario_id, created_at desc);

-- 4) RLS liberada para quem está logado, igual ao resto do ERP.
alter table public.hefisto_auditoria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'hefisto_auditoria'
       and policyname = 'hefisto_auditoria_all'
  ) then
    create policy hefisto_auditoria_all on public.hefisto_auditoria
      for all using (true) with check (true);
  end if;
end $$;

-- 5) Sem GRANT a política não adianta: o erro sai como "permission denied".
grant select, insert on public.hefisto_auditoria to anon, authenticated;

-- 6) O PostgREST guarda o desenho das tabelas em cache; sem isto ele continua
--    respondendo "Could not find the table" logo depois da migração.
notify pgrst, 'reload schema';
