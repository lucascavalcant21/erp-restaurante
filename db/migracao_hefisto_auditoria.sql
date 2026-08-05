-- ─────────────────────────────────────────────────────────────────────────────
-- AUDITORIA DO ASSISTENTE HEFISTO
-- Toda ação interpretada/executada pelo assistente gera um registro.
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.hefisto_auditoria (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      uuid,
  usuario_id      uuid,
  usuario_nome    text,
  comando         text,              -- texto original digitado/ditado
  intencao        jsonb,             -- intenção estruturada interpretada
  acao            text,              -- id da ação executada
  modulo          text,
  registro_id     uuid,              -- registro afetado (quando houver)
  valor_anterior  numeric(16,4),
  valor_novo      numeric(16,4),
  resultado       text,              -- sucesso | erro | cancelado | pendente
  erro            text,
  exigiu_confirmacao boolean default false,
  dispositivo     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_hefisto_aud_unidade on public.hefisto_auditoria (unidade_id, created_at desc);
create index if not exists idx_hefisto_aud_usuario on public.hefisto_auditoria (usuario_id, created_at desc);

alter table public.hefisto_auditoria enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hefisto_auditoria' and policyname = 'hefisto_auditoria_all'
  ) then
    create policy hefisto_auditoria_all on public.hefisto_auditoria for all using (true) with check (true);
  end if;
end $$;
