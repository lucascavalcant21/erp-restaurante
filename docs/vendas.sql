-- ═══════════════════════════════════════════════════════════════
-- PDV / VENDAS — tabelas de venda do ponto de venda
-- Cole no SQL Editor do Supabase (projeto cerebro-erp).
-- Fecha o ciclo: venda → receita (lancamentos) → baixa de estoque.
-- ═══════════════════════════════════════════════════════════════

-- Cabeçalho da venda
create table if not exists vendas (
  id              uuid primary key default gen_random_uuid(),
  subtotal        numeric not null default 0,
  desconto        numeric not null default 0,
  total           numeric not null default 0,
  forma_pagamento text    not null default 'dinheiro',  -- dinheiro | pix | credito | debito
  cliente         text,
  observacao      text,
  status          text    not null default 'concluida', -- concluida | cancelada
  lancamento_id   uuid,                                  -- receita gerada no fluxo de caixa (p/ estorno)
  unidade_id      text references unidades(id),
  created_at      timestamptz default now()
);

-- Itens da venda (snapshot do produto no momento da venda)
create table if not exists venda_itens (
  id          uuid primary key default gen_random_uuid(),
  venda_id    uuid references vendas(id) on delete cascade,
  cardapio_id uuid,                       -- referência ao prato (pode ficar órfã se o prato for removido)
  nome        text    not null,
  preco_unit  numeric not null default 0,
  custo_unit  numeric not null default 0,
  quantidade  numeric not null default 1,
  subtotal    numeric not null default 0,
  unidade_id  text references unidades(id)
);

-- Índices para consultas por unidade/período
create index if not exists idx_vendas_unidade     on vendas(unidade_id);
create index if not exists idx_vendas_data        on vendas(created_at);
create index if not exists idx_venda_itens_venda  on venda_itens(venda_id);

-- Segurança: RLS ligado, anon sem acesso, autenticados podem tudo
alter table vendas      enable row level security;
alter table venda_itens enable row level security;

revoke all on vendas      from anon;
revoke all on venda_itens from anon;
grant all on vendas      to authenticated;
grant all on venda_itens to authenticated;

drop policy if exists "auth_all" on vendas;
drop policy if exists "auth_all" on venda_itens;
create policy "auth_all" on vendas      for all to authenticated using (true) with check (true);
create policy "auth_all" on venda_itens for all to authenticated using (true) with check (true);
