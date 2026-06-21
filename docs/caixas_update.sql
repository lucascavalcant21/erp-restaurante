-- ═══════════════════════════════════════════════════════════════
-- ATUALIZAÇÃO DO PDV: FLUXO DE CAIXA E TURNOS
-- Cole este script no SQL Editor do Supabase e clique em RUN.
-- ═══════════════════════════════════════════════════════════════

-- 1. TABELA PDV_CAIXAS (Sessão de turno)
create table pdv_caixas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references unidades(id) on delete cascade,
  usuario_id text, -- Opcional, nome/id do operador
  fundo_inicial numeric(10,2) default 0,
  saldo_final numeric(10,2),
  status text not null default 'aberto', -- 'aberto', 'fechado'
  aberto_em timestamptz default now(),
  fechado_em timestamptz,
  totais_fechamento jsonb -- Salvar os agrupamentos finais calculados
);
create index idx_pdv_caixas_unidade on pdv_caixas(unidade_id);

alter table pdv_caixas enable row level security;
revoke all on pdv_caixas from anon;
grant all on pdv_caixas to authenticated;
create policy "auth_all_pdv_caixas" on pdv_caixas for all to authenticated using (true) with check (true);

-- 2. TABELA PDV_MOVIMENTACOES (Sangrias, Suprimentos)
create table pdv_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references unidades(id) on delete cascade,
  caixa_id uuid references pdv_caixas(id) on delete cascade,
  tipo text not null, -- 'suprimento' (entrada manual), 'sangria' (retirada)
  valor numeric(10,2) not null,
  descricao text,
  created_at timestamptz default now()
);
create index idx_pdv_mov_caixa on pdv_movimentacoes(caixa_id);

alter table pdv_movimentacoes enable row level security;
revoke all on pdv_movimentacoes from anon;
grant all on pdv_movimentacoes to authenticated;
create policy "auth_all_pdv_mov" on pdv_movimentacoes for all to authenticated using (true) with check (true);

-- 3. ALTERAR TABELA VENDAS (Vincular faturamento ao turno atual)
-- Evita erro se a coluna já existir (Supabase Postgres)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='vendas' and column_name='caixa_id') then
    alter table vendas add column caixa_id uuid references pdv_caixas(id) on delete set null;
  end if;
end $$;
