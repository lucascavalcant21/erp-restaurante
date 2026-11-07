/* COM-5: trocar e juntar mesas, transferir item e cancelar item enviado (07/11/2026).

   Por quê: o dono quer que o caixa libere ou bloqueie, garçom por garçom,
   "trocar e juntar mesas" (salao.tables.move) e "cancelar item enviado"
   (salao.tables.cancel). Para o bloqueio valer de verdade, a regra fica no
   banco: cada função confere a permissão na unidade da comanda, e não só a tela.

   ADITIVA: quatro colunas em pedidos_itens (quem cancelou, quando, por quê e de
   que comanda o item veio) e quatro funções. Nada é apagado:
     - comanda_trocar_mesa(pedido, mesa)       leva a comanda para uma mesa livre;
     - comanda_juntar(origem, destino)          passa os itens de uma comanda para
                                                 outra; a de origem fica 'transferido';
     - comanda_transferir_itens(itens[], mesa)  passa itens para a comanda da outra mesa
                                                 (abre uma, se a mesa estiver livre);
     - comanda_cancelar_item(item, motivo)      cancela com motivo; comanda paga não.
   Mesa que fica sem comanda aberta volta a 'livre'. Só comanda 'aberto'.
   ROLLBACK: db/comandas/COM_5_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regclass('public.pedidos_itens') is null or to_regclass('public.mesas') is null then
    raise exception 'COM-5: tabelas do salão ausentes. Nada foi alterado.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_itens' and column_name = 'motivo_cancelamento') then
    raise exception 'COM-5: já aplicada. Nada foi alterado.';
  end if;
end $$;

alter table public.pedidos_itens
  add column cancelado_em timestamptz,
  add column cancelado_por uuid,
  add column motivo_cancelamento text,
  add column transferido_de uuid;

-- Mesa sem comanda aberta volta a ficar livre.
create function public._comanda_liberar_mesa(p_mesa uuid) returns void
language sql security definer set search_path = public as $$
  update public.mesas set status = 'livre'
   where id = p_mesa and not exists (select 1 from public.pedidos where mesa_id = p_mesa and status = 'aberto');
$$;

create function public.comanda_trocar_mesa(p_pedido_id uuid, p_mesa_destino uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ped public.pedidos%rowtype; v_dest public.mesas%rowtype; v_status_origem text;
begin
  select * into v_ped from public.pedidos where id = p_pedido_id for update;
  if not found or v_ped.status <> 'aberto' then raise exception 'Comanda não está aberta.'; end if;
  if not public.hefisto_user_can('salao.tables.move', v_ped.unidade_id) then raise exception 'Sem permissão para trocar mesa.'; end if;
  select * into v_dest from public.mesas where id = p_mesa_destino for update;
  if not found or v_dest.unidade_id is distinct from v_ped.unidade_id then raise exception 'Mesa de destino não encontrada.'; end if;
  if v_dest.id = v_ped.mesa_id then raise exception 'A comanda já está nesta mesa.'; end if;
  if exists (select 1 from public.pedidos where mesa_id = v_dest.id and status = 'aberto') then
    raise exception 'A mesa % já tem comanda aberta. Use juntar mesas.', coalesce(v_dest.numero_mesa, v_dest.numero);
  end if;
  select status into v_status_origem from public.mesas where id = v_ped.mesa_id;
  update public.pedidos set mesa_id = v_dest.id, identificacao = coalesce(v_dest.numero_mesa, v_dest.numero) || '.01', updated_at = now() where id = v_ped.id;
  update public.mesas set status = case when v_status_origem = 'fechando' then 'fechando' else 'ocupada' end where id = v_dest.id;
  perform public._comanda_liberar_mesa(v_ped.mesa_id);
  return jsonb_build_object('ok', true, 'pedido_id', v_ped.id, 'mesa_id', v_dest.id);
end $$;

create function public.comanda_juntar(p_origem uuid, p_destino uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_o public.pedidos%rowtype; v_d public.pedidos%rowtype; v_n int;
begin
  if p_origem = p_destino then raise exception 'Escolha outra mesa para juntar.'; end if;
  -- Trava as duas em ordem fixa para não travar com outra junção ao contrário.
  perform 1 from public.pedidos where id in (p_origem, p_destino) order by id for update;
  select * into v_o from public.pedidos where id = p_origem;
  select * into v_d from public.pedidos where id = p_destino;
  if v_o.id is null or v_d.id is null or v_o.status <> 'aberto' or v_d.status <> 'aberto' then raise exception 'As duas comandas precisam estar abertas.'; end if;
  if v_o.unidade_id is distinct from v_d.unidade_id then raise exception 'Comandas de unidades diferentes.'; end if;
  if not public.hefisto_user_can('salao.tables.move', v_o.unidade_id) then raise exception 'Sem permissão para juntar mesas.'; end if;
  update public.pedidos_itens set pedido_id = v_d.id, transferido_de = coalesce(transferido_de, v_o.id), updated_at = now() where pedido_id = v_o.id;
  get diagnostics v_n = row_count;
  update public.pedidos set status = 'transferido', updated_at = now() where id = v_o.id;
  update public.pedidos set updated_at = now() where id = v_d.id;
  perform public._comanda_liberar_mesa(v_o.mesa_id);
  return jsonb_build_object('ok', true, 'pedido_id', v_d.id, 'itens', v_n);
end $$;

create function public.comanda_transferir_itens(p_itens uuid[], p_mesa_destino uuid, p_garcom text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_origem uuid; v_qtd int; v_ped public.pedidos%rowtype; v_dest public.mesas%rowtype; v_destino uuid; v_n int;
begin
  if p_itens is null or cardinality(p_itens) = 0 then raise exception 'Escolha os itens.'; end if;
  select count(distinct pedido_id), min(pedido_id::text)::uuid into v_qtd, v_origem from public.pedidos_itens where id = any(p_itens);
  if v_qtd <> 1 then raise exception 'Os itens precisam ser da mesma comanda.'; end if;
  select * into v_ped from public.pedidos where id = v_origem for update;
  if v_ped.status <> 'aberto' then raise exception 'Comanda não está aberta.'; end if;
  if not public.hefisto_user_can('salao.tables.move', v_ped.unidade_id) then raise exception 'Sem permissão para transferir item.'; end if;
  if exists (select 1 from public.pedidos_itens where id = any(p_itens) and status_kds = 'cancelado') then raise exception 'Item cancelado não pode ser transferido.'; end if;
  select * into v_dest from public.mesas where id = p_mesa_destino for update;
  if not found or v_dest.unidade_id is distinct from v_ped.unidade_id then raise exception 'Mesa de destino não encontrada.'; end if;
  if v_dest.id = v_ped.mesa_id then raise exception 'Escolha outra mesa.'; end if;
  select id into v_destino from public.pedidos where mesa_id = v_dest.id and status = 'aberto' order by created_at limit 1 for update;
  if v_destino is null then
    insert into public.pedidos (unidade_id, mesa_id, status, tipo_pedido, valor_total, garcom_nome, identificacao)
    values (v_ped.unidade_id, v_dest.id, 'aberto', 'salao', 0, coalesce(nullif(btrim(p_garcom), ''), v_ped.garcom_nome), coalesce(v_dest.numero_mesa, v_dest.numero) || '.01')
    returning id into v_destino;
  end if;
  update public.pedidos_itens set pedido_id = v_destino, transferido_de = coalesce(transferido_de, v_origem), updated_at = now() where id = any(p_itens) and pedido_id = v_origem;
  get diagnostics v_n = row_count;
  update public.mesas set status = case when status = 'fechando' then 'fechando' else 'ocupada' end where id = v_dest.id;
  -- Comanda que ficou sem nada para cobrar sai da mesa.
  if not exists (select 1 from public.pedidos_itens where pedido_id = v_origem and status_kds is distinct from 'cancelado') then
    update public.pedidos set status = 'transferido', updated_at = now() where id = v_origem;
    perform public._comanda_liberar_mesa(v_ped.mesa_id);
  end if;
  return jsonb_build_object('ok', true, 'pedido_id', v_destino, 'itens', v_n);
end $$;

create function public.comanda_cancelar_item(p_item_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_item public.pedidos_itens%rowtype; v_ped public.pedidos%rowtype; v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  select * into v_item from public.pedidos_itens where id = p_item_id for update;
  if not found then raise exception 'Item não encontrado.'; end if;
  select * into v_ped from public.pedidos where id = v_item.pedido_id for update;
  if not public.hefisto_user_can('salao.tables.cancel', v_ped.unidade_id) then raise exception 'Sem permissão para cancelar item.'; end if;
  if v_item.status_kds = 'cancelado' then return jsonb_build_object('ok', true, 'repetido', true); end if;
  if v_ped.status <> 'aberto' then raise exception 'A conta desta comanda já foi fechada. Cancele a venda pelo caixa.'; end if;
  if char_length(v_motivo) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  if char_length(v_motivo) > 200 then raise exception 'Motivo longo demais (até 200 letras).'; end if;
  update public.pedidos_itens
     set status_kds = 'cancelado', cancelado_em = now(), cancelado_por = auth.uid(), motivo_cancelamento = v_motivo, updated_at = now()
   where id = p_item_id;
  return jsonb_build_object('ok', true, 'item_id', p_item_id);
end $$;

revoke all on function public._comanda_liberar_mesa(uuid) from public, anon, authenticated;
revoke all on function public.comanda_trocar_mesa(uuid, uuid) from public, anon;
revoke all on function public.comanda_juntar(uuid, uuid) from public, anon;
revoke all on function public.comanda_transferir_itens(uuid[], uuid, text) from public, anon;
revoke all on function public.comanda_cancelar_item(uuid, text) from public, anon;
grant execute on function public.comanda_trocar_mesa(uuid, uuid) to authenticated;
grant execute on function public.comanda_juntar(uuid, uuid) to authenticated;
grant execute on function public.comanda_transferir_itens(uuid[], uuid, text) to authenticated;
grant execute on function public.comanda_cancelar_item(uuid, text) to authenticated;

-- Verificação pós-aplicação (impressão digital).
do $$
begin
  if to_regprocedure('public.comanda_trocar_mesa(uuid, uuid)') is null or to_regprocedure('public.comanda_juntar(uuid, uuid)') is null
     or to_regprocedure('public.comanda_transferir_itens(uuid[], uuid, text)') is null or to_regprocedure('public.comanda_cancelar_item(uuid, text)') is null then
    raise exception 'COM-5: função ausente.';
  end if;
  if has_function_privilege('anon', 'public.comanda_cancelar_item(uuid, text)', 'execute') then raise exception 'COM-5: anon não pode cancelar.'; end if;
  if has_function_privilege('authenticated', 'public._comanda_liberar_mesa(uuid)', 'execute') then raise exception 'COM-5: função interna exposta.'; end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_itens'
       and column_name in ('cancelado_em', 'cancelado_por', 'motivo_cancelamento', 'transferido_de')) <> 4 then
    raise exception 'COM-5: colunas ausentes.';
  end if;
end $$;

commit;
