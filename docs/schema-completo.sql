-- ════════════════════════════════════════════════════════════════════════════
-- SCHEMA COMPLETO E DEFINITIVO — Cerebro ERP (multiunidade + segurança)
-- ────────────────────────────────────────────────────────────────────────────
-- Recria TODAS as tabelas com as colunas que o app espera, adiciona unidade_id,
-- cria a tabela `unidades` e aplica RLS (acesso só a usuários logados).
--
-- ⚠️ Isto APAGA as tabelas atuais (que estão VAZIAS) e recria limpas.
--    Rode no Supabase → SQL Editor. Seguro porque não há dados reais ainda.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Unidades (rede)
create table if not exists unidades (
  id text primary key, nome text not null, cor text default '#10B981',
  ativo boolean default true, created_at timestamptz default now()
);
insert into unidades (id, nome, cor) values
  ('seldeestrela','Seldeestrela','#10B981'),
  ('ticotico','Tico Tico Saladas','#3B82F6'),
  ('burguer','Burguer','#F97316')
on conflict (id) do nothing;

-- 2) Recriar tabelas operacionais/financeiras/clientes (vazias) com schema do app
drop table if exists estoque_movimentacoes cascade;
drop table if exists ficha_itens cascade;
drop table if exists fichas_tecnicas cascade;
drop table if exists registros_ponto cascade;
drop table if exists holerites cascade;
drop table if exists ingredientes cascade;
drop table if exists estoque cascade;
drop table if exists cardapio cascade;
drop table if exists funcionarios cascade;
drop table if exists clientes cascade;
drop table if exists avaliacoes_nps cascade;
drop table if exists avaliacoes cascade;
drop table if exists campanhas cascade;
drop table if exists eventos cascade;
drop table if exists fornecedores cascade;
drop table if exists documentos cascade;
drop table if exists lancamentos cascade;

create table ingredientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, unidade text not null default 'UN',
  preco_compra numeric default 0, custo_por_unidade_base numeric default 0,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table estoque (
  id uuid primary key default gen_random_uuid(),
  nome text not null, categoria text default 'Outros', unidade text default 'UN',
  quantidade numeric default 0, minimo numeric default 0,
  preco_unit numeric default 0, custo_unitario numeric default 0,
  fornecedor text, ultima_entrada date, updated_at timestamptz default now(),
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid references estoque(id) on delete cascade,
  tipo text not null, quantidade numeric not null, obs text,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table cardapio (
  id uuid primary key default gen_random_uuid(),
  nome text not null, categoria text, preco numeric default 0, custo numeric default 0,
  descricao text, ativo boolean default true,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table fichas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  prato_id uuid, nome text, custo_total numeric default 0,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table ficha_itens (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid references fichas_tecnicas(id) on delete cascade,
  ingrediente_id uuid, quantidade numeric default 0
);
create table funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null, cargo text, turno text, salario numeric default 0,
  admissao date, telefone text, email text, ativo boolean default true,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table registros_ponto (
  id uuid primary key default gen_random_uuid(),
  func_id uuid references funcionarios(id) on delete cascade,
  data date not null, entrada time, saida time, obs text,
  unidade_id text references unidades(id), created_at timestamptz default now(),
  unique (func_id, data)
);
create table holerites (
  id uuid primary key default gen_random_uuid(),
  func_id uuid references funcionarios(id) on delete cascade,
  mes int, ano int, bruto numeric default 0, liquido numeric default 0, detalhes jsonb,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, tel text, total_gasto numeric default 0, total_pedidos int default 0,
  ultima_compra date, unidade_id text references unidades(id), created_at timestamptz default now()
);
create table avaliacoes_nps (
  id uuid primary key default gen_random_uuid(),
  nome text, nota int not null, comentario text, data date default current_date,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null, tipo text, descricao text, cupom text, desconto numeric default 0,
  inicio date, fim date, meta_clientes int default 0, clientes_atingidos int default 0,
  receita_gerada numeric default 0, status text default 'agendada',
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null, tipo text, status text default 'Pendente', data timestamptz,
  local text, responsavel text, convidados int default 0,
  valor_contrato numeric default 0, custo_estimado numeric default 0, observacoes text,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null, segmento text, contato text, telefone text, email text, cidade text,
  forma_pagamento text, pedido_minimo numeric default 0, estrelas int default 5,
  ativo boolean default true, total_compras numeric default 0,
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table documentos (
  id uuid primary key default gen_random_uuid(),
  tipo text, descricao text not null, categoria text, valor numeric default 0,
  emissao date, vencimento date, status text default 'Pendente',
  unidade_id text references unidades(id), created_at timestamptz default now()
);
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null, categoria text, descricao text not null, valor numeric default 0,
  data date default current_date, unidade_id text references unidades(id), created_at timestamptz default now()
);

-- 3) Segurança: RLS + bloqueio anônimo + acesso só a logados
do $$
declare t text;
begin
  foreach t in array array[
    'unidades','ingredientes','estoque','estoque_movimentacoes','cardapio','fichas_tecnicas',
    'ficha_itens','funcionarios','registros_ponto','holerites','clientes','avaliacoes_nps',
    'campanhas','eventos','fornecedores','documentos','lancamentos'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('drop policy if exists "auth_full_access" on public.%I;', t);
    execute format('create policy "auth_full_access" on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Pronto! Banco limpo, consistente com o app, multiunidade e seguro.
