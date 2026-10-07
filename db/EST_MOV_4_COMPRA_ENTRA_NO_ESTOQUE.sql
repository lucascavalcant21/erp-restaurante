/* ═══════════════════════════════════════════════════════════════════════════
   EST-MOV-4 · COMPRA CONFIRMADA DÁ ENTRADA NO ESTOQUE (fonte única)

   STATUS: PROPOSTA. Rodar só com aprovação do dono, DEPOIS da EST-MOV-1 e da
   F2.4B (as duas já estão em produção). Uma transação; aborta sem mudar nada
   se faltar alguma delas. Pode rodar de novo.

   O QUE MUDA
   - CONFIRMAR A COMPRA (compras_confirmar) passa a fazer, na MESMA transação:
     compra confirmada + ENTRADA NO ESTOQUE de cada item + custo médio +
     histórico + conta a pagar. Ou entra tudo, ou nada.
     · cada item entra no local escolhido na compra; sem local, no único
       estoque em que o produto já está (se estiver em mais de um, ou em
       nenhum, a compra pede o local);
     · a quantidade vai para a unidade do saldo (kg, L, un; garrafa
       fracionada: ml), a validade vira lote (FEFO) e a compra entra FECHADA
       (bebidas: garrafas fechadas);
     · o lançamento no histórico tem motivo "compra", origem "compra", quem
       confirmou (pelo banco), a nota e o fornecedor, e o valor REAL pago
       (item + frete − desconto rateados), não o custo médio;
     · chave "compra:<item>": a mesma compra nunca entra duas vezes.
   - Confirmar exige a permissão estoque.purchases.confirm (a mesma que a
     tela já pede). Antes o banco só conferia a unidade.
   - CANCELAR COMPRA CONFIRMADA (compras_cancelar) agora é só administrador
     autorizado (estoque.security.approve) com o PIN do estoque, como todo
     estorno. Desfaz numa transação só: estoque (estorno ligado à entrada,
     devolvendo das mesmas validades), custo médio e conta a pagar.
     · recusa se parte da compra já saiu do estoque (correção: ajuste
       autorizado) — igual ao estorno de entrada;
     · rascunho continua sendo cancelado sem PIN (estoque.purchases.cancel).
   - Entrada de compra NÃO se estorna pela tela "Entrada e retirada": o
     banco recusa e manda cancelar a compra (senão o estoque voltaria e a
     conta a pagar e o custo médio ficariam).

   NÃO FAZ
   - Não dá entrada nas compras JÁ confirmadas antes desta atualização (elas
     podem ter sido lançadas também pela Entrada; nada é refeito). A
     conferência no fim lista quantas são.
   - Não apaga nem altera nenhum movimento, compra, custo ou conta.
   - Não mexe em RLS, Contas a Receber, DRE, Mesa/KDS/Saipos/iFood/RH.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regprocedure('public._estoque_aplicar(text,uuid,uuid,text,numeric,date,jsonb,numeric)') is null
     or to_regprocedure('public._estoque_conferir_pin(text,text)') is null
     or to_regprocedure('public.estoque_estornar(uuid,text,text,text)') is null
     or to_regprocedure('public.estoque_custo_registrar_entrada(text,uuid,text,numeric,numeric,date,text,uuid)') is null
     or to_regprocedure('public.compras_confirmar(uuid,boolean,date)') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'compras' and column_name = 'data_recebimento')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'estoque_movimentacoes_multi' and column_name = 'chave_idempotencia') then
    raise exception 'EST-MOV-4: falta a EST-MOV-1 ou a F2.4B no banco. Nada foi alterado.';
  end if;
end $$;

-- 1. Entrada de compra só volta pelo cancelamento da compra (estorno com origem "compra").
create or replace function public.estoque_estorno_compra_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.estorno_de_id is not null and new.origem is distinct from 'compra'
     and exists (select 1 from public.estoque_movimentacoes_multi o
                  where o.id = new.estorno_de_id and o.origem = 'compra' and o.detalhe_quantidade ? 'compra_item_id') then
    raise exception 'Entrada de compra não se estorna aqui: cancele a compra em Compras (o estoque, o custo médio e a conta a pagar voltam juntos).';
  end if;
  return new;
end $$;
drop trigger if exists estoque_estorno_compra on public.estoque_movimentacoes_multi;
create trigger estoque_estorno_compra before insert on public.estoque_movimentacoes_multi
  for each row execute function public.estoque_estorno_compra_trg();

-- 2. Confirmar compra: compra + ESTOQUE + custo médio + histórico + conta a pagar (tudo ou nada)
create or replace function public.compras_confirmar(
  p_compra_id uuid, p_gerar_conta_pagar boolean default true, p_data_vencimento date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c        public.compras%rowtype;
  v_user     record;
  v_itens    numeric;
  v_total    numeric;
  v_fator    numeric;
  v_venc     date;
  v_forn     text;
  v_conta    uuid;
  v_data     date;
  v_doc      text;
  r          record;
  v_ins      record;
  v_est      uuid;
  v_n        integer;
  v_fs       numeric;
  v_q        numeric;
  v_valor    numeric;
  v_res      record;
  v_mov      uuid;
  v_entradas integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_c from public.compras where id = p_compra_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_c.unidade_id) then
    raise exception 'Compra não encontrada nesta unidade.';
  end if;
  if v_c.status = 'confirmada' then        -- clique duplo / retry
    return jsonb_build_object('compra_id', v_c.id, 'status', 'confirmada', 'idempotente', true, 'conta_pagar_id', v_c.conta_pagar_id,
      'entradas_estoque', (select count(*) from public.compras_itens where compra_id = v_c.id and movimento_estoque_id is not null));
  end if;
  if v_c.status = 'cancelada' then raise exception 'Compra cancelada não pode ser confirmada.'; end if;
  if not public.hefisto_user_can('estoque.purchases.confirm', v_c.unidade_id) then
    raise exception 'Sem permissão para confirmar compras nesta unidade.';
  end if;
  select * into v_user from public._estoque_usuario();
  if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;
  if not exists (select 1 from public.compras_itens where compra_id = v_c.id) then
    raise exception 'Compra sem itens não pode ser confirmada.';
  end if;
  v_data := coalesce(v_c.data_recebimento, v_c.data_compra);
  if v_c.data_compra > public.fin_hoje() or v_data > public.fin_hoje() then
    raise exception 'A data da compra e a do recebimento não podem ser futuras.';
  end if;
  select coalesce(sum(valor_total), 0) into v_itens from public.compras_itens where compra_id = v_c.id;
  v_total := v_itens + v_c.valor_frete - v_c.valor_desconto;
  if v_total < 0 then raise exception 'O desconto é maior que o valor da compra.'; end if;
  v_fator := case when v_itens > 0 then v_total / v_itens else 1 end;   -- rateio de frete/desconto
  v_venc  := coalesce(p_data_vencimento, v_c.data_vencimento);
  if p_gerar_conta_pagar and v_total > 0 and v_venc is null then
    raise exception 'Informe o vencimento da conta a pagar.';
  end if;
  select nome into v_forn from public.fornecedores where id = v_c.fornecedor_id;
  v_doc := 'Compra' || coalesce(' NF ' || nullif(btrim(v_c.numero_documento), ''), '') || coalesce(' — ' || v_forn, '');

  -- ESTOQUE: antes de a compra virar confirmada (depois, os itens não mudam mais)
  for r in select i.* from public.compras_itens i where i.compra_id = v_c.id order by i.created_at, i.id loop
    select id, nome, unidade_medida, unidade_id, tamanho_embalagem into v_ins from public.insumos where id = r.insumo_id;
    if v_ins.id is null or (v_ins.unidade_id is not null and v_ins.unidade_id <> v_c.unidade_id) then
      raise exception 'Produto da compra não encontrado nesta unidade.';
    end if;
    if public.estoque_unidade_base(v_ins.unidade_medida) <> r.unidade_base then
      raise exception '%: o cadastro está em % e a compra foi lançada em %. Confira o produto e salve a compra de novo.',
        v_ins.nome, coalesce(v_ins.unidade_medida, '—'), r.unidade_base;
    end if;
    v_est := r.estoque_id;
    if v_est is null then
      -- local não informado: o único estoque ativo em que o produto já está
      select (array_agg(ei.estoque_id))[1], count(*) into v_est, v_n
        from public.estoque_itens ei join public.estoques e on e.id = ei.estoque_id
       where ei.insumo_id = r.insumo_id and ei.unidade_id = v_c.unidade_id and coalesce(e.status, 'ativo') = 'ativo';
      if v_n <> 1 then raise exception '%: escolha em qual estoque o produto entra.', v_ins.nome; end if;
    end if;
    perform 1 from public.estoques where id = v_est and unidade_id = v_c.unidade_id and coalesce(status, 'ativo') = 'ativo';
    if not found then raise exception '%: o estoque escolhido não está ativo nesta unidade.', v_ins.nome; end if;

    v_fs := public._estoque_fator_saldo(r.insumo_id);
    v_q := round(r.quantidade_base / public.estoque_fator_base(v_ins.unidade_medida) * v_fs, 3);
    if v_q <= 0 then raise exception '%: quantidade da compra inválida.', v_ins.nome; end if;
    v_valor := round(r.valor_total * v_fator, 2);
    select * into v_res from public._estoque_aplicar(v_c.unidade_id, v_est, r.insumo_id, 'entrada', v_q, r.validade, null,
      floor(v_q / greatest(coalesce(v_ins.tamanho_embalagem, 1), 0.000001)));   -- compra chega fechada

    insert into public.estoque_movimentacoes_multi (
      unidade_id, estoque_id, insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
      usuario_id, usuario_nome, observacao, data_movimento, valor_unitario, valor_total,
      motivo, origem, registrado_por, unidade_medida, quantidade_informada, unidade_informada,
      detalhe_quantidade, validade, lotes, custo_origem, chave_idempotencia)
    values (
      v_c.unidade_id, v_est, r.insumo_id, 'entrada', v_q, v_res.o_saldo_anterior, v_res.o_saldo_posterior,
      v_user.id, v_user.nome, v_doc, now(), round(v_valor / v_q, 6), v_valor,
      'compra', 'compra', auth.uid(), public._estoque_unidade_saldo(r.insumo_id),
      round(r.quantidade_base / public.estoque_fator_base(v_ins.unidade_medida), 3), v_ins.unidade_medida,
      jsonb_build_object('compra_id', v_c.id, 'compra_item_id', r.id, 'embalagens_compra', r.quantidade_embalagens,
                         'conteudo_por_embalagem', r.conteudo_por_embalagem, 'unidade_base', r.unidade_base,
                         'lote', r.lote, 'data_recebimento', v_data, 'valor_item', r.valor_total, 'rateio_frete_desconto', round(v_fator, 6)),
      r.validade, v_res.o_lotes, 'compra', 'compra:' || r.id)
    returning id into v_mov;
    update public.compras_itens set movimento_estoque_id = v_mov, estoque_id = v_est where id = r.id;
    v_entradas := v_entradas + 1;
  end loop;

  update public.compras set status = 'confirmada', data_vencimento = coalesce(data_vencimento, v_venc) where id = v_c.id;

  for r in
    select insumo_id, min(unidade_base) as base, count(distinct unidade_base) as bases,
           sum(quantidade_base) as qtd, sum(valor_total) as valor
      from public.compras_itens where compra_id = v_c.id group by insumo_id
  loop
    if r.bases > 1 then raise exception 'O mesmo produto aparece com unidades diferentes nesta compra.'; end if;
    perform public.estoque_custo_registrar_entrada(v_c.unidade_id, r.insumo_id, r.base, r.qtd, r.valor * v_fator, v_data, 'COMPRA', v_c.id);
  end loop;

  if p_gerar_conta_pagar and v_total > 0 then
    insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status, categoria, categoria_codigo,
         fornecedor_id, documento_numero, competencia, observacao, origem_tipo, origem_id, chave_idempotencia, recorrente)
    values (v_c.unidade_id, v_doc,
         round(v_total, 2), v_venc, 'pendente', 'cmv', 'mercadoria_insumos',
         v_c.fornecedor_id, nullif(btrim(v_c.numero_documento), ''), date_trunc('month', v_c.data_compra)::date,
         'Gerada pela compra de ' || to_char(v_c.data_compra, 'DD/MM/YYYY') || coalesce(' · ' || nullif(btrim(v_c.forma_pagamento), ''), ''),
         'COMPRA', v_c.id, 'compra:' || v_c.id, false)
    returning id into v_conta;
    update public.compras set conta_pagar_id = v_conta where id = v_c.id;
  end if;

  return jsonb_build_object('compra_id', v_c.id, 'status', 'confirmada', 'idempotente', false,
                            'valor_total', round(v_total, 2), 'conta_pagar_id', v_conta, 'entradas_estoque', v_entradas);
end $$;

-- 3. Cancelar compra. Rascunho: com estoque.purchases.cancel. Confirmada: administrador
--    autorizado + PIN; desfaz estoque (estorno), custo médio e conta a pagar juntos.
drop function if exists public.compras_cancelar(uuid, text);
create or replace function public.compras_cancelar(p_compra_id uuid, p_motivo text, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c       public.compras%rowtype;
  v_conta   public.contas_pagar%rowtype;
  v_user    record;
  v_erro    text;
  r         record;
  h         public.estoque_custos_historico%rowtype;
  m         public.estoque_movimentacoes_multi%rowtype;
  v_res     record;
  v_atual   numeric;
  v_estornos integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_c from public.compras where id = p_compra_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_c.unidade_id) then
    raise exception 'Compra não encontrada nesta unidade.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if v_c.status = 'cancelada' then raise exception 'Compra já cancelada.'; end if;
  if not public.hefisto_user_can('estoque.purchases.cancel', v_c.unidade_id) then
    raise exception 'Sem permissão para cancelar compras nesta unidade.';
  end if;

  if v_c.status = 'confirmada' then
    select * into v_user from public._estoque_usuario();
    if v_user.id is null then raise exception 'Seu usuário não está ativo no ERP.'; end if;
    if not public._estoque_pode('autorizar', v_c.unidade_id) then
      raise exception 'Sem permissão: compra confirmada só é cancelada por administrador autorizado, com o PIN do estoque.';
    end if;
    if coalesce(btrim(p_pin), '') = '' then
      raise exception 'Informe o PIN do administrador para cancelar uma compra confirmada.';
    end if;
    -- 1) só desfaz se esta compra for a última movimentação de custo de cada insumo dela
    for r in select distinct insumo_id from public.compras_itens where compra_id = v_c.id loop
      select x.* into h from public.estoque_custos_historico x
       where x.unidade_id = v_c.unidade_id and x.insumo_id = r.insumo_id and x.origem_tipo <> 'ESTORNO_COMPRA'
         and not exists (select 1 from public.compras c2 where x.origem_tipo = 'COMPRA' and c2.id = x.origem_id and c2.status = 'cancelada')
       order by x.seq desc limit 1;
      if not found or h.origem_tipo <> 'COMPRA' or h.origem_id <> v_c.id then
        raise exception 'Há compra ou contagem posterior com um dos produtos desta compra: o custo médio já seguiu adiante. Corrija com um ajuste.';
      end if;
    end loop;
    -- 2) conta a pagar: só sem pagamento
    if v_c.conta_pagar_id is not null then
      select * into v_conta from public.contas_pagar where id = v_c.conta_pagar_id for update;
      if found and v_conta.status <> 'cancelado'
         and (lower(v_conta.status) in ('pago','paga','parcial')
              or exists (select 1 from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null)) then
        raise exception 'A conta a pagar desta compra já tem pagamento: estorne os pagamentos antes.';
      end if;
    end if;
    -- 3) estoque: o que entrou ainda precisa estar lá (por local e produto)
    for r in
      select mv.estoque_id, mv.insumo_id, sum(mv.quantidade) as qtd, max(mv.unidade_medida) as un,
             max(i.nome) as nome, max(e.nome) as local
        from public.compras_itens ci
        join public.estoque_movimentacoes_multi mv on mv.id = ci.movimento_estoque_id
        join public.insumos i on i.id = mv.insumo_id
        join public.estoques e on e.id = mv.estoque_id
       where ci.compra_id = v_c.id
         and not exists (select 1 from public.estoque_movimentacoes_multi x where x.estorno_de_id = mv.id)
       group by mv.estoque_id, mv.insumo_id
    loop
      select quantidade_atual into v_atual from public.estoque_itens where estoque_id = r.estoque_id and insumo_id = r.insumo_id;
      if coalesce(v_atual, 0) + 0.0005 < r.qtd then
        raise exception 'Não dá para cancelar: parte da compra já saiu do estoque (% em %: saldo % %, a compra deu entrada de % %). Corrija com um ajuste autorizado.',
          r.nome, r.local, public.estoque_fmt_qtd(coalesce(v_atual, 0)), coalesce(r.un, ''), public.estoque_fmt_qtd(r.qtd), coalesce(r.un, '');
      end if;
    end loop;
    -- 4) PIN, depois de tudo conferido (tentativa errada fica gravada)
    v_erro := public._estoque_conferir_pin(v_c.unidade_id, p_pin);
    perform public._estoque_registrar_autorizacao(v_c.unidade_id, 'cancelar_compra', v_c.id, v_user.id, v_user.nome, v_erro, btrim(p_motivo));
    if v_erro is not null then return jsonb_build_object('ok', false, 'pin', true, 'erro', v_erro); end if;

    -- 5) estoque: estorno de cada entrada, nas mesmas validades
    for m in
      select mv.* from public.compras_itens ci
        join public.estoque_movimentacoes_multi mv on mv.id = ci.movimento_estoque_id
       where ci.compra_id = v_c.id
         and not exists (select 1 from public.estoque_movimentacoes_multi x where x.estorno_de_id = mv.id)
       order by ci.created_at, ci.id
    loop
      select * into v_res from public._estoque_aplicar(m.unidade_id, m.estoque_id, m.insumo_id, 'saida', m.quantidade, null,
        coalesce(m.lotes, case when m.validade is not null
                               then jsonb_build_array(jsonb_build_object('validade', m.validade, 'quantidade', m.quantidade)) end),
        0);
      insert into public.estoque_movimentacoes_multi (
        unidade_id, estoque_id, insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
        usuario_id, usuario_nome, observacao, data_movimento, valor_unitario, valor_total,
        motivo, justificativa, origem, estorno_de_id, autorizado_por, autorizado_por_nome, registrado_por,
        unidade_medida, detalhe_quantidade, lotes, custo_origem, chave_idempotencia)
      values (
        m.unidade_id, m.estoque_id, m.insumo_id, 'saida', m.quantidade, v_res.o_saldo_anterior, v_res.o_saldo_posterior,
        v_user.id, v_user.nome, 'Cancelamento: ' || coalesce(m.observacao, 'compra'), now(), m.valor_unitario, m.valor_total,
        'estorno', 'Compra cancelada: ' || btrim(p_motivo), 'compra', m.id, v_user.id, v_user.nome, auth.uid(),
        m.unidade_medida, jsonb_build_object('compra_id', v_c.id, 'compra_item_id', m.detalhe_quantidade ->> 'compra_item_id', 'cancelamento', true),
        v_res.o_lotes, 'compra', 'compra-cancelada:' || m.id);
      v_estornos := v_estornos + 1;
    end loop;

    -- 6) conta a pagar
    if v_c.conta_pagar_id is not null and v_conta.id is not null and v_conta.status <> 'cancelado' then
      update public.contas_pagar set status = 'cancelado', cancelado_em = now(),
             motivo_cancelamento = 'Compra cancelada: ' || btrim(p_motivo)
       where id = v_conta.id;
    end if;
    -- 7) custo volta ao anterior, com histórico
    for r in select distinct insumo_id from public.compras_itens where compra_id = v_c.id loop
      select x.* into h from public.estoque_custos_historico x
       where x.unidade_id = v_c.unidade_id and x.insumo_id = r.insumo_id and x.origem_tipo = 'COMPRA' and x.origem_id = v_c.id
       order by x.seq desc limit 1;
      insert into public.estoque_custos_historico (unidade_id, insumo_id, data_referencia, origem_tipo, origem_id, unidade_base,
           saldo_anterior, custo_medio_anterior, quantidade, valor, custo_entrada, saldo_novo, custo_medio_novo, criado_por)
      values (v_c.unidade_id, r.insumo_id, public.fin_hoje(), 'ESTORNO_COMPRA', v_c.id, h.unidade_base,
           h.saldo_novo, h.custo_medio_novo, -h.quantidade, -h.valor, h.custo_entrada, h.saldo_anterior, h.custo_medio_anterior, auth.uid());
      if h.custo_medio_anterior is null then
        delete from public.estoque_custos where unidade_id = v_c.unidade_id and insumo_id = r.insumo_id;
      else
        update public.estoque_custos
           set custo_medio_base = h.custo_medio_anterior, saldo_referencia = h.saldo_anterior, atualizado_em = now(),
               origem_tipo = 'AJUSTE', origem_id = v_c.id
         where unidade_id = v_c.unidade_id and insumo_id = r.insumo_id;
      end if;
    end loop;
  end if;

  update public.compras set status = 'cancelada', cancelado_em = now(), motivo_cancelamento = btrim(p_motivo) where id = v_c.id;
  return jsonb_build_object('ok', true, 'compra_id', v_c.id, 'status', 'cancelada', 'estornos_estoque', v_estornos);
end $$;

-- 4. Permissões: só as duas RPCs são chamáveis pelo app
revoke all on function public.estoque_estorno_compra_trg() from public, anon, authenticated;
revoke all on function public.compras_confirmar(uuid,boolean,date) from public, anon;
revoke all on function public.compras_cancelar(uuid,text,text) from public, anon;
grant execute on function public.compras_confirmar(uuid,boolean,date) to authenticated;
grant execute on function public.compras_cancelar(uuid,text,text) to authenticated;

commit;


/* ── CONFERÊNCIA (só leitura) ─────────────────────────────────────────────────
select 'função' as o_que, string_agg(p.oid::regprocedure::text, ' · ' order by p.oid::regprocedure::text) as resultado
  from pg_proc p where p.proname in ('compras_confirmar', 'compras_cancelar') and p.pronamespace = 'public'::regnamespace
union all select 'trigger', string_agg(tgname, ' · ') from pg_trigger where tgname = 'estoque_estorno_compra'
union all select 'anon executa compras_cancelar', has_function_privilege('anon', 'public.compras_cancelar(uuid,text,text)', 'execute')::text
union all select 'compras confirmadas ANTES (sem entrada automática)', count(*)::text
  from public.compras c where c.status = 'confirmada'
   and not exists (select 1 from public.compras_itens ci where ci.compra_id = c.id and ci.movimento_estoque_id is not null)
union all select 'compras confirmadas com entrada no estoque', count(*)::text
  from public.compras c where c.status = 'confirmada'
   and exists (select 1 from public.compras_itens ci where ci.compra_id = c.id and ci.movimento_estoque_id is not null)
order by 1;
   ──────────────────────────────────────────────────────────────────────────── */


/* ── ROLLBACK (só se o dono pedir; os lançamentos feitos ficam no histórico) ──
   1. drop trigger if exists estoque_estorno_compra on public.estoque_movimentacoes_multi;
      drop function if exists public.estoque_estorno_compra_trg();
   2. drop function if exists public.compras_cancelar(uuid, text, text);
   3. rodar de novo as seções 7, 8 e 9 de db/F2_4B_COMPRAS_CUSTO_MEDIO.sql
      (compras_confirmar e compras_cancelar como eram).
   ──────────────────────────────────────────────────────────────────────────── */
