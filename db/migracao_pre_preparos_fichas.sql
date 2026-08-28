-- Pré-preparos do Bar e da Cozinha passam a ser derivados exclusivamente das
-- fichas técnicas marcadas com eh_base = true.
--
-- A migração apaga somente a LISTA ATUAL dos dois estoques de pré-preparo e a
-- recria com saldo zero. O histórico de movimentações e de produção permanece.

begin;

alter table public.insumos
  add column if not exists ficha_tecnica_id uuid
  references public.fichas_tecnicas(id) on delete set null;

alter table public.insumos
  add column if not exists pre_preparo_legado boolean not null default false;

alter table public.estoque_itens
  add column if not exists ficha_tecnica_id uuid
  references public.fichas_tecnicas(id) on delete cascade;

create unique index if not exists insumos_ficha_tecnica_unico_idx
  on public.insumos (unidade_id, ficha_tecnica_id)
  where ficha_tecnica_id is not null;

create index if not exists insumos_ficha_tecnica_idx
  on public.insumos (ficha_tecnica_id)
  where ficha_tecnica_id is not null;

create unique index if not exists estoque_itens_ficha_tecnica_unico_idx
  on public.estoque_itens (estoque_id, ficha_tecnica_id)
  where ficha_tecnica_id is not null;

-- Garante os dois estoques em todas as unidades antes de sincronizar.
insert into public.estoques (
  unidade_id, nome, slug, tipo, descricao, status, cor,
  controla_validade, controla_minimo, ordem
)
select
  u.id, p.nome, p.slug, p.tipo, p.descricao, 'ativo', p.cor,
  true, true, p.ordem
from public.unidades u
cross join (
  values
    ('Pré-preparos da Cozinha', 'pre-preparos-cozinha', 'alimentos', 'Produções derivadas das fichas técnicas da cozinha', '#d97706', 1),
    ('Pré-preparos do Bar', 'pre-preparos-bar', 'bebidas', 'Produções derivadas das fichas técnicas do bar', '#ea580c', 3)
) as p(nome, slug, tipo, descricao, cor, ordem)
on conflict (unidade_id, slug) do update set
  nome = excluded.nome,
  tipo = excluded.tipo,
  descricao = excluded.descricao,
  status = 'ativo',
  controla_validade = true,
  controla_minimo = true;

create or replace function public.sincronizar_pre_preparo_ficha(p_ficha_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ficha public.fichas_tecnicas%rowtype;
  v_estoque_id uuid;
  v_insumo_id uuid;
  v_unidade text;
  v_categoria text;
  v_saldo numeric := 0;
begin
  select * into v_ficha
  from public.fichas_tecnicas
  where id = p_ficha_id;

  if not found then
    return;
  end if;

  select id into v_insumo_id
  from public.insumos
  where unidade_id = v_ficha.unidade_id
    and ficha_tecnica_id = v_ficha.id
  limit 1;

  -- Se deixou de ser pré-preparo, sai da lista atual. O insumo espelho fica
  -- apenas para preservar eventuais movimentações históricas.
  if v_ficha.eh_base is not true
     or lower(coalesce(v_ficha.departamento, '')) not in ('bar', 'cozinha') then
    if v_insumo_id is not null then
      delete from public.estoque_itens ei
      using public.estoques e
      where ei.estoque_id = e.id
        and ei.insumo_id = v_insumo_id
        and e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha');

      update public.insumos
      set ficha_tecnica_id = null,
          pre_preparo_legado = true
      where id = v_insumo_id;
    end if;
    return;
  end if;

  v_unidade := case
    when lower(coalesce(v_ficha.rendimento_unidade, '')) in ('kg', 'g', 'l', 'ml', 'un')
      then lower(v_ficha.rendimento_unidade)
    else 'un'
  end;
  v_categoria := coalesce(
    nullif(trim(v_ficha.categoria), ''),
    case when lower(v_ficha.departamento) = 'bar'
      then 'Xaropes e pré-preparos' else 'Pré-preparos' end
  );

  select id into v_estoque_id
  from public.estoques
  where unidade_id = v_ficha.unidade_id
    and slug = 'pre-preparos-' || lower(v_ficha.departamento)
  limit 1;

  if v_estoque_id is null then
    raise exception 'Estoque de pré-preparos não encontrado para % / %',
      v_ficha.unidade_id, v_ficha.departamento;
  end if;

  if v_insumo_id is null then
    insert into public.insumos (
      unidade_id, nome, nome_interno, departamento, categoria, tipo,
      unidade_medida, unidade_comercial, tamanho_embalagem,
      custo_unitario, custo_compra, ficha_tecnica_id, pre_preparo_legado
    ) values (
      v_ficha.unidade_id, trim(v_ficha.nome_receita), trim(v_ficha.nome_receita),
      lower(v_ficha.departamento), v_categoria, 'ingrediente',
      v_unidade, v_unidade, 1, 0, 0, v_ficha.id, false
    ) returning id into v_insumo_id;
  else
    update public.insumos set
      nome = trim(v_ficha.nome_receita),
      nome_interno = trim(v_ficha.nome_receita),
      departamento = lower(v_ficha.departamento),
      categoria = v_categoria,
      tipo = 'ingrediente',
      pre_preparo_legado = false,
      unidade_medida = v_unidade,
      unidade_comercial = v_unidade,
      tamanho_embalagem = 1
    where id = v_insumo_id;
  end if;

  -- Uma ficha pode mudar de Bar para Cozinha. Leva o saldo junto e remove o
  -- vínculo antigo, mantendo uma única linha atual para a ficha.
  select coalesce(sum(ei.quantidade_atual), 0) into v_saldo
  from public.estoque_itens ei
  join public.estoques e on e.id = ei.estoque_id
  where ei.insumo_id = v_insumo_id
    and e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha');

  delete from public.estoque_itens ei
  using public.estoques e
  where ei.estoque_id = e.id
    and ei.insumo_id = v_insumo_id
    and e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha')
    and e.id <> v_estoque_id;

  insert into public.estoque_itens (
    unidade_id, estoque_id, insumo_id, ficha_tecnica_id, quantidade_atual,
    custo_unitario, local_interno, updated_at
  ) values (
    v_ficha.unidade_id, v_estoque_id, v_insumo_id, v_ficha.id, v_saldo,
    0,
    case when lower(v_ficha.departamento) = 'bar' then 'Geladeira do Bar' else 'Freezer 1' end,
    now()
  )
  on conflict (estoque_id, insumo_id) do update set
    ficha_tecnica_id = excluded.ficha_tecnica_id,
    updated_at = now();
end;
$$;

create or replace function public.trigger_sincronizar_pre_preparo_ficha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sincronizar_pre_preparo_ficha(new.id);
  return new;
end;
$$;

create or replace function public.trigger_remover_pre_preparo_ficha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.estoque_itens ei
  using public.estoques e, public.insumos i
  where ei.estoque_id = e.id
    and ei.insumo_id = i.id
    and i.ficha_tecnica_id = old.id
    and e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha');

  update public.insumos
  set ficha_tecnica_id = null,
      pre_preparo_legado = true
  where ficha_tecnica_id = old.id;
  return old;
end;
$$;

drop trigger if exists fichas_sincronizar_pre_preparo on public.fichas_tecnicas;
create trigger fichas_sincronizar_pre_preparo
after insert or update
on public.fichas_tecnicas
for each row execute function public.trigger_sincronizar_pre_preparo_ficha();

drop trigger if exists fichas_remover_pre_preparo on public.fichas_tecnicas;
create trigger fichas_remover_pre_preparo
before delete on public.fichas_tecnicas
for each row execute function public.trigger_remover_pre_preparo_ficha();

revoke all on function public.sincronizar_pre_preparo_ficha(uuid) from public, anon, authenticated;
revoke all on function public.trigger_sincronizar_pre_preparo_ficha() from public, anon, authenticated;
revoke all on function public.trigger_remover_pre_preparo_ficha() from public, anon, authenticated;

-- Escopo destrutivo solicitado: remove a lista/saldo atual SOMENTE dos dois
-- estoques. Movimentações históricas não são apagadas.
create temporary table pre_preparos_insumos_anteriores on commit drop as
select distinct ei.insumo_id
from public.estoque_itens ei
join public.estoques e on e.id = ei.estoque_id
where e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha');

delete from public.estoque_itens ei
using public.estoques e
where ei.estoque_id = e.id
  and e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha');

update public.insumos
set pre_preparo_legado = true,
    ficha_tecnica_id = null
where id in (select insumo_id from pre_preparos_insumos_anteriores);

-- O saldo legado global deve refletir o que ainda existe nos demais estoques.
update public.estoque_atual ea
set quantidade_atual = coalesce((
  select sum(ei.quantidade_atual)
  from public.estoque_itens ei
  where ei.unidade_id = ea.unidade_id
    and ei.insumo_id = ea.insumo_id
), 0),
updated_at = now()
where ea.insumo_id in (select insumo_id from pre_preparos_insumos_anteriores);

-- Remove vínculos antigos da integração anterior antes de recriar a fonte
-- oficial. Os insumos ficam preservados como legado para o histórico.
update public.insumos
set ficha_tecnica_id = null,
    pre_preparo_legado = case when ficha_tecnica_id is not null then true else pre_preparo_legado end
where ficha_tecnica_id is not null;

do $$
declare
  f record;
begin
  for f in
    select id
    from public.fichas_tecnicas
    where eh_base is true
      and lower(coalesce(departamento, '')) in ('bar', 'cozinha')
  loop
    perform public.sincronizar_pre_preparo_ficha(f.id);
  end loop;
end $$;

commit;

-- Conferência esperada: uma linha para cada ficha de pré-preparo do setor.
select
  e.unidade_id,
  e.slug,
  count(*) as itens_atuais,
  count(i.ficha_tecnica_id) as vinculados_a_ficha,
  coalesce(sum(ei.quantidade_atual), 0) as saldo_total
from public.estoques e
left join public.estoque_itens ei on ei.estoque_id = e.id
left join public.insumos i on i.id = ei.insumo_id
where e.slug in ('pre-preparos-bar', 'pre-preparos-cozinha')
group by e.unidade_id, e.slug
order by e.unidade_id, e.slug;
