-- Estoque atual + histórico integrado de entradas e saídas.
-- O saldo continua em ml/g/unidade-base para conversar com as fichas técnicas.
-- A operação informa unidades comerciais (garrafa, lata, caixa etc.).

create extension if not exists pgcrypto;

create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  departamento text,
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade_unidades numeric not null check (quantidade_unidades > 0),
  conteudo_por_unidade numeric not null check (conteudo_por_unidade > 0),
  quantidade_base numeric not null check (quantidade_base > 0),
  unidade_medida text not null,
  saldo_anterior numeric not null,
  saldo_posterior numeric not null,
  responsavel text,
  motivo text,
  data_movimento timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists estoque_movimentos_unidade_data_idx
  on public.estoque_movimentos (unidade_id, data_movimento desc);

create index if not exists estoque_movimentos_insumo_data_idx
  on public.estoque_movimentos (insumo_id, data_movimento desc);

alter table public.estoque_movimentos enable row level security;

drop policy if exists "estoque_movimentos_select" on public.estoque_movimentos;
create policy "estoque_movimentos_select"
  on public.estoque_movimentos for select
  to anon, authenticated
  using (true);

grant select on public.estoque_movimentos to anon, authenticated;

create or replace function public.registrar_movimento_estoque(
  p_unidade_id text,
  p_insumo_id uuid,
  p_departamento text,
  p_tipo text,
  p_quantidade_unidades numeric,
  p_responsavel text default null,
  p_motivo text default null,
  p_data_movimento timestamptz default now()
)
returns table (
  movimento_id uuid,
  saldo_anterior numeric,
  saldo_posterior numeric,
  quantidade_base numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insumo public.insumos%rowtype;
  v_estoque public.estoque_atual%rowtype;
  v_conteudo numeric;
  v_quantidade_base numeric;
  v_novo_saldo numeric;
  v_movimento_id uuid;
begin
  if p_tipo not in ('entrada', 'saida') then
    raise exception 'Tipo de movimentação inválido.';
  end if;

  if p_quantidade_unidades is null or p_quantidade_unidades <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  select * into v_insumo
  from public.insumos
  where id = p_insumo_id
    and unidade_id = p_unidade_id;

  if not found then
    raise exception 'Produto não encontrado nesta unidade.';
  end if;

  v_conteudo := greatest(coalesce(v_insumo.tamanho_embalagem, 1), 0.000001);
  v_quantidade_base := round((p_quantidade_unidades * v_conteudo)::numeric, 6);

  insert into public.estoque_atual (unidade_id, insumo_id, quantidade_atual, updated_at)
  values (p_unidade_id, p_insumo_id, 0, now())
  on conflict (unidade_id, insumo_id) do nothing;

  select * into v_estoque
  from public.estoque_atual
  where unidade_id = p_unidade_id
    and insumo_id = p_insumo_id
  for update;

  if p_tipo = 'saida' and coalesce(v_estoque.quantidade_atual, 0) < v_quantidade_base then
    raise exception 'Estoque insuficiente. Disponível: % unidade(s).',
      round((coalesce(v_estoque.quantidade_atual, 0) / v_conteudo)::numeric, 3);
  end if;

  v_novo_saldo := case
    when p_tipo = 'entrada' then coalesce(v_estoque.quantidade_atual, 0) + v_quantidade_base
    else coalesce(v_estoque.quantidade_atual, 0) - v_quantidade_base
  end;

  update public.estoque_atual
  set quantidade_atual = v_novo_saldo,
      updated_at = now()
  where unidade_id = p_unidade_id
    and insumo_id = p_insumo_id;

  insert into public.estoque_movimentos (
    unidade_id, insumo_id, departamento, tipo,
    quantidade_unidades, conteudo_por_unidade, quantidade_base,
    unidade_medida, saldo_anterior, saldo_posterior,
    responsavel, motivo, data_movimento
  ) values (
    p_unidade_id, p_insumo_id, coalesce(p_departamento, v_insumo.departamento), p_tipo,
    p_quantidade_unidades, v_conteudo, v_quantidade_base,
    coalesce(v_insumo.unidade_medida, 'un'), coalesce(v_estoque.quantidade_atual, 0), v_novo_saldo,
    nullif(trim(p_responsavel), ''), nullif(trim(p_motivo), ''), coalesce(p_data_movimento, now())
  ) returning id into v_movimento_id;

  return query
  select v_movimento_id, coalesce(v_estoque.quantidade_atual, 0), v_novo_saldo, v_quantidade_base;
end;
$$;

revoke all on function public.registrar_movimento_estoque(text, uuid, text, text, numeric, text, text, timestamptz) from public;
grant execute on function public.registrar_movimento_estoque(text, uuid, text, text, numeric, text, text, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
