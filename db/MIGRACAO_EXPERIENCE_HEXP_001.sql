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

-- Leitura autenticada para o painel de funcionários/gestores
drop policy if exists "experience_chamados_select_autenticado" on experience_chamados;
create policy "experience_chamados_select_autenticado" on experience_chamados
  for select to authenticated
  using (true);

-- Atualização autenticada para funcionários marcarem como atendido/concluído
drop policy if exists "experience_chamados_update_autenticado" on experience_chamados;
create policy "experience_chamados_update_autenticado" on experience_chamados
  for update to authenticated
  using (true)
  with check (true);

-- Inserção via service_role ou anon controlado (SEC-DADOS-2)
drop policy if exists "experience_chamados_service_role" on experience_chamados;
create policy "experience_chamados_service_role" on experience_chamados
  for all to service_role
  using (true)
  with check (true);
