/* ═══════════════════════════════════════════════════════════════════════════
   F2.4B · COMPRAS → CUSTO MÉDIO → CONTA A PAGAR (sobre a fundação F2.1)

   STATUS: PROPOSTA. Rodar só com aprovação do dono. Uma transação; aborta
   sem mudar nada se a F2.1 não estiver completa. Rollback no fim do arquivo.

   POR QUE PRECISA DE BANCO
   - O custo médio (estoque_custos) é só leitura para o app, de propósito:
     quem escreve é a confirmação da compra, no banco, numa transação só
     (compra confirmada + custo médio + histórico + conta a pagar).
   - A F2.1 não tinha: data de recebimento / forma de pagamento / vencimento
     na compra, pedido × recebido no item, histórico do custo médio, e a
     ligação "inventário fechado → custo".

   REGRAS
   - COMPRA ≠ CMV. A compra vira ESTOQUE (custo médio) e, se escolhido, CONTA A
     PAGAR com categoria nova `mercadoria_insumos` (natureza mercadoria: não é
     despesa). O texto antigo da categoria é "cmv", o que a DRE antiga já ignora
     nas despesas (não conta duas vezes).
   - Custo médio ponderado com a fórmula ÚNICA já existente
     estoque_custo_medio_novo (F2.1):
       (saldo × custo médio + valor da entrada) / (saldo + quantidade)
       ex.: 20 kg a R$ 45/kg + 10 kg por R$ 500 → R$ 46,6667/kg.
   - Frete e desconto da nota entram no custo, rateados pelo valor dos itens.
   - SALDO DE REFERÊNCIA (o "saldo" da fórmula) é periódico: o inventário
     FECHADO da unidade inteira zera a referência na quantidade contada (mais
     as compras recebidas depois da data da contagem); cada compra soma. O
     consumo entre contagens não é estimado (nada inventado).
   - Inventário fechado sem custo médio anterior inicializa o custo com o
     custo congelado na contagem (origem CONTAGEM).
   - Unidade base (g/ml/un) por insumo: entrada em unidade diferente da do
     custo é recusada.
   - Cancelar compra confirmada: só se for a última movimentação de custo de
     cada insumo dela e a conta a pagar não tiver pagamento; o custo volta ao
     anterior, com histórico (nada é apagado).

   NÃO FAZ: não mexe no saldo do Controle de Estoque (estoque_itens) nem nas
   entradas antigas; não altera dados existentes; não mexe em RLS de outras
   tabelas, Contas a Receber, DRE, Mesa/KDS/Saipos/iFood.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.compras') is null or to_regclass('public.compras_itens') is null
     or to_regclass('public.estoque_custos') is null or to_regclass('public.vw_compras') is null
     or to_regclass('public.estoque_contagens_itens') is null
     or to_regprocedure('public.estoque_custo_medio_novo(numeric,numeric,numeric,numeric)') is null
     or to_regprocedure('public.fin_pode_acessar_unidade(text)') is null
     or to_regprocedure('public.fin_hoje()') is null
     or not exists (select 1 from public.fin_categorias where codigo = 'mercadoria_insumos') then
    raise exception 'F2.4B: a fundação F2.1 não está completa. Nada foi alterado.';
  end if;
end $$;

-- 1. Compra: recebimento, pagamento, vencimento
alter table public.compras add column if not exists data_recebimento date;
alter table public.compras add column if not exists forma_pagamento  text;
alter table public.compras add column if not exists data_vencimento  date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compras_recebimento_f24b') then
    alter table public.compras add constraint compras_recebimento_f24b
      check (data_recebimento is null or data_recebimento >= data_compra);
  end if;
end $$;

-- 2. Item: pedido × recebido (quantidade_embalagens / valor_total = o RECEBIDO e cobrado)
alter table public.compras_itens add column if not exists quantidade_pedida_embalagens numeric(14,3);
alter table public.compras_itens add column if not exists valor_pedido                 numeric(14,2);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compras_itens_pedido_f24b') then
    alter table public.compras_itens add constraint compras_itens_pedido_f24b
      check ((quantidade_pedida_embalagens is null or quantidade_pedida_embalagens > 0) and (valor_pedido is null or valor_pedido >= 0));
  end if;
end $$;
-- rascunho pode tirar item (o trigger da F2.1 já recusa em compra confirmada/cancelada)
grant delete on public.compras_itens to authenticated;

-- 3. Custo médio: unidade base de cada insumo
alter table public.estoque_custos add column if not exists unidade_base text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estoque_custos_base_f24b') then
    alter table public.estoque_custos add constraint estoque_custos_base_f24b check (unidade_base is null or unidade_base in ('g','ml','un'));
  end if;
end $$;

-- 4. Histórico do custo médio (cada compra, contagem e estorno)
create table if not exists public.estoque_custos_historico (
  id                   uuid primary key default gen_random_uuid(),
  seq                  bigint generated always as identity,
  unidade_id           text not null references public.unidades(id),
  insumo_id            uuid not null references public.insumos(id),
  data_referencia      date not null,
  origem_tipo          text not null check (origem_tipo in ('COMPRA','CONTAGEM','ESTORNO_COMPRA','AJUSTE')),
  origem_id            uuid,
  unidade_base         text not null check (unidade_base in ('g','ml','un')),
  saldo_anterior       numeric(18,3),
  custo_medio_anterior numeric(18,6),
  quantidade           numeric(18,3),
  valor                numeric(14,2),
  custo_entrada        numeric(18,6),
  saldo_novo           numeric(18,3),
  custo_medio_novo     numeric(18,6),
  created_at           timestamptz not null default now(),
  criado_por           uuid
);
comment on table public.estoque_custos_historico is 'hefisto:f2.4b — histórico do custo médio por insumo (compra, contagem, estorno)';
create index if not exists estoque_custos_hist_insumo on public.estoque_custos_historico (unidade_id, insumo_id, seq);
alter table public.estoque_custos_historico enable row level security;
revoke all on public.estoque_custos_historico from public, anon, authenticated;
grant select on public.estoque_custos_historico to authenticated;
drop policy if exists estoque_custos_historico_unidade on public.estoque_custos_historico;
create policy estoque_custos_historico_unidade on public.estoque_custos_historico for select to authenticated
  using (public.pode_ver_todas() or unidade_id = public.auth_unidade_id());

-- 5. Interna: aplica uma entrada (compra) no custo médio
create or replace function public.estoque_custo_registrar_entrada(
  p_unidade_id text, p_insumo_id uuid, p_unidade_base text, p_quantidade numeric, p_valor numeric,
  p_data date, p_origem_tipo text, p_origem_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_atual public.estoque_custos%rowtype;
  v_saldo numeric;
  v_custo numeric;
  v_novo  numeric;
  v_existe boolean;
begin
  select * into v_atual from public.estoque_custos where unidade_id = p_unidade_id and insumo_id = p_insumo_id for update;
  v_existe := found;                       -- FOUND muda a cada comando: guarda o resultado da busca
  if v_existe and v_atual.unidade_base is not null and v_atual.unidade_base <> p_unidade_base then
    raise exception 'Unidade incompatível no custo do insumo %: o custo está em %, a entrada em %.', p_insumo_id, v_atual.unidade_base, p_unidade_base;
  end if;
  v_saldo := case when v_existe then greatest(coalesce(v_atual.saldo_referencia, 0), 0) else 0 end;
  v_custo := case when v_existe then v_atual.custo_medio_base end;
  v_novo  := public.estoque_custo_medio_novo(v_saldo, v_custo, p_quantidade, p_valor);
  insert into public.estoque_custos_historico (unidade_id, insumo_id, data_referencia, origem_tipo, origem_id, unidade_base,
       saldo_anterior, custo_medio_anterior, quantidade, valor, custo_entrada, saldo_novo, custo_medio_novo, criado_por)
  values (p_unidade_id, p_insumo_id, p_data, p_origem_tipo, p_origem_id, p_unidade_base,
       case when v_existe then v_atual.saldo_referencia end, v_custo, p_quantidade, round(p_valor, 2), round(p_valor / p_quantidade, 6),
       v_saldo + p_quantidade, v_novo, auth.uid());
  insert into public.estoque_custos (unidade_id, insumo_id, custo_medio_base, saldo_referencia, atualizado_em, origem_tipo, origem_id, unidade_base)
  values (p_unidade_id, p_insumo_id, v_novo, v_saldo + p_quantidade, now(), p_origem_tipo, p_origem_id, p_unidade_base)
  on conflict (unidade_id, insumo_id) do update
     set custo_medio_base = excluded.custo_medio_base, saldo_referencia = excluded.saldo_referencia, atualizado_em = now(),
         origem_tipo = excluded.origem_tipo, origem_id = excluded.origem_id, unidade_base = excluded.unidade_base;
  return v_novo;
end $$;

-- 6. Interna: inventário FECHADO da unidade inteira → saldo de referência (e custo inicial)
create or replace function public.estoque_custo_aplicar_contagem(p_contagem_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_c public.estoque_contagens%rowtype;
  r record;
  v_atual public.estoque_custos%rowtype;
  v_saldo numeric;
  v_existe boolean;
  n integer := 0;
begin
  select * into v_c from public.estoque_contagens where id = p_contagem_id;
  if not found or v_c.status <> 'fechada' or v_c.estoque_id is not null then return 0; end if;
  for r in
    select i.insumo_id, min(i.unidade_base) as base, count(distinct i.unidade_base) as bases,
           sum(i.quantidade_contada) as qtd,
           case when sum(i.quantidade_contada) > 0
                then sum(i.quantidade_contada * i.custo_unitario) / sum(i.quantidade_contada)
                else max(i.custo_unitario) end as custo
      from public.estoque_contagens_itens i
     where i.contagem_id = v_c.id and i.custo_unitario is not null
     group by i.insumo_id
  loop
    continue when r.bases > 1;                                  -- unidades misturadas: não mexe
    -- compras recebidas DEPOIS da data da contagem continuam no saldo
    v_saldo := r.qtd + coalesce((
      select sum(ci.quantidade_base) from public.compras_itens ci join public.compras c on c.id = ci.compra_id
       where c.unidade_id = v_c.unidade_id and ci.insumo_id = r.insumo_id and c.status = 'confirmada'
         and ci.unidade_base = r.base and coalesce(c.data_recebimento, c.data_compra) > v_c.data_referencia), 0);
    select * into v_atual from public.estoque_custos where unidade_id = v_c.unidade_id and insumo_id = r.insumo_id for update;
    v_existe := found;
    if v_existe and v_atual.unidade_base is not null and v_atual.unidade_base <> r.base then
      continue;                                                 -- unidade diferente da do custo: não mexe
    end if;
    insert into public.estoque_custos_historico (unidade_id, insumo_id, data_referencia, origem_tipo, origem_id, unidade_base,
         saldo_anterior, custo_medio_anterior, quantidade, valor, custo_entrada, saldo_novo, custo_medio_novo, criado_por)
    values (v_c.unidade_id, r.insumo_id, v_c.data_referencia, 'CONTAGEM', v_c.id, r.base,
         case when v_existe then v_atual.saldo_referencia end, case when v_existe then v_atual.custo_medio_base end,
         r.qtd, null, round(r.custo, 6), v_saldo, case when v_existe then v_atual.custo_medio_base else round(r.custo, 6) end, auth.uid());
    if v_existe then
      update public.estoque_custos set saldo_referencia = v_saldo, atualizado_em = now(), origem_tipo = 'CONTAGEM', origem_id = v_c.id,
             unidade_base = r.base
       where unidade_id = v_c.unidade_id and insumo_id = r.insumo_id;
    else
      insert into public.estoque_custos (unidade_id, insumo_id, custo_medio_base, saldo_referencia, atualizado_em, origem_tipo, origem_id, unidade_base)
      values (v_c.unidade_id, r.insumo_id, round(r.custo, 6), v_saldo, now(), 'CONTAGEM', v_c.id, r.base);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.estoque_contagem_custos_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'fechada' and old.status is distinct from 'fechada' then
    perform public.estoque_custo_aplicar_contagem(new.id);
  end if;
  return new;
end $$;
create or replace trigger estoque_contagens_custos_f24b after update on public.estoque_contagens
  for each row execute function public.estoque_contagem_custos_trg();

-- 7. RPC: confirmar compra (compra + custo médio + histórico + conta a pagar, tudo ou nada)
create or replace function public.compras_confirmar(
  p_compra_id uuid, p_gerar_conta_pagar boolean default true, p_data_vencimento date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c       public.compras%rowtype;
  v_itens   numeric;
  v_total   numeric;
  v_fator   numeric;
  v_venc    date;
  v_forn    text;
  v_conta   uuid;
  v_data    date;
  r record;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_c from public.compras where id = p_compra_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_c.unidade_id) then
    raise exception 'Compra não encontrada nesta unidade.';
  end if;
  if v_c.status = 'confirmada' then        -- clique duplo / retry
    return jsonb_build_object('compra_id', v_c.id, 'status', 'confirmada', 'idempotente', true, 'conta_pagar_id', v_c.conta_pagar_id);
  end if;
  if v_c.status = 'cancelada' then raise exception 'Compra cancelada não pode ser confirmada.'; end if;
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
    select nome into v_forn from public.fornecedores where id = v_c.fornecedor_id;
    insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status, categoria, categoria_codigo,
         fornecedor_id, documento_numero, competencia, observacao, origem_tipo, origem_id, chave_idempotencia, recorrente)
    values (v_c.unidade_id,
         'Compra' || coalesce(' NF ' || nullif(btrim(v_c.numero_documento), ''), '') || coalesce(' — ' || v_forn, ''),
         round(v_total, 2), v_venc, 'pendente', 'cmv', 'mercadoria_insumos',
         v_c.fornecedor_id, nullif(btrim(v_c.numero_documento), ''), date_trunc('month', v_c.data_compra)::date,
         'Gerada pela compra de ' || to_char(v_c.data_compra, 'DD/MM/YYYY') || coalesce(' · ' || nullif(btrim(v_c.forma_pagamento), ''), ''),
         'COMPRA', v_c.id, 'compra:' || v_c.id, false)
    returning id into v_conta;
    update public.compras set conta_pagar_id = v_conta where id = v_c.id;
  end if;

  return jsonb_build_object('compra_id', v_c.id, 'status', 'confirmada', 'idempotente', false,
                            'valor_total', round(v_total, 2), 'conta_pagar_id', v_conta);
end $$;

-- 8. RPC: cancelar compra (rascunho: simples; confirmada: desfaz custo e conta, com histórico)
create or replace function public.compras_cancelar(p_compra_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c public.compras%rowtype;
  v_conta public.contas_pagar%rowtype;
  r record;
  h public.estoque_custos_historico%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_c from public.compras where id = p_compra_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_c.unidade_id) then
    raise exception 'Compra não encontrada nesta unidade.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if v_c.status = 'cancelada' then raise exception 'Compra já cancelada.'; end if;

  if v_c.status = 'confirmada' then
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
      if found and v_conta.status <> 'cancelado' then
        if lower(v_conta.status) in ('pago','paga','parcial')
           or exists (select 1 from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null) then
          raise exception 'A conta a pagar desta compra já tem pagamento: estorne os pagamentos antes.';
        end if;
        update public.contas_pagar set status = 'cancelado', cancelado_em = now(),
               motivo_cancelamento = 'Compra cancelada: ' || btrim(p_motivo)
         where id = v_conta.id;
      end if;
    end if;
    -- 3) custo volta ao anterior, com histórico
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
  return jsonb_build_object('compra_id', v_c.id, 'status', 'cancelada');
end $$;

-- 9. Permissões das funções: só as duas RPCs são chamáveis pelo app
revoke all on function public.estoque_custo_registrar_entrada(text,uuid,text,numeric,numeric,date,text,uuid) from public, anon, authenticated;
revoke all on function public.estoque_custo_aplicar_contagem(uuid) from public, anon, authenticated;
revoke all on function public.estoque_contagem_custos_trg() from public, anon, authenticated;
revoke all on function public.compras_confirmar(uuid,boolean,date) from public, anon;
revoke all on function public.compras_cancelar(uuid,text) from public, anon;
grant execute on function public.compras_confirmar(uuid,boolean,date) to authenticated;
grant execute on function public.compras_cancelar(uuid,text) to authenticated;

-- 10. Inventários já fechados (da unidade inteira) inicializam o custo, do mais antigo ao mais novo
do $$
declare c record;
begin
  for c in select id from public.estoque_contagens where status = 'fechada' and estoque_id is null
            order by data_referencia, fechada_em loop
    perform public.estoque_custo_aplicar_contagem(c.id);
  end loop;
end $$;

commit;


/* ── CONFERÊNCIA (só leitura) ─────────────────────────────────────────────────
select 'coluna' t, table_name || '.' || column_name i from information_schema.columns
 where table_schema = 'public' and ((table_name = 'compras' and column_name in ('data_recebimento','forma_pagamento','data_vencimento'))
    or (table_name = 'compras_itens' and column_name in ('quantidade_pedida_embalagens','valor_pedido'))
    or (table_name = 'estoque_custos' and column_name = 'unidade_base'))
union all select 'função', proname from pg_proc where proname in ('compras_confirmar','compras_cancelar','estoque_custo_registrar_entrada','estoque_custo_aplicar_contagem')
union all select 'trigger', tgname from pg_trigger where tgname = 'estoque_contagens_custos_f24b'
union all select 'custos', count(*)::text from public.estoque_custos
order by 1, 2;
   ────────────────────────────────────────────────────────────────────────── */


/* ── ROLLBACK (volta à estrutura da F2.1; o que foi lançado por compras fica
   como está: contas a pagar geradas continuam e devem ser canceladas na tela,
   se for o caso. O custo médio calculado é apagado — é recalculável.) ───────
begin;
drop trigger if exists estoque_contagens_custos_f24b on public.estoque_contagens;
drop function if exists public.compras_confirmar(uuid,boolean,date);
drop function if exists public.compras_cancelar(uuid,text);
drop function if exists public.estoque_contagem_custos_trg();
drop function if exists public.estoque_custo_aplicar_contagem(uuid);
drop function if exists public.estoque_custo_registrar_entrada(text,uuid,text,numeric,numeric,date,text,uuid);
drop table if exists public.estoque_custos_historico;
delete from public.estoque_custos;
alter table public.estoque_custos drop constraint if exists estoque_custos_base_f24b;
alter table public.estoque_custos drop column if exists unidade_base;
revoke delete on public.compras_itens from authenticated;
alter table public.compras_itens drop constraint if exists compras_itens_pedido_f24b;
alter table public.compras_itens drop column if exists quantidade_pedida_embalagens;
alter table public.compras_itens drop column if exists valor_pedido;
alter table public.compras drop constraint if exists compras_recebimento_f24b;
alter table public.compras drop column if exists data_recebimento;
alter table public.compras drop column if exists forma_pagamento;
alter table public.compras drop column if exists data_vencimento;
commit;
   ────────────────────────────────────────────────────────────────────────── */
