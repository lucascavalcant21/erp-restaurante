-- Histórico dos Recibos de Prestação de Serviço dos profissionais extras.
create extension if not exists pgcrypto;

create table if not exists public.rh_recibos_prestacao (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  numero text not null,
  data_trabalho date not null,
  datas_contratadas date[] not null default '{}',
  dias_contratados integer not null default 1 check (dias_contratados > 0),
  valor_diaria numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  pagamento_realizado boolean not null default false,
  data_pagamento date,
  forma_pagamento text,
  hora_entrada text,
  hora_saida_intervalo text,
  hora_retorno_intervalo text,
  hora_saida text,
  evento text,
  funcao text,
  janta_ofertada boolean not null default false,
  itens text[] not null default '{}',
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, numero)
);

create index if not exists rh_recibos_prestacao_colaborador_idx
  on public.rh_recibos_prestacao (colaborador_id, data_trabalho desc);

alter table public.rh_recibos_prestacao enable row level security;

drop policy if exists "rh_recibos_prestacao_authenticated" on public.rh_recibos_prestacao;
create policy "rh_recibos_prestacao_authenticated"
  on public.rh_recibos_prestacao
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.rh_recibos_prestacao to authenticated;
