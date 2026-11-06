/* COM-3: fechar a comanda em uma só transação (06/11/2026, decisões do dono).

   ADITIVA: cria vendas.pedido_id, a tabela venda_pagamentos e a função
   comanda_fechar. Numa transação só: confere o valor pelo banco, grava a venda,
   os itens e os pagamentos, cria a conta a receber de cartão e Pix, soma o
   faturamento do dia, marca o pedido como pago e libera a mesa.
   Os 10% não entram no faturamento: gorjeta é do funcionário, não é receita.
   ROLLBACK: db/comandas/COM_3_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regclass('public.vendas') is null or to_regclass('public.pdv_caixas') is null
     or to_regclass('public.fin_contas_receber') is null or to_regclass('public.fin_faturamento_diario') is null then
    raise exception 'COM-3: tabelas ausentes. Nada foi alterado.';
  end if;
  if to_regclass('public.venda_pagamentos') is not null then
    raise exception 'COM-3: já aplicada. Nada foi alterado.';
  end if;
end $$;

alter table public.vendas add column pedido_id uuid references public.pedidos(id) on delete set null;
create unique index vendas_pedido_unico on public.vendas (pedido_id) where pedido_id is not null;

create table public.venda_pagamentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  unidade_id text not null references public.unidades(id),
  forma text not null check (forma in ('dinheiro', 'pix', 'debito', 'credito', 'voucher', 'outro')),
  valor numeric(14,2) not null check (valor > 0),
  created_at timestamptz not null default now()
);
create index venda_pagamentos_venda on public.venda_pagamentos (venda_id);

alter table public.venda_pagamentos enable row level security;
revoke all on public.venda_pagamentos from public, anon, authenticated;
grant select on public.venda_pagamentos to authenticated;
create policy sec_unidade on public.venda_pagamentos for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

create function public.comanda_fechar(
  p_pedido_id uuid, p_caixa_id uuid, p_pagamentos jsonb,
  p_desconto numeric default 0, p_taxa_servico numeric default 0, p_acrescimo numeric default 0, p_cliente text default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ped public.pedidos%rowtype;
  v_venda_id uuid;
  v_subtotal numeric(14,2);
  v_desconto numeric(14,2) := round(coalesce(p_desconto, 0), 2);
  v_taxa numeric(14,2) := round(coalesce(p_taxa_servico, 0), 2);
  v_acrescimo numeric(14,2) := round(coalesce(p_acrescimo, 0), 2);
  v_total numeric(14,2);
  v_pago numeric(14,2) := 0;
  v_pag record;
  v_n int := 0;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_formas text[];
begin
  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if not found then raise exception 'Comanda não encontrada.'; end if;
  if not public.hefisto_user_can('salao.sector.confirm', v_ped.unidade_id) then
    raise exception 'Sem permissão para receber contas nesta unidade.';
  end if;

  -- Segundo toque no botão: devolve a mesma venda.
  if v_ped.status = 'pago' then
    select id into v_venda_id from public.vendas where pedido_id = p_pedido_id;
    if v_venda_id is not null then return jsonb_build_object('ok', true, 'venda_id', v_venda_id, 'repetido', true); end if;
  end if;
  if v_ped.status <> 'aberto' then raise exception 'Esta comanda não está aberta.'; end if;

  if not exists (select 1 from public.pdv_caixas where id = p_caixa_id and unidade_id = v_ped.unidade_id and status = 'aberto') then
    raise exception 'Abra o caixa antes de receber.';
  end if;

  select coalesce(sum(round(quantidade * valor_unitario, 2)), 0) into v_subtotal
    from public.pedidos_itens where pedido_id = p_pedido_id and status_kds is distinct from 'cancelado';
  if v_subtotal <= 0 then raise exception 'A comanda está sem itens.'; end if;
  if v_desconto < 0 or v_taxa < 0 or v_acrescimo < 0 then raise exception 'Valores negativos não são aceitos.'; end if;
  if v_desconto > v_subtotal then raise exception 'O desconto passa do valor da comanda.'; end if;
  v_total := v_subtotal - v_desconto + v_acrescimo + v_taxa;

  if jsonb_typeof(p_pagamentos) is distinct from 'array' or jsonb_array_length(p_pagamentos) = 0 then
    raise exception 'Informe o pagamento.';
  end if;
  select coalesce(sum(round((p->>'valor')::numeric, 2)), 0), array_agg(distinct p->>'forma') into v_pago, v_formas from jsonb_array_elements(p_pagamentos) p;
  if v_pago <> v_total then
    raise exception 'Pagamentos somam % e a conta é %.', v_pago, v_total;
  end if;

  insert into public.vendas (subtotal, desconto, total, forma_pagamento, cliente, observacao, status, unidade_id, taxa_servico, acrescimo, caixa_id, pedido_id)
  values (v_subtotal, v_desconto, v_total, case when cardinality(v_formas) = 1 then v_formas[1] else 'multiplo' end,
          nullif(btrim(coalesce(p_cliente, '')), ''), 'Comanda ' || coalesce(v_ped.identificacao, left(p_pedido_id::text, 6)),
          'concluida', v_ped.unidade_id, v_taxa, v_acrescimo, p_caixa_id, p_pedido_id)
  returning id into v_venda_id;

  insert into public.venda_itens (venda_id, nome, preco_unit, quantidade, subtotal, unidade_id)
  select v_venda_id, coalesce(pr.nome_produto, 'Item'), i.valor_unitario, i.quantidade, round(i.quantidade * i.valor_unitario, 2), v_ped.unidade_id
    from public.pedidos_itens i left join public.produtos pr on pr.id = i.produto_id
   where i.pedido_id = p_pedido_id and i.status_kds is distinct from 'cancelado';

  for v_pag in select p->>'forma' as forma, round((p->>'valor')::numeric, 2) as valor from jsonb_array_elements(p_pagamentos) p loop
    if v_pag.valor <= 0 then raise exception 'Valor de pagamento inválido.'; end if;
    v_n := v_n + 1;
    insert into public.venda_pagamentos (venda_id, unidade_id, forma, valor) values (v_venda_id, v_ped.unidade_id, v_pag.forma, v_pag.valor);
    -- Dinheiro fica no fechamento do caixa; o resto vira conta a conferir.
    if v_pag.forma <> 'dinheiro' then
      insert into public.fin_contas_receber (unidade_id, origem_tipo, origem_id, venda_id, descricao, meio, modalidade, data_venda, data_prevista, valor_bruto, status, chave_idempotencia, criado_por)
      values (v_ped.unidade_id, 'VENDA', v_venda_id, v_venda_id, 'Comanda ' || coalesce(v_ped.identificacao, left(p_pedido_id::text, 6)), v_pag.forma,
              case when v_pag.forma = 'voucher' then 'pre_pago' when v_pag.forma = 'outro' then 'nao_se_aplica' else 'a_vista' end,
              v_hoje, v_hoje, v_pag.valor, 'previsto', 'comanda:' || p_pedido_id || ':' || v_n, auth.uid());
    end if;
  end loop;

  insert into public.fin_faturamento_diario as f (unidade_id, data, vendas_brutas, descontos, fonte, criado_por)
  values (v_ped.unidade_id, v_hoje, v_subtotal + v_acrescimo, v_desconto, 'Comandas do Héfisto', auth.uid())
  on conflict (unidade_id, data) do update set vendas_brutas = f.vendas_brutas + excluded.vendas_brutas, descontos = f.descontos + excluded.descontos,
    updated_at = now(), atualizado_por = auth.uid();

  update public.pedidos set status = 'pago', valor_total = v_total, updated_at = now(),
    forma_pagamento = case when cardinality(v_formas) = 1 then v_formas[1] else 'multiplo' end
   where id = p_pedido_id;

  if v_ped.mesa_id is not null and not exists (select 1 from public.pedidos where mesa_id = v_ped.mesa_id and status = 'aberto') then
    update public.mesas set status = 'livre' where id = v_ped.mesa_id;
  end if;

  return jsonb_build_object('ok', true, 'venda_id', v_venda_id, 'total', v_total);
end $$;

revoke all on function public.comanda_fechar(uuid, uuid, jsonb, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.comanda_fechar(uuid, uuid, jsonb, numeric, numeric, numeric, text) to authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.venda_pagamentos'::regclass) then raise exception 'COM-3: RLS desligado.'; end if;
  if has_function_privilege('anon', 'public.comanda_fechar(uuid, uuid, jsonb, numeric, numeric, numeric, text)', 'execute') then raise exception 'COM-3: anon não pode fechar.'; end if;
end $$;

commit;
