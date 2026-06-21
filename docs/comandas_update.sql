-- ═══════════════════════════════════════════════════════════════
-- ATUALIZAÇÃO DO PDV: COMANDAS MÚLTIPLAS E IMPRESSÕES
-- Cole este script no SQL Editor do Supabase e clique em RUN.
-- ═══════════════════════════════════════════════════════════════

-- 1. DESTRUIR E RECRIAR A ESTRUTURA ANTIGA DE MESAS
DROP TABLE IF EXISTS mesas CASCADE;

-- 2. TABELA MESAS (Apenas a Estrutura Física)
create table mesas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references unidades(id) on delete cascade,
  numero text not null, -- Ex: "1", "2", "VIP"
  created_at timestamptz default now()
);
create index idx_mesas_unidade on mesas(unidade_id);

alter table mesas enable row level security;
revoke all on mesas from anon;
grant all on mesas to authenticated;
create policy "auth_all_mesas" on mesas for all to authenticated using (true) with check (true);

-- 3. TABELA COMANDAS (A Sessão de Consumo do Cliente na Mesa)
create table comandas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references unidades(id) on delete cascade,
  mesa_id uuid references mesas(id) on delete cascade,
  nome_cliente text,
  status text not null default 'aberta', -- 'aberta', 'fechando', 'paga'
  itens jsonb not null default '[]'::jsonb, -- {id, nome, preco, custo, quantidade}
  aberta_em timestamptz default now(),
  created_at timestamptz default now()
);
create index idx_comandas_unidade on comandas(unidade_id);
create index idx_comandas_mesa on comandas(mesa_id);

alter table comandas enable row level security;
revoke all on comandas from anon;
grant all on comandas to authenticated;
create policy "auth_all_comandas" on comandas for all to authenticated using (true) with check (true);

-- 4. TABELA DE CONFIGURAÇÕES DE IMPRESSÃO
create table config_impressoes (
  unidade_id text primary key references unidades(id) on delete cascade,
  tamanho_papel text default '80mm', -- '80mm' ou '58mm'
  cabecalho text default 'Nome do Meu Restaurante',
  rodape text default 'Obrigado pela preferência!',
  imprimir_cozinha boolean default true,
  imprimir_conta boolean default true,
  mostrar_precos_cozinha boolean default false,
  updated_at timestamptz default now()
);

alter table config_impressoes enable row level security;
revoke all on config_impressoes from anon;
grant all on config_impressoes to authenticated;
create policy "auth_all_impressoes" on config_impressoes for all to authenticated using (true) with check (true);
