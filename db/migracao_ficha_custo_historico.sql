-- ─────────────────────────────────────────────────────────────────────────────
-- HISTÓRICO DE CUSTOS POR FICHA TÉCNICA
-- Registra um "retrato" do custo da ficha a cada alteração (edição da receita ou
-- registro manual quando o preço dos insumos muda). Nada é apagado: cada linha é
-- um ponto no tempo, permitindo ver a variação de custo da receita.
--
-- Como rodar: cole tudo no SQL Editor do Supabase e execute. É idempotente
-- (pode rodar de novo sem erro).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.fichas_custo_historico (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text,   -- TEXTO: ids de unidade no ERP nao sao uuid
  ficha_id           uuid not null references public.fichas_tecnicas(id) on delete cascade,
  custo_total        numeric(14,4) not null default 0,
  custo_porcao       numeric(14,4),
  custo_anterior     numeric(14,4),
  diferenca          numeric(14,4),
  diferenca_pct      numeric(10,4),
  ingrediente_gatilho text,
  origem             text default 'edicao_ficha',   -- edicao_ficha | manual | variacao_preco
  usuario_id         uuid,
  usuario_nome       text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_fch_custo_hist_ficha
  on public.fichas_custo_historico (ficha_id, created_at desc);
create index if not exists idx_fch_custo_hist_unidade
  on public.fichas_custo_historico (unidade_id, created_at desc);

-- RLS: mesma política aberta usada pelo app (chave anônima + app single-tenant).
alter table public.fichas_custo_historico enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fichas_custo_historico'
      and policyname = 'fichas_custo_historico_all'
  ) then
    create policy fichas_custo_historico_all
      on public.fichas_custo_historico
      for all
      using (true)
      with check (true);
  end if;
end $$;
