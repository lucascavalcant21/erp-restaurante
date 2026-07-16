-- Cardápio e Receitas: persistência atômica e ordenação durável.
-- Execute uma vez no SQL Editor do Supabase antes de publicar a interface.

begin;

alter table public.fichas_tecnicas
  add column if not exists ordem integer;

-- Nula identifica fichas antigas, que mantêm a interpretação histórica de
-- rendimentos em g/ml. Novas fichas registram kg, L, porção ou unidade.
alter table public.fichas_tecnicas
  add column if not exists unidade_venda text;

with classificadas as (
  select
    id,
    row_number() over (
      partition by unidade_id, departamento
      order by ordem nulls last, nome_receita nulls last, id
    ) - 1 as nova_ordem
  from public.fichas_tecnicas
)
update public.fichas_tecnicas as ficha
   set ordem = classificadas.nova_ordem
  from classificadas
 where classificadas.id = ficha.id
   and ficha.ordem is distinct from classificadas.nova_ordem;

create index if not exists fichas_tecnicas_unidade_departamento_ordem_idx
  on public.fichas_tecnicas (unidade_id, departamento, ordem);

-- A autorização vem de uma tabela controlada pelo servidor. O módulo de
-- produção já mantém essa tabela e hoje concede acesso administrativo apenas
-- ao proprietário do ERP; usuários futuros podem ser limitados por unidade.
create or replace function public._erp_pode_editar_unidade(p_unidade_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
         from public.producao_acessos as acesso
        where acesso.usuario_id = auth.uid()
          and acesso.ativo
          and (
            acesso.papel = 'admin'
            or (acesso.papel = 'unidade' and acesso.unidade_id = p_unidade_id)
          )
     );
$$;

revoke all on function public._erp_pode_editar_unidade(text) from public, anon;
grant execute on function public._erp_pode_editar_unidade(text) to authenticated;

create or replace function public.salvar_ficha_tecnica_atomica(
  p_unidade_id text,
  p_ficha_id uuid,
  p_ficha jsonb,
  p_ingredientes jsonb,
  p_permitir_inserir_com_id boolean default false,
  p_permitir_sem_ingredientes boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ficha_id uuid := coalesce(p_ficha_id, gen_random_uuid());
  v_departamento text := nullif(btrim(p_ficha ->> 'departamento'), '');
  v_nome text := nullif(btrim(p_ficha ->> 'nome_receita'), '');
  v_existe boolean := false;
  v_ordem integer;
begin
  if p_unidade_id is null or btrim(p_unidade_id) = '' then
    raise exception using errcode = '22023', message = 'Unidade da ficha não informada.';
  end if;

  if not public._erp_pode_editar_unidade(p_unidade_id) then
    raise exception using errcode = '42501', message = 'Você não tem permissão para editar receitas desta unidade.';
  end if;

  if v_nome is null then
    raise exception using errcode = '22023', message = 'Nome da receita não informado.';
  end if;

  -- Serializa gravações do mesmo setor. Além de proteger a ordem, isto impede
  -- que duas telas criem simultaneamente um ciclo A -> B -> A.
  perform pg_advisory_xact_lock(
    hashtextextended('fichas:' || p_unidade_id || ':' || coalesce(v_departamento, ''), 0)
  );

  if p_ingredientes is null or jsonb_typeof(p_ingredientes) <> 'array' then
    raise exception using errcode = '22023', message = 'A lista de ingredientes é inválida.';
  end if;

  if jsonb_array_length(p_ingredientes) = 0 and not p_permitir_sem_ingredientes then
    raise exception using errcode = '22023', message = 'A ficha precisa ter pelo menos um ingrediente.';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_ingredientes)
        as item(insumo_id uuid, subficha_id uuid, quantidade numeric)
     where (item.insumo_id is null) = (item.subficha_id is null)
        or item.quantidade is null
        or item.quantidade <= 0
  ) then
    raise exception using errcode = '22023', message = 'Cada item deve ter um ingrediente ou pré-preparo e quantidade maior que zero.';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_ingredientes)
        as item(insumo_id uuid, subficha_id uuid, quantidade numeric)
     group by item.insumo_id, item.subficha_id
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'O mesmo ingrediente não pode aparecer duas vezes na ficha.';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_ingredientes)
        as item(insumo_id uuid, subficha_id uuid, quantidade numeric)
      left join public.insumos as insumo on insumo.id = item.insumo_id
     where item.insumo_id is not null
       and (
         insumo.id is null
         or insumo.unidade_id is distinct from p_unidade_id
         or (v_departamento is not null and insumo.departamento is distinct from v_departamento)
       )
  ) then
    raise exception using errcode = '23503', message = 'Há ingrediente inexistente, de outra unidade ou de outro setor.';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_ingredientes)
        as item(insumo_id uuid, subficha_id uuid, quantidade numeric)
      left join public.fichas_tecnicas as base on base.id = item.subficha_id
     where item.subficha_id is not null
       and (
         item.subficha_id = v_ficha_id
         or base.id is null
         or base.unidade_id is distinct from p_unidade_id
         or (v_departamento is not null and base.departamento is distinct from v_departamento)
       )
  ) then
    raise exception using errcode = '23503', message = 'Há pré-preparo inválido, de outra unidade ou de outro setor.';
  end if;

  if exists (
    with recursive dependencias(id, caminho, fechou_ciclo) as (
      select
        item.subficha_id,
        array[v_ficha_id, item.subficha_id]::uuid[],
        item.subficha_id = v_ficha_id
      from jsonb_to_recordset(p_ingredientes)
        as item(insumo_id uuid, subficha_id uuid, quantidade numeric)
      where item.subficha_id is not null

      union all

      select
        ingrediente.subficha_id,
        dependencias.caminho || ingrediente.subficha_id,
        ingrediente.subficha_id = any(dependencias.caminho)
      from dependencias
      join public.fichas_ingredientes as ingrediente
        on ingrediente.ficha_id = dependencias.id
       and ingrediente.subficha_id is not null
      where not dependencias.fechou_ciclo
    )
    select 1
      from dependencias
     where id = v_ficha_id
  ) then
    raise exception using errcode = '23514', message = 'Os pré-preparos escolhidos criariam um ciclo entre receitas.';
  end if;

  select true
    into v_existe
    from public.fichas_tecnicas
   where id = v_ficha_id
     and unidade_id = p_unidade_id
   for update;

  if coalesce(v_existe, false) then
    update public.fichas_tecnicas
       set departamento = v_departamento,
           nome_receita = v_nome,
           categoria = nullif(btrim(p_ficha ->> 'categoria'), ''),
           rendimento_porcoes = (p_ficha ->> 'rendimento_porcoes')::numeric,
           modo_preparo = coalesce(p_ficha ->> 'modo_preparo', ''),
           eh_base = coalesce((p_ficha ->> 'eh_base')::boolean, false),
           rendimento_unidade = coalesce(nullif(p_ficha ->> 'rendimento_unidade', ''), 'porcao'),
           unidade_venda = nullif(p_ficha ->> 'unidade_venda', ''),
           peso_porcao_g = nullif(p_ficha ->> 'peso_porcao_g', '')::numeric,
           imagem = nullif(p_ficha ->> 'imagem', '')
     where id = v_ficha_id
       and unidade_id = p_unidade_id;

    if not found then
      raise exception using errcode = '42501', message = 'A ficha não pôde ser atualizada nesta unidade.';
    end if;
  else
    if not p_permitir_inserir_com_id then
      raise exception using errcode = 'P0002', message = 'A ficha não existe nesta unidade ou foi removida.';
    end if;

    select coalesce(max(ordem), -1) + 1
      into v_ordem
      from public.fichas_tecnicas
     where unidade_id = p_unidade_id
       and departamento is not distinct from v_departamento;

    insert into public.fichas_tecnicas (
      id, unidade_id, departamento, nome_receita, categoria,
      rendimento_porcoes, modo_preparo, eh_base, rendimento_unidade,
      unidade_venda, peso_porcao_g, imagem, ordem
    ) values (
      v_ficha_id,
      p_unidade_id,
      v_departamento,
      v_nome,
      nullif(btrim(p_ficha ->> 'categoria'), ''),
      (p_ficha ->> 'rendimento_porcoes')::numeric,
      coalesce(p_ficha ->> 'modo_preparo', ''),
      coalesce((p_ficha ->> 'eh_base')::boolean, false),
      coalesce(nullif(p_ficha ->> 'rendimento_unidade', ''), 'porcao'),
      nullif(p_ficha ->> 'unidade_venda', ''),
      nullif(p_ficha ->> 'peso_porcao_g', '')::numeric,
      nullif(p_ficha ->> 'imagem', ''),
      v_ordem
    );
  end if;

  delete from public.fichas_ingredientes
   where ficha_id = v_ficha_id;

  insert into public.fichas_ingredientes (
    id, ficha_id, insumo_id, subficha_id, quantidade
  )
  select
    coalesce(item.id, gen_random_uuid()),
    v_ficha_id,
    item.insumo_id,
    item.subficha_id,
    item.quantidade
  from jsonb_to_recordset(p_ingredientes)
    as item(id uuid, insumo_id uuid, subficha_id uuid, quantidade numeric);

  return v_ficha_id;
end;
$$;

create or replace function public.reordenar_fichas_tecnicas(
  p_unidade_id text,
  p_departamento text,
  p_ids_esperados uuid[],
  p_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_total integer := coalesce(cardinality(p_ids), 0);
  v_encontradas integer := 0;
  v_atualizadas integer := 0;
  v_ordem_atual uuid[];
begin
  if p_unidade_id is null or btrim(p_unidade_id) = '' then
    raise exception using errcode = '22023', message = 'Unidade da ficha não informada.';
  end if;

  if not public._erp_pode_editar_unidade(p_unidade_id) then
    raise exception using errcode = '42501', message = 'Você não tem permissão para reordenar receitas desta unidade.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('fichas:' || p_unidade_id || ':' || coalesce(p_departamento, ''), 0)
  );

  if v_total = 0 then
    return 0;
  end if;

  select coalesce(array_agg(ficha.id order by ficha.ordem nulls last, ficha.nome_receita nulls last, ficha.id), '{}'::uuid[])
    into v_ordem_atual
    from public.fichas_tecnicas as ficha
   where ficha.unidade_id = p_unidade_id
     and ficha.departamento is not distinct from p_departamento;

  if v_ordem_atual is distinct from coalesce(p_ids_esperados, '{}'::uuid[]) then
    raise exception using errcode = '40001', message = 'A lista mudou em outra tela. Recarregue antes de ordenar novamente.';
  end if;

  if (select count(distinct id) from unnest(p_ids) as lista(id)) <> v_total then
    raise exception using errcode = '22023', message = 'A nova ordem contém receitas repetidas.';
  end if;

  perform 1
    from public.fichas_tecnicas
   where unidade_id = p_unidade_id
     and departamento is not distinct from p_departamento
     and id = any(p_ids)
   for update;

  select count(*)
    into v_encontradas
    from public.fichas_tecnicas
   where unidade_id = p_unidade_id
     and departamento is not distinct from p_departamento
     and id = any(p_ids);

  if v_encontradas <> v_total then
    raise exception using errcode = '42501', message = 'Uma ou mais receitas não existem neste setor ou não podem ser alteradas.';
  end if;

  update public.fichas_tecnicas as ficha
     set ordem = lista.posicao - 1
    from unnest(p_ids) with ordinality as lista(id, posicao)
   where ficha.id = lista.id
     and ficha.unidade_id = p_unidade_id
     and ficha.departamento is not distinct from p_departamento;

  get diagnostics v_atualizadas = row_count;
  if v_atualizadas <> v_total then
    raise exception using errcode = '40001', message = 'A nova ordem não pôde ser salva por completo.';
  end if;

  return v_atualizadas;
end;
$$;

revoke all on function public.salvar_ficha_tecnica_atomica(text, uuid, jsonb, jsonb, boolean, boolean) from public, anon;
revoke all on function public.reordenar_fichas_tecnicas(text, text, uuid[], uuid[]) from public, anon;
grant execute on function public.salvar_ficha_tecnica_atomica(text, uuid, jsonb, jsonb, boolean, boolean) to authenticated;
grant execute on function public.reordenar_fichas_tecnicas(text, text, uuid[], uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;
