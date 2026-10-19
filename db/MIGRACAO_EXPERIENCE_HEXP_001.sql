-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: HÉFISTO EXPERIENCE — HEXP-001 (FASE 1)
-- Chamados de garçom, enriquecimento gastronômico e pedidos de mesa integrados
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. TABELA DE CHAMADOS DE GARÇOM / ATENDIMENTO DE MESA
create table if not exists experience_chamados (
  id                  uuid primary key default gen_random_uuid(),
  unidade_id          text not null,
  mesa_id             uuid references mesas(id) on delete set null,
  mesa_numero         text not null,
  tipo                text not null default 'garcom', -- 'garcom', 'agua', 'talheres', 'guardanapos', 'limpeza', 'conta', 'duvida'
  status              text not null default 'pendente', -- 'pendente', 'em_atendimento', 'concluido', 'cancelado'
  solicitante_nome    text,
  observacao          text,
  atendido_por        text,
  atendido_em         timestamptz,
  concluido_em        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Índices para consulta ultrarrápida do Salão e do Cliente
create index if not exists idx_experience_chamados_unidade_status 
  on experience_chamados (unidade_id, status, created_at desc);

create index if not exists idx_experience_chamados_mesa_pendente 
  on experience_chamados (mesa_id, status) where status in ('pendente', 'em_atendimento');

-- 2. ENRIQUECIMENTO GASTRONÔMICO ADITIVO EM PRODUTOS (PRESERVANDO DADOS EXISTENTES)
alter table produtos add column if not exists descricao               text;
alter table produtos add column if not exists tempo_preparo_min       integer;
alter table produtos add column if not exists harmonizacao            text;
alter table produtos add column if not exists alergenicos             text;
alter table produtos add column if not exists historia_gastronomica   text;
alter table produtos add column if not exists destaque_experience     boolean default false;

-- 3. RASTREIO DE EXPERIÊNCIA E IDEMPOTÊNCIA EM PEDIDOS
alter table pedidos add column if not exists origem_experience        boolean default false;
alter table pedidos add column if not exists chave_idempotencia       text;

-- 4. SEGURANÇA (RLS)
alter table experience_chamados enable row level security;

-- NUNCA APLICADA (as tabelas não existem no banco real, conferido em 18/10/2026).
-- Antes as policies eram abertas (using true): qualquer usuário logado de
-- qualquer empresa lia e alterava os chamados de todas as casas. Agora, se
-- um dia for aplicada, segue o isolamento por unidade da SEC-RLS-1. O
-- servidor (service_role) não precisa de policy: ignora o RLS.
drop policy if exists "experience_chamados_select_autenticado" on experience_chamados;
drop policy if exists "experience_chamados_update_autenticado" on experience_chamados;
drop policy if exists "experience_chamados_service_role" on experience_chamados;
drop policy if exists sec_unidade on experience_chamados;
create policy sec_unidade on experience_chamados for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(public.hefisto_unidades_do_usuario())));
