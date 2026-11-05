/* MARM-PROD-1: produção de subprodutos exclusiva da marmitaria (05/11/2026).

   Transforma o que está no estoque da marmitaria em subproduto: frango em
   frango empanado, tomate, cebola e alho em molho. Numa transação só, baixa os
   ingredientes e dá entrada do subproduto no estoque de produção.

   ADITIVA: cria os locais "Produção da Marmitaria" e "Limpeza da Marmitaria" e uma função. Não altera
   tabela, dado existente, RLS nem grant de outro objeto.
   ROLLBACK: db/marmitaria/MARM_PROD_1_ROLLBACK.sql (só com decisão do dono). */

begin;

-- Preflight: aborta sem mudar nada se faltar alguma peça.
do $$
begin
  if to_regprocedure('public.estoque_movimentar(text,uuid,uuid,text,text,numeric,date,numeric,text,jsonb,text,text,text,text,text,text)') is null then
    raise exception 'MARM-PROD-1: estoque_movimentar ausente. Nada foi alterado.';
  end if;
  if to_regclass('public.marmitaria_producao_lotes') is null or to_regprocedure('public.hefisto_unidades_do_usuario()') is null
     or to_regprocedure('public.hefisto_ve_todas_unidades()') is null then
    raise exception 'MARM-PROD-1: falta a MARMITARIA-V2. Nada foi alterado.';
  end if;
  if not exists (select 1 from public.estoques where slug = 'marmitaria') then
    raise exception 'MARM-PROD-1: ative o estoque da marmitaria antes. Nada foi alterado.';
  end if;
end $$;

insert into public.estoques (unidade_id, nome, slug, tipo, descricao, cor, status, permissoes, controla_minimo, controla_validade, locais_internos, ordem)
select e.unidade_id, l.nome, l.slug, l.tipo, l.descricao, e.cor, 'ativo', e.permissoes, false, l.validade, e.locais_internos, coalesce(e.ordem, 0) + l.passo
  from public.estoques e
 cross join (values ('Produção da Marmitaria', 'producao-marmitaria', 'alimentos', 'Subprodutos prontos da marmitaria', true, 2),
                    ('Limpeza da Marmitaria', 'limpeza-marmitaria', 'limpeza', 'Produtos de limpeza da marmitaria', false, 3)) l(nome, slug, tipo, descricao, validade, passo)
 where e.slug = 'marmitaria'
   and not exists (select 1 from public.estoques x where x.unidade_id = e.unidade_id and x.slug = l.slug);

create or replace function public.marmitaria_produzir_preparo(p_dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lote uuid;
  v_ficha uuid;
  v_unidade text;
  v_qtd numeric;
  v_entrada numeric;
  v_data date;
  v_validade date;
  v_insumo uuid;
  v_destino uuid;
  v_b jsonb;
  v_res jsonb;
  v_baixas integer := 0;
begin
  begin
    v_lote := nullif(p_dados ->> 'lote_id', '')::uuid;
    v_ficha := nullif(p_dados ->> 'ficha_id', '')::uuid;
    v_qtd := (p_dados ->> 'quantidade')::numeric;
    v_entrada := (p_dados ->> 'quantidade_saldo')::numeric;
    v_data := coalesce(nullif(p_dados ->> 'data', '')::date, current_date);
    v_validade := nullif(p_dados ->> 'validade', '')::date;
  exception when others then
    raise exception 'Dados da produção inválidos.' using errcode = '22023';
  end;
  v_unidade := nullif(btrim(coalesce(p_dados ->> 'unidade_id', '')), '');
  if v_lote is null or v_ficha is null or v_unidade is null then
    raise exception 'Produção sem item, lote ou unidade.' using errcode = '22023';
  end if;
  if v_qtd is null or v_qtd <= 0 or v_entrada is null or v_entrada <= 0 then
    raise exception 'Informe quanto foi produzido.' using errcode = '22023';
  end if;
  if not ((select public.hefisto_ve_todas_unidades()) or v_unidade = any (public.hefisto_unidades_do_usuario())) then
    raise exception 'Você não tem acesso a esta unidade.' using errcode = '42501';
  end if;

  select i.id into v_insumo
    from public.fichas_tecnicas f join public.insumos i on i.ficha_tecnica_id = f.id
   where f.id = v_ficha and f.unidade_id = v_unidade and f.eh_base and i.unidade_id = v_unidade;
  if v_insumo is null then raise exception 'Subproduto não encontrado nesta unidade.' using errcode = '22023'; end if;

  select id into v_destino from public.estoques
   where unidade_id = v_unidade and slug = 'producao-marmitaria' and coalesce(status, 'ativo') = 'ativo';
  if v_destino is null then raise exception 'Estoque de produção da marmitaria não encontrado.' using errcode = '22023'; end if;

  -- Reenvio do mesmo lote: devolve o que já foi feito, sem baixar de novo.
  if exists (select 1 from public.marmitaria_producao_lotes where id = v_lote) then
    return jsonb_build_object('ok', true, 'idempotente', true, 'lote_id', v_lote);
  end if;

  for v_b in select value from jsonb_array_elements(coalesce(p_dados -> 'baixas', '[]'::jsonb)) loop
    -- Exclusivo da marmitaria: nunca baixa do estoque do restaurante.
    if not exists (select 1 from public.estoques where id = (v_b ->> 'estoque_id')::uuid and unidade_id = v_unidade
                    and slug in ('marmitaria', 'embalagens-marmitaria', 'producao-marmitaria')) then
      raise exception 'A produção da marmitaria só usa o estoque da marmitaria.' using errcode = '22023';
    end if;
    v_res := public.estoque_movimentar(
      p_unidade_id => v_unidade, p_estoque_id => (v_b ->> 'estoque_id')::uuid, p_insumo_id => (v_b ->> 'insumo_id')::uuid,
      p_tipo => 'saida', p_motivo => 'producao', p_quantidade => (v_b ->> 'quantidade')::numeric,
      p_observacao => 'Produção de subproduto · lote ' || left(v_lote::text, 8),
      p_responsavel_nome => nullif(p_dados ->> 'responsavel', ''),
      p_chave => 'marm-prep:' || v_lote::text || ':' || (v_b ->> 'estoque_id') || ':' || (v_b ->> 'insumo_id'),
      p_origem => 'producao');
    if coalesce((v_res ->> 'ok')::boolean, false) is not true then
      raise exception 'Baixa recusada: %', coalesce(v_res ->> 'erro', 'motivo não informado') using errcode = '22023';
    end if;
    v_baixas := v_baixas + 1;
  end loop;
  if v_baixas = 0 then raise exception 'Produção sem ingredientes para baixar.' using errcode = '22023'; end if;

  v_res := public.estoque_movimentar(
    p_unidade_id => v_unidade, p_estoque_id => v_destino, p_insumo_id => v_insumo,
    p_tipo => 'entrada', p_motivo => 'producao', p_quantidade => v_entrada, p_validade => v_validade,
    p_observacao => 'Produção de subproduto · lote ' || left(v_lote::text, 8),
    p_responsavel_nome => nullif(p_dados ->> 'responsavel', ''),
    p_chave => 'marm-prep:' || v_lote::text || ':entrada', p_origem => 'producao');
  if coalesce((v_res ->> 'ok')::boolean, false) is not true then
    raise exception 'Entrada recusada: %', coalesce(v_res ->> 'erro', 'motivo não informado') using errcode = '22023';
  end if;

  insert into public.marmitaria_producao_lotes (
    id, unidade_id, codigo, tipo_demanda, status, ficha_id, quantidade_planejada, quantidade_produzida, data_producao,
    data_validade, custo_total, baixou_ingredientes, rendimento_real_dados)
  values (
    v_lote, v_unidade, 'PREP-' || to_char(v_data, 'YYYYMMDD') || '-' || left(v_lote::text, 4), 'preparo', 'concluido', v_ficha, v_qtd, v_qtd, v_data,
    v_validade, greatest(coalesce(nullif(p_dados ->> 'custo_previsto', '')::numeric, 0), 0), true,
    jsonb_build_object('baixas', coalesce(p_dados -> 'baixas', '[]'::jsonb), 'para_o_dia', p_dados ->> 'para_o_dia'));

  return jsonb_build_object('ok', true, 'idempotente', false, 'lote_id', v_lote, 'baixas', v_baixas);
end $$;

revoke all on function public.marmitaria_produzir_preparo(jsonb) from public, anon;
grant execute on function public.marmitaria_produzir_preparo(jsonb) to authenticated;

-- Verificação pós-aplicação: aborta e desfaz se algo não ficou certo.
do $$
begin
  if to_regprocedure('public.marmitaria_produzir_preparo(jsonb)') is null then raise exception 'MARM-PROD-1: função não criada.'; end if;
  if has_function_privilege('anon', 'public.marmitaria_produzir_preparo(jsonb)', 'execute') then raise exception 'MARM-PROD-1: anon não pode executar.'; end if;
  if exists (select 1 from public.estoques e where e.slug = 'marmitaria'
              and not exists (select 1 from public.estoques x where x.unidade_id = e.unidade_id and x.slug = 'producao-marmitaria')) then
    raise exception 'MARM-PROD-1: local de produção não criado.';
  end if;
end $$;

commit;

select 'fn produzir_preparo' item, to_regprocedure('public.marmitaria_produzir_preparo(jsonb)') is not null ok
union all select 'local de produção', exists (select 1 from public.estoques where slug = 'producao-marmitaria')
union all select 'local de limpeza', exists (select 1 from public.estoques where slug = 'limpeza-marmitaria');
