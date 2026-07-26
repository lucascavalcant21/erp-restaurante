-- Múltiplos estoques independentes por unidade/restaurante.
-- Mantém estoque_atual e estoque_movimentos legados para compatibilidade.

create table if not exists public.estoques (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  nome text not null,
  slug text not null,
  tipo text not null check (tipo in ('alimentos', 'bebidas', 'limpeza', 'materiais', 'embalagens')),
  descricao text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  cor text not null default '#059669',
  icone text,
  permissoes jsonb not null default '[]'::jsonb,
  controla_validade boolean not null default false,
  controla_minimo boolean not null default true,
  locais_internos text[] not null default '{}',
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, slug)
);

create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  estoque_id uuid not null references public.estoques(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete restrict,
  quantidade_atual numeric not null default 0 check (quantidade_atual >= 0),
  estoque_minimo numeric,
  estoque_maximo numeric,
  local_interno text,
  validade date,
  custo_unitario numeric,
  permite_transferencia boolean not null default true,
  ultima_movimentacao_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estoque_id, insumo_id)
);

create table if not exists public.estoque_movimentacoes_multi (
  id uuid primary key default gen_random_uuid(),
  transferencia_id uuid,
  unidade_id text not null references public.unidades(id) on delete cascade,
  estoque_id uuid not null references public.estoques(id) on delete restrict,
  estoque_destino_id uuid references public.estoques(id) on delete restrict,
  insumo_id uuid not null references public.insumos(id) on delete restrict,
  tipo text not null check (tipo in (
    'entrada', 'saida', 'contagem',
    'transferencia_saida', 'transferencia_entrada'
  )),
  quantidade numeric not null,
  saldo_anterior numeric not null default 0,
  saldo_posterior numeric not null default 0,
  usuario_id uuid,
  usuario_nome text,
  observacao text,
  data_movimento timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists estoques_unidade_status_idx
  on public.estoques (unidade_id, status, ordem);
create index if not exists estoque_itens_estoque_idx
  on public.estoque_itens (estoque_id, insumo_id);
create index if not exists estoque_itens_unidade_insumo_idx
  on public.estoque_itens (unidade_id, insumo_id);
create index if not exists estoque_mov_multi_estoque_data_idx
  on public.estoque_movimentacoes_multi (estoque_id, data_movimento desc);
create index if not exists estoque_mov_multi_destino_data_idx
  on public.estoque_movimentacoes_multi (estoque_destino_id, data_movimento desc);

-- Cinco estoques iniciais em todas as unidades existentes.
insert into public.estoques (
  unidade_id, nome, slug, tipo, descricao, status, cor,
  controla_validade, controla_minimo, ordem
)
select
  u.id,
  padrao.nome,
  padrao.slug,
  padrao.tipo,
  padrao.descricao,
  'ativo',
  padrao.cor,
  padrao.controla_validade,
  true,
  padrao.ordem
from public.unidades u
cross join (
  values
    ('Cozinha', 'cozinha', 'alimentos', 'Estoque de comidas da cozinha', '#059669', true, 0),
    ('Bar', 'bar', 'bebidas', 'Estoque de bebidas e produtos do bar', '#7c3aed', true, 1),
    ('Limpeza', 'limpeza', 'limpeza', 'Produtos de limpeza e higiene', '#0284c7', false, 2),
    ('Materiais variados', 'materiais-variados', 'materiais', 'Materiais de escritório e uso geral', '#d97706', false, 3),
    ('Embalagens', 'embalagens', 'embalagens', 'Potes, sacolas, caixas e descartáveis', '#db2777', false, 4)
) as padrao(nome, slug, tipo, descricao, cor, controla_validade, ordem)
on conflict (unidade_id, slug) do nothing;

-- Migra os saldos atuais para Cozinha ou Bar sem misturar departamentos.
insert into public.estoque_itens (
  unidade_id, estoque_id, insumo_id, quantidade_atual,
  estoque_minimo, estoque_maximo, custo_unitario, updated_at
)
select
  i.unidade_id,
  e.id,
  i.id,
  coalesce(a.quantidade_atual, 0),
  i.estoque_minimo,
  i.estoque_maximo,
  coalesce(nullif(i.custo_compra, 0), i.custo_unitario, 0),
  now()
from public.insumos i
join public.estoques e
  on e.unidade_id = i.unidade_id
 and e.slug = case when lower(coalesce(i.departamento, 'cozinha')) = 'bar' then 'bar' else 'cozinha' end
left join public.estoque_atual a
  on a.unidade_id = i.unidade_id
 and a.insumo_id = i.id
where i.unidade_id is not null
on conflict (estoque_id, insumo_id) do update
set
  quantidade_atual = excluded.quantidade_atual,
  estoque_minimo = coalesce(public.estoque_itens.estoque_minimo, excluded.estoque_minimo),
  estoque_maximo = coalesce(public.estoque_itens.estoque_maximo, excluded.estoque_maximo),
  custo_unitario = coalesce(public.estoque_itens.custo_unitario, excluded.custo_unitario),
  updated_at = now();

create or replace function public.registrar_movimento_estoque_multi(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null,
  p_data_movimento timestamptz default now()
)
returns table(novo_saldo numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.estoque_itens%rowtype;
  v_novo numeric;
begin
  if p_tipo not in ('entrada', 'saida') or p_quantidade <= 0 then
    raise exception 'Movimentação inválida';
  end if;

  insert into public.estoque_itens (unidade_id, estoque_id, insumo_id)
  values (p_unidade_id, p_estoque_id, p_insumo_id)
  on conflict (estoque_id, insumo_id) do nothing;

  select * into v_item
  from public.estoque_itens
  where estoque_id = p_estoque_id and insumo_id = p_insumo_id
  for update;

  if p_tipo = 'saida' and v_item.quantidade_atual < p_quantidade then
    raise exception 'Saldo insuficiente neste estoque';
  end if;

  v_novo := case
    when p_tipo = 'entrada' then v_item.quantidade_atual + p_quantidade
    else v_item.quantidade_atual - p_quantidade
  end;

  update public.estoque_itens
  set quantidade_atual = v_novo,
      ultima_movimentacao_em = p_data_movimento,
      updated_at = now()
  where id = v_item.id;

  insert into public.estoque_movimentacoes_multi (
    unidade_id, estoque_id, insumo_id, tipo, quantidade,
    saldo_anterior, saldo_posterior, usuario_id, usuario_nome,
    observacao, data_movimento
  ) values (
    p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade,
    v_item.quantidade_atual, v_novo, p_usuario_id, p_usuario_nome,
    p_observacao, p_data_movimento
  );

  return query select v_novo;
end;
$$;

create or replace function public.registrar_contagem_estoque_multi(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_saldo_contado numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null
)
returns table(novo_saldo numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.estoque_itens%rowtype;
begin
  if p_saldo_contado < 0 then raise exception 'Saldo contado inválido'; end if;

  insert into public.estoque_itens (unidade_id, estoque_id, insumo_id)
  values (p_unidade_id, p_estoque_id, p_insumo_id)
  on conflict (estoque_id, insumo_id) do nothing;

  select * into v_item
  from public.estoque_itens
  where estoque_id = p_estoque_id and insumo_id = p_insumo_id
  for update;

  update public.estoque_itens
  set quantidade_atual = p_saldo_contado,
      ultima_movimentacao_em = now(),
      updated_at = now()
  where id = v_item.id;

  insert into public.estoque_movimentacoes_multi (
    unidade_id, estoque_id, insumo_id, tipo, quantidade,
    saldo_anterior, saldo_posterior, usuario_id, usuario_nome,
    observacao, data_movimento
  ) values (
    p_unidade_id, p_estoque_id, p_insumo_id, 'contagem',
    p_saldo_contado - v_item.quantidade_atual,
    v_item.quantidade_atual, p_saldo_contado,
    p_usuario_id, p_usuario_nome, p_observacao, now()
  );

  return query select p_saldo_contado;
end;
$$;

create or replace function public.transferir_item_entre_estoques(
  p_unidade_id text,
  p_estoque_origem_id uuid,
  p_estoque_destino_id uuid,
  p_insumo_id uuid,
  p_quantidade numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null
)
returns table(saldo_origem numeric, saldo_destino numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_origem public.estoque_itens%rowtype;
  v_destino public.estoque_itens%rowtype;
  v_tipo_origem text;
  v_tipo_destino text;
  v_transferencia uuid := gen_random_uuid();
begin
  if p_estoque_origem_id = p_estoque_destino_id or p_quantidade <= 0 then
    raise exception 'Transferência inválida';
  end if;

  select tipo into v_tipo_origem from public.estoques where id = p_estoque_origem_id and unidade_id = p_unidade_id and status = 'ativo';
  select tipo into v_tipo_destino from public.estoques where id = p_estoque_destino_id and unidade_id = p_unidade_id and status = 'ativo';
  if v_tipo_origem is null or v_tipo_destino is null then raise exception 'Estoque inválido'; end if;
  if v_tipo_origem <> v_tipo_destino
     and not (v_tipo_origem in ('alimentos', 'bebidas') and v_tipo_destino in ('alimentos', 'bebidas')) then
    raise exception 'Tipos de estoque incompatíveis';
  end if;

  select * into v_origem
  from public.estoque_itens
  where estoque_id = p_estoque_origem_id and insumo_id = p_insumo_id
  for update;
  if v_origem.id is null or not v_origem.permite_transferencia then raise exception 'Item não transferível'; end if;
  if v_origem.quantidade_atual < p_quantidade then raise exception 'Saldo insuficiente no estoque de origem'; end if;

  insert into public.estoque_itens (
    unidade_id, estoque_id, insumo_id, quantidade_atual,
    estoque_minimo, estoque_maximo, custo_unitario, permite_transferencia
  ) values (
    p_unidade_id, p_estoque_destino_id, p_insumo_id, 0,
    v_origem.estoque_minimo, v_origem.estoque_maximo,
    v_origem.custo_unitario, v_origem.permite_transferencia
  )
  on conflict (estoque_id, insumo_id) do nothing;

  select * into v_destino
  from public.estoque_itens
  where estoque_id = p_estoque_destino_id and insumo_id = p_insumo_id
  for update;

  update public.estoque_itens
  set quantidade_atual = v_origem.quantidade_atual - p_quantidade,
      ultima_movimentacao_em = now(), updated_at = now()
  where id = v_origem.id;
  update public.estoque_itens
  set quantidade_atual = v_destino.quantidade_atual + p_quantidade,
      ultima_movimentacao_em = now(), updated_at = now()
  where id = v_destino.id;

  insert into public.estoque_movimentacoes_multi (
    transferencia_id, unidade_id, estoque_id, estoque_destino_id,
    insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
    usuario_id, usuario_nome, observacao
  ) values
  (
    v_transferencia, p_unidade_id, p_estoque_origem_id, p_estoque_destino_id,
    p_insumo_id, 'transferencia_saida', p_quantidade,
    v_origem.quantidade_atual, v_origem.quantidade_atual - p_quantidade,
    p_usuario_id, p_usuario_nome, p_observacao
  ),
  (
    v_transferencia, p_unidade_id, p_estoque_destino_id, p_estoque_origem_id,
    p_insumo_id, 'transferencia_entrada', p_quantidade,
    v_destino.quantidade_atual, v_destino.quantidade_atual + p_quantidade,
    p_usuario_id, p_usuario_nome, p_observacao
  );

  return query select
    v_origem.quantidade_atual - p_quantidade,
    v_destino.quantidade_atual + p_quantidade;
end;
$$;

alter table public.estoques enable row level security;
alter table public.estoque_itens enable row level security;
alter table public.estoque_movimentacoes_multi enable row level security;

drop policy if exists "estoques_auth_full" on public.estoques;
create policy "estoques_auth_full" on public.estoques
  for all to authenticated using (true) with check (true);
drop policy if exists "estoque_itens_auth_full" on public.estoque_itens;
create policy "estoque_itens_auth_full" on public.estoque_itens
  for all to authenticated using (true) with check (true);
drop policy if exists "estoque_mov_multi_auth_full" on public.estoque_movimentacoes_multi;
create policy "estoque_mov_multi_auth_full" on public.estoque_movimentacoes_multi
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.estoques to authenticated;
grant select, insert, update, delete on public.estoque_itens to authenticated;
grant select, insert on public.estoque_movimentacoes_multi to authenticated;
grant execute on function public.registrar_movimento_estoque_multi(text, uuid, uuid, text, numeric, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.registrar_contagem_estoque_multi(text, uuid, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.transferir_item_entre_estoques(text, uuid, uuid, uuid, numeric, uuid, text, text) to authenticated;
