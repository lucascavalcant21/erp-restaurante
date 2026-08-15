-- ─────────────────────────────────────────────────────────────────────────────
-- RECIBOS DE TRABALHO EXTRA
-- Histórico dos acertos com freelancers/diaristas. Cada recibo guarda os dados
-- COMO ESTAVAM na emissão (coluna "dados"): mudar o cadastro da pessoa depois
-- não altera recibos já emitidos.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rh_recibos_prestacao (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  colaborador_id uuid not null,
  numero text,

  data_trabalho date not null,
  datas_contratadas jsonb not null default '[]'::jsonb,
  dias_contratados integer not null default 1,

  valor_diaria numeric(12,2) not null default 0,
  valor_total  numeric(12,2) not null default 0,

  pagamento_realizado boolean not null default false,
  data_pagamento date,
  forma_pagamento text,

  hora_entrada text,
  hora_saida_intervalo text,
  hora_retorno_intervalo text,
  hora_saida text,

  evento text,
  funcao text,
  janta_ofertada boolean not null default true,
  itens jsonb not null default '[]'::jsonb,

  -- Retrato dos dados no momento da emissão (nome, CPF, endereço, PIX...)
  dados jsonb not null default '{}'::jsonb,
  foto_recibo_assinado text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recibos_colaborador
  on public.rh_recibos_prestacao (colaborador_id, data_trabalho desc);
create index if not exists idx_recibos_unidade
  on public.rh_recibos_prestacao (unidade_id, data_trabalho desc);

alter table public.rh_recibos_prestacao enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rh_recibos_prestacao'
      and policyname = 'rh_recibos_prestacao_all'
  ) then
    create policy rh_recibos_prestacao_all
      on public.rh_recibos_prestacao for all
      using (true) with check (true);
  end if;
end $$;
