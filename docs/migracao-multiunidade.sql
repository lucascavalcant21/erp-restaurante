-- ════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO MULTIUNIDADE — Cerebro ERP (rede: Matriz + restaurantes)
-- Rode no Supabase → SQL Editor. Torna cada registro vinculado a uma unidade.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Tabela de unidades (os restaurantes da rede)
create table if not exists unidades (
  id         text primary key,          -- ex: 'seldeestrela'
  nome       text not null,
  cor        text default '#10B981',
  ativo      boolean default true,
  created_at timestamptz default now()
);

insert into unidades (id, nome, cor) values
  ('seldeestrela', 'Seldeestrela',      '#10B981'),
  ('ticotico',     'Tico Tico Saladas', '#3B82F6'),
  ('burguer',      'Burguer',           '#F97316')
on conflict (id) do nothing;

-- 2) Adiciona unidade_id em todas as tabelas operacionais
--    (cada loja "pensa sozinha"; a Central filtra por unidade ou vê todas)
alter table estoque                add column if not exists unidade_id text references unidades(id);
alter table estoque_movimentacoes  add column if not exists unidade_id text references unidades(id);
alter table ingredientes           add column if not exists unidade_id text references unidades(id);
alter table cardapio               add column if not exists unidade_id text references unidades(id);
alter table fichas_tecnicas        add column if not exists unidade_id text references unidades(id);
alter table funcionarios           add column if not exists unidade_id text references unidades(id);
alter table registros_ponto        add column if not exists unidade_id text references unidades(id);
alter table holerites              add column if not exists unidade_id text references unidades(id);
alter table eventos                add column if not exists unidade_id text references unidades(id);
alter table fornecedores           add column if not exists unidade_id text references unidades(id);
alter table clientes               add column if not exists unidade_id text references unidades(id);
alter table avaliacoes_nps         add column if not exists unidade_id text references unidades(id);
alter table campanhas              add column if not exists unidade_id text references unidades(id);
-- (adicione aqui: documentos, lancamentos_fluxo, etc. quando criar as tabelas)

-- 3) Índices para filtrar por unidade rapidamente
create index if not exists idx_estoque_unidade      on estoque(unidade_id);
create index if not exists idx_cardapio_unidade      on cardapio(unidade_id);
create index if not exists idx_funcionarios_unidade  on funcionarios(unidade_id);

-- 4) (Opcional, recomendado) RLS por unidade:
--    usuário só lê/escreve dados da sua unidade; admin/matriz vê todas.
--    Requer um claim/coluna com a unidade do usuário — ajuste à sua auth.
--    Exemplo (deixe comentado até definir a estratégia de auth):
-- alter table estoque enable row level security;
-- create policy "estoque_por_unidade" on estoque for all to authenticated
--   using ( unidade_id = auth.jwt() ->> 'unidade_id'
--           or (auth.jwt() ->> 'papel') = 'admin' );
