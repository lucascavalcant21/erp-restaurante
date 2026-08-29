-- Corrige os custos dos pré-preparos já migrados sem alterar seus saldos.
-- O custo é calculado pela composição da ficha, incluindo subfichas e perda.

begin;

create or replace function public.custo_total_ficha_preparo(
  p_ficha_id uuid,
  p_visitados uuid[] default '{}'::uuid[]
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total numeric := 0;
  v_perda numeric;
  v_rendimento numeric;
  item record;
begin
  if p_ficha_id is null or p_ficha_id = any(p_visitados) then
    return 0;
  end if;

  for item in
    select
      fi.quantidade,
      fi.fator_correcao,
      fi.insumo_id,
      fi.subficha_id,
      i.custo_unitario,
      i.perda_pct
    from public.fichas_ingredientes fi
    left join public.insumos i on i.id = fi.insumo_id
    where fi.ficha_id = p_ficha_id
  loop
    v_perda := least(99.99, greatest(0,
      case when coalesce(item.perda_pct, 0) > 0
        then item.perda_pct else coalesce(item.fator_correcao, 0) end
    ));

    if item.insumo_id is not null then
      v_total := v_total
        + coalesce(item.custo_unitario, 0) * coalesce(item.quantidade, 0)
          / (1 - v_perda / 100);
    elsif item.subficha_id is not null then
      select greatest(coalesce(rendimento_porcoes, 1), 1)
        into v_rendimento
      from public.fichas_tecnicas
      where id = item.subficha_id;

      v_total := v_total
        + public.custo_total_ficha_preparo(
            item.subficha_id,
            array_append(p_visitados, p_ficha_id)
          )
          / greatest(coalesce(v_rendimento, 1), 1)
          * coalesce(item.quantidade, 0)
          / (1 - v_perda / 100);
    end if;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.custo_total_ficha_preparo(uuid, uuid[])
  from public, anon, authenticated;

create or replace function public.atualizar_custo_pre_preparo_ficha(p_ficha_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_custo numeric;
begin
  select public.custo_total_ficha_preparo(f.id)
      / greatest(coalesce(f.rendimento_porcoes, 1), 1)
    into v_custo
  from public.fichas_tecnicas f
  where f.id = p_ficha_id
    and f.eh_base is true
    and lower(coalesce(f.departamento, '')) in ('bar', 'cozinha');

  if not found then return; end if;

  update public.insumos
  set custo_unitario = v_custo,
      custo_compra = v_custo
  where ficha_tecnica_id = p_ficha_id;

  update public.estoque_itens ei
  set custo_unitario = v_custo,
      updated_at = now()
  from public.insumos i
  where ei.insumo_id = i.id
    and i.ficha_tecnica_id = p_ficha_id;
end;
$$;

create or replace function public.atualizar_custos_pre_preparos_unidade(p_unidade_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  for f in
    select id
    from public.fichas_tecnicas
    where unidade_id = p_unidade_id
      and eh_base is true
      and lower(coalesce(departamento, '')) in ('bar', 'cozinha')
  loop
    perform public.atualizar_custo_pre_preparo_ficha(f.id);
  end loop;
end;
$$;

create or replace function public.trigger_atualizar_custos_pre_preparos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unidade_id text;
begin
  if tg_table_name = 'fichas_ingredientes' then
    select unidade_id into v_unidade_id
    from public.fichas_tecnicas
    where id = case when tg_op = 'DELETE' then old.ficha_id else new.ficha_id end;
  elsif tg_table_name = 'fichas_tecnicas' then
    v_unidade_id := coalesce(new.unidade_id, old.unidade_id);
  elsif tg_table_name = 'insumos' then
    -- O próprio espelho é atualizado por esta rotina. Só custos de ingredientes
    -- reais devem disparar uma nova rodada, evitando recursão.
    if new.ficha_tecnica_id is not null then return new; end if;
    v_unidade_id := new.unidade_id;
  end if;

  if v_unidade_id is not null then
    perform public.atualizar_custos_pre_preparos_unidade(v_unidade_id);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists zz_fichas_ingredientes_custos_preparos on public.fichas_ingredientes;
create trigger zz_fichas_ingredientes_custos_preparos
after insert or update or delete on public.fichas_ingredientes
for each row execute function public.trigger_atualizar_custos_pre_preparos();

drop trigger if exists zz_fichas_tecnicas_custos_preparos on public.fichas_tecnicas;
create trigger zz_fichas_tecnicas_custos_preparos
after insert or update on public.fichas_tecnicas
for each row execute function public.trigger_atualizar_custos_pre_preparos();

drop trigger if exists zz_insumos_custos_preparos on public.insumos;
create trigger zz_insumos_custos_preparos
after update of custo_unitario, perda_pct on public.insumos
for each row
when (
  old.custo_unitario is distinct from new.custo_unitario
  or old.perda_pct is distinct from new.perda_pct
)
execute function public.trigger_atualizar_custos_pre_preparos();

revoke all on function public.atualizar_custo_pre_preparo_ficha(uuid)
  from public, anon, authenticated;
revoke all on function public.atualizar_custos_pre_preparos_unidade(text)
  from public, anon, authenticated;
revoke all on function public.trigger_atualizar_custos_pre_preparos()
  from public, anon, authenticated;

with custos as (
  select
    f.id as ficha_id,
    public.custo_total_ficha_preparo(f.id)
      / greatest(coalesce(f.rendimento_porcoes, 1), 1) as custo_unitario
  from public.fichas_tecnicas f
  where f.eh_base is true
    and lower(coalesce(f.departamento, '')) in ('bar', 'cozinha')
)
update public.insumos i
set custo_unitario = c.custo_unitario,
    custo_compra = c.custo_unitario
from custos c
where i.ficha_tecnica_id = c.ficha_id;

update public.estoque_itens ei
set custo_unitario = i.custo_unitario,
    updated_at = now()
from public.insumos i
where ei.insumo_id = i.id
  and i.ficha_tecnica_id is not null;

commit;

select
  e.slug,
  count(*) as itens,
  count(*) filter (where coalesce(ei.custo_unitario, 0) > 0) as itens_com_custo,
  round(coalesce(sum(ei.custo_unitario), 0), 2) as soma_custos_unitarios
from public.estoque_itens ei
join public.estoques e on e.id = ei.estoque_id
where e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha')
group by e.slug
order by e.slug;
