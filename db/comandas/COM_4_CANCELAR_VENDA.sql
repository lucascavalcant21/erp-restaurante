/* COM-4: cancelar a venda de uma comanda (07/11/2026).

   Por quê: depois de "Receber", não havia como desfazer uma venda lançada
   errado (forma de pagamento trocada, mesa errada, cliente desistiu).

   ADITIVA: três colunas em vendas (quem cancelou, quando e por quê) e a função
   venda_cancelar. Nada é apagado: a venda fica com status 'cancelada' e o
   histórico continua no banco. Numa transação só:
     - confere a permissão salao.sector.cancel na unidade da venda;
     - exige motivo;
     - recusa se o caixa da venda já foi fechado (o turno já foi conferido);
     - recusa se alguma parte do cartão ou do Pix já foi conferida como recebida
       (aí o estorno é financeiro, pelo Financeiro);
     - cancela as contas a receber da venda que ainda estão previstas;
     - soma o valor em "cancelamentos" no faturamento do dia da venda;
     - marca a venda como cancelada e a comanda como cancelada.
   O caixa já ignora vendas canceladas (fetchResumoCaixa). A devolução ao
   estoque é opcional e feita pela tela, pelo estoque_movimentar.
   Só vale para vendas de comanda (vendas.pedido_id), que são as que entram no
   faturamento do dia pelo comanda_fechar.
   ROLLBACK: db/comandas/COM_4_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regprocedure('public.comanda_fechar(uuid, uuid, jsonb, numeric, numeric, numeric, text)') is null
     or to_regclass('public.venda_pagamentos') is null then
    raise exception 'COM-4: aplique a COM-3 antes. Nada foi alterado.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'vendas' and column_name = 'cancelada_em') then
    raise exception 'COM-4: já aplicada. Nada foi alterado.';
  end if;
end $$;

alter table public.vendas
  add column cancelada_em timestamptz,
  add column cancelada_por uuid,
  add column motivo_cancelamento text;

create function public.venda_cancelar(p_venda_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_venda public.vendas%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_dia date;
  v_valor numeric(14,2);
  v_contas int;
  v_dinheiro numeric(14,2);
begin
  select * into v_venda from public.vendas where id = p_venda_id for update;
  if not found then raise exception 'Venda não encontrada.'; end if;
  if not public.hefisto_user_can('salao.sector.cancel', v_venda.unidade_id) then
    raise exception 'Sem permissão para cancelar vendas nesta unidade.';
  end if;

  -- Segundo toque no botão: nada muda.
  if v_venda.status = 'cancelada' then
    return jsonb_build_object('ok', true, 'venda_id', p_venda_id, 'repetido', true);
  end if;
  if v_venda.pedido_id is null then
    raise exception 'Só vendas de comanda podem ser canceladas aqui.';
  end if;
  if char_length(v_motivo) < 3 then raise exception 'Informe o motivo do cancelamento.'; end if;
  if char_length(v_motivo) > 300 then raise exception 'Motivo longo demais (até 300 letras).'; end if;

  if v_venda.caixa_id is not null and not exists (select 1 from public.pdv_caixas where id = v_venda.caixa_id and status = 'aberto') then
    raise exception 'O caixa desta venda já foi fechado. O estorno precisa ser feito pelo Financeiro.';
  end if;
  if exists (select 1 from public.fin_contas_receber where venda_id = p_venda_id and status in ('recebido', 'parcial')) then
    raise exception 'Parte do pagamento já foi conferida como recebida. O estorno precisa ser feito pelo Financeiro.';
  end if;

  update public.fin_contas_receber
     set status = 'cancelado', cancelado_em = now(), motivo_cancelamento = 'Venda cancelada: ' || v_motivo,
         updated_at = now(), atualizado_por = auth.uid()
   where venda_id = p_venda_id and status = 'previsto';
  get diagnostics v_contas = row_count;

  -- O comanda_fechar somou subtotal + acréscimo em vendas_brutas e o desconto em descontos.
  -- Cancelar = tirar o que sobrou disso (os 10% nunca entraram).
  v_dia := (v_venda.created_at at time zone 'America/Sao_Paulo')::date;
  v_valor := greatest(round(coalesce(v_venda.subtotal, 0) + coalesce(v_venda.acrescimo, 0) - coalesce(v_venda.desconto, 0), 2), 0);
  if v_valor > 0 then
    update public.fin_faturamento_diario
       set cancelamentos = cancelamentos + v_valor, updated_at = now(), atualizado_por = auth.uid()
     where unidade_id = v_venda.unidade_id and data = v_dia;
  end if;

  select coalesce(sum(valor), 0) into v_dinheiro from public.venda_pagamentos where venda_id = p_venda_id and forma = 'dinheiro';

  update public.vendas
     set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), motivo_cancelamento = v_motivo
   where id = p_venda_id;
  update public.pedidos set status = 'cancelado', updated_at = now() where id = v_venda.pedido_id;

  return jsonb_build_object('ok', true, 'venda_id', p_venda_id, 'total', v_venda.total,
    'faturamento_cancelado', v_valor, 'contas_canceladas', v_contas, 'devolver_em_dinheiro', v_dinheiro);
end $$;

revoke all on function public.venda_cancelar(uuid, text) from public, anon;
grant execute on function public.venda_cancelar(uuid, text) to authenticated;

-- Verificação pós-aplicação (impressão digital).
do $$
begin
  if to_regprocedure('public.venda_cancelar(uuid, text)') is null then raise exception 'COM-4: função ausente.'; end if;
  if has_function_privilege('anon', 'public.venda_cancelar(uuid, text)', 'execute') then raise exception 'COM-4: anon não pode cancelar.'; end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'vendas'
       and column_name in ('cancelada_em', 'cancelada_por', 'motivo_cancelamento')) <> 3 then
    raise exception 'COM-4: colunas ausentes.';
  end if;
end $$;

commit;
