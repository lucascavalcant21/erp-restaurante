-- ═══════════════════════════════════════════════════════════════
-- ATUALIZAÇÃO DO PDV: MESAS, TAXAS E ACRÉSCIMOS
-- Cole este script no SQL Editor do Supabase e clique em RUN.
-- ═══════════════════════════════════════════════════════════════

-- 1. ATUALIZAR TABELA VENDAS COM NOVOS CAMPOS
-- Adiciona taxa_servico e acrescimo se não existirem
ALTER TABLE vendas 
  ADD COLUMN IF NOT EXISTS taxa_servico numeric not null default 0,
  ADD COLUMN IF NOT EXISTS acrescimo numeric not null default 0;

-- 2. CRIAR TABELA DE MESAS
create table if not exists mesas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references unidades(id) on delete cascade,
  numero text not null,               -- Ex: "1", "2", "VIP", "Varanda"
  status text not null default 'livre', -- 'livre', 'ocupada', 'fechando'
  itens jsonb not null default '[]'::jsonb, -- Armazena {id, nome, preco, custo, quantidade}
  cliente text,
  aberta_em timestamptz,
  created_at timestamptz default now()
);

-- Índices e Segurança
create index if not exists idx_mesas_unidade on mesas(unidade_id);

alter table mesas enable row level security;
revoke all on mesas from anon;
grant all on mesas to authenticated;

drop policy if exists "auth_all" on mesas;
create policy "auth_all" on mesas for all to authenticated using (true) with check (true);
