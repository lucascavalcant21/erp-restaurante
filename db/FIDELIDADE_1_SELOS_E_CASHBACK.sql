/* ═══════════════════════════════════════════════════════════════════════════
   FIDELIDADE-1 · CARTÕES DE SELO POR PRODUTO E CASHBACK

   STATUS: NÃO APLICADA. Aguarda aprovação do dono (APR-014 em
   docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md). Testada no PGlite
   (app/lib/fidelidade-banco.test.mjs).

   O QUE O DONO PEDIU (18/10/2026): cartões de selo digitais para produtos
   do cardápio (café, hambúrguer, drink…), vários ao mesmo tempo, com o
   número de selos escolhido por ele; cashback que só vale na próxima
   visita/pedido. As regras do dono ficam em config_sistema.params.fidelidade
   (gravadas pelo painel); este SQL guarda os SALDOS.

   PROBLEMA QUE NÃO PODE ACONTECER: selo ou cashback por pedido que não foi
   pago (bastaria mandar pedidos falsos pelo cardápio para ganhar prêmio).
   Por isso quem dá selo e cashback é o BANCO, quando o pedido vira
   pago/entregue/fechado — nunca o navegador, nunca o envio do pedido.

   FAZ (uma transação; só aditiva — não altera nenhuma linha existente):
     1. tabela fidelidade_movimentos: livro de lançamentos (selo, resgate,
        estorno, cashback, uso, ajuste, vencimento). Saldo = soma do livro.
        Não aceita UPDATE, DELETE nem TRUNCATE: corrige-se lançando ajuste.
     2. RLS: só lê quem tem clientes.loyalty.view na unidade; ninguém grava
        direto (sem policy de escrita e sem grant): só pelas funções abaixo.
     3. trigger AFTER em pedidos (insert / update de status):
          · pedido concluído (pago, entregue, fechado, finalizado,
            concluido) com telefone → selos dos cartões e cashback;
          · pedido cancelado/recusado → estorno do que ele deu e devolução
            do cashback usado nele.
        Erro da fidelidade NUNCA trava o pedido (vira WARNING no log).
        Idempotente: o mesmo pedido não rende duas vezes (índice único).
     4. funções da equipe (checam permissão no banco, hefisto_user_can):
          · fidelidade_resgatar_selos  (clientes.loyalty.confirm)
          · fidelidade_usar_cashback   (clientes.loyalty.confirm)
          · fidelidade_lancar          (clientes.loyalty.edit; ajuste ou
            selo de compra no balcão, com motivo obrigatório)
     5. fidelidade_reservar_cashback: só o servidor (service_role) chama,
        quando o cliente usa o cashback num pedido do cardápio; confere o
        telefone do pedido e o saldo sob trava.
   NÃO FAZ: não mexe em pedidos, pedidos_itens, clientes nem config_sistema
   (só lê); não cria policy aberta; não muda RLS de tabela existente.

   VALIDADE: o saldo vence quando o cliente fica N dias sem ganhar (N do
   dono; 0 = não vence). O próximo crédito lança o "expira" do saldo velho.

   VERIFICAÇÃO: o select do fim devolve a impressão digital (colunas da
   tabela + funções + trigger). Esperado: a32b229f546e8c0c55587257a21ada60
   (conferido no PGlite por app/lib/fidelidade-banco.test.mjs).

   ROLLBACK (não rodar sem decisão do dono; o livro com os saldos dos
   clientes é APAGADO — exporte antes):
     drop trigger if exists fidelidade_pedido on public.pedidos;
     drop function if exists public.fidelidade_pedido_trg(), public._fidelidade_estornar_pedido(uuid),
       public.fidelidade_resgatar_selos(text, text, text, text), public.fidelidade_usar_cashback(text, text, numeric, text),
       public.fidelidade_lancar(text, text, text, integer, numeric, text), public.fidelidade_reservar_cashback(text, text, uuid, numeric),
       public._fidelidade_saldo_cartao(text, text, text, integer), public._fidelidade_saldo_cashback(text, text, integer),
       public._fidelidade_creditar(text, text, text, text, integer, numeric, uuid, integer),
       public._fidelidade_config(text), public._fidelidade_tel(text), public._fidelidade_num(text, numeric, numeric, numeric),
       public._fidelidade_cartao(jsonb, text);
     drop table if exists public.fidelidade_movimentos;  -- o trigger de imutabilidade cai junto
     drop function if exists public.fidelidade_imutavel_trg();
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- Preflight: aborta sem mudar nada.
do $$
begin
  if to_regclass('public.pedidos') is null or to_regclass('public.pedidos_itens') is null or to_regclass('public.config_sistema') is null then
    raise exception 'FIDELIDADE-1: tabela ausente (pedidos, pedidos_itens ou config_sistema). Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_user_can(text,text)') is null then
    raise exception 'FIDELIDADE-1: função hefisto_user_can ausente. Nada foi alterado.';
  end if;
  if to_regclass('public.fidelidade_movimentos') is not null then
    raise exception 'FIDELIDADE-1: fidelidade_movimentos já existe (já aplicada?). Nada foi alterado.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' and column_name = 'cliente_telefone')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_itens' and column_name = 'valor_unitario') then
    raise exception 'FIDELIDADE-1: pedidos/pedidos_itens sem as colunas esperadas. Nada foi alterado.';
  end if;
end $$;

-- 1. Livro de lançamentos ------------------------------------------------------
create table public.fidelidade_movimentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  cliente_tel text not null check (cliente_tel ~ '^[0-9]{10,11}$'),
  tipo text not null check (tipo in ('selo', 'selo_estorno', 'selo_resgate', 'selo_ajuste', 'selo_expira',
                                     'cashback', 'cashback_estorno', 'cashback_uso', 'cashback_uso_estorno', 'cashback_ajuste', 'cashback_expira')),
  cartao_id text check (cartao_id is null or cartao_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  selos integer not null default 0,
  valor numeric(12, 2) not null default 0,
  pedido_id uuid,
  origem text not null default 'pedido' check (origem in ('pedido', 'balcao', 'painel', 'cardapio')),
  observacao text check (observacao is null or length(observacao) <= 200),
  criado_por uuid,
  created_at timestamptz not null default now(),
  constraint fidelidade_mov_cartao check ((tipo like 'selo%') = (cartao_id is not null)),
  constraint fidelidade_mov_sinal check (case tipo
    when 'selo' then selos > 0 and valor = 0
    when 'selo_ajuste' then selos <> 0 and valor = 0
    when 'cashback' then valor > 0 and selos = 0
    when 'cashback_uso_estorno' then valor > 0 and selos = 0
    when 'cashback_ajuste' then valor <> 0 and selos = 0
    when 'selo_estorno' then selos < 0 and valor = 0
    when 'selo_resgate' then selos < 0 and valor = 0
    when 'selo_expira' then selos < 0 and valor = 0
    else valor < 0 and selos = 0 end)
);
comment on table public.fidelidade_movimentos is 'Fidelidade (selos por cartão e cashback): livro só de inclusão; saldo = soma. FIDELIDADE-1.';
-- O mesmo pedido não rende (nem estorna) duas vezes.
create unique index fidelidade_mov_pedido_unico on public.fidelidade_movimentos (pedido_id, tipo, coalesce(cartao_id, '')) where pedido_id is not null;
create index fidelidade_mov_cliente on public.fidelidade_movimentos (unidade_id, cliente_tel, created_at);

create or replace function public.fidelidade_imutavel_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'O livro da fidelidade não pode ser alterado nem apagado. Para corrigir, lance um ajuste.';
end $$;
create trigger fidelidade_mov_imutavel before update or delete on public.fidelidade_movimentos
  for each row execute function public.fidelidade_imutavel_trg();
create trigger fidelidade_mov_sem_truncate before truncate on public.fidelidade_movimentos
  for each statement execute function public.fidelidade_imutavel_trg();

-- 2. Quem lê ------------------------------------------------------------------
alter table public.fidelidade_movimentos enable row level security;
revoke all on public.fidelidade_movimentos from public, anon, authenticated;
grant select on public.fidelidade_movimentos to authenticated;
create policy fidelidade_ver on public.fidelidade_movimentos for select to authenticated
  using (public.hefisto_user_can('clientes.loyalty.view', unidade_id));

-- 3. Ajudantes (internos) ------------------------------------------------------
-- Telefone: só dígitos, sem o 55; fora de 10–11 dígitos, sem fidelidade (= app/lib/fidelidade.mjs).
create or replace function public._fidelidade_tel(p text)
returns text language sql immutable set search_path = public as $$
  select case when length(d) in (10, 11) then d
              when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3)
              else null end
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

-- Número da configuração com teto e piso (texto ruim = padrão), como normalizarFidelidade.
create or replace function public._fidelidade_num(p text, p_min numeric, p_max numeric, p_padrao numeric)
returns numeric language sql immutable set search_path = public as $$
  select case when p ~ '^-?[0-9]+(\.[0-9]+)?$' then least(p_max, greatest(p_min, p::numeric)) else p_padrao end
$$;

create or replace function public._fidelidade_config(p_unidade text)
returns jsonb language sql stable set search_path = public as $$
  select coalesce((select params -> 'fidelidade' from public.config_sistema
                    where unidade_id = p_unidade order by created_at nulls first, id limit 1), '{}'::jsonb)
$$;

-- Um cartão da configuração pelo id (só os 10 primeiros valem, como no app).
create or replace function public._fidelidade_cartao(p_cfg jsonb, p_cartao text)
returns jsonb language sql immutable set search_path = public as $$
  select c from jsonb_array_elements(case when jsonb_typeof(p_cfg -> 'cartoes') = 'array' then p_cfg -> 'cartoes' else '[]'::jsonb end)
         with ordinality as t(c, n)
   where n <= 10 and c ->> 'id' = p_cartao order by n limit 1
$$;

-- Saldo de selos de um cartão (0 se venceu: N dias sem ganhar selo).
create or replace function public._fidelidade_saldo_cartao(p_unidade text, p_tel text, p_cartao text, p_validade integer)
returns integer language sql stable set search_path = public as $$
  select case when coalesce(p_validade, 0) > 0
               and max(created_at) filter (where tipo = 'selo' or (tipo = 'selo_ajuste' and selos > 0)) + make_interval(days => p_validade) < now()
              then 0 else greatest(coalesce(sum(selos), 0), 0)::integer end
    from public.fidelidade_movimentos
   where unidade_id = p_unidade and cliente_tel = p_tel and cartao_id = p_cartao
$$;

create or replace function public._fidelidade_saldo_cashback(p_unidade text, p_tel text, p_validade integer)
returns numeric language sql stable set search_path = public as $$
  select case when coalesce(p_validade, 0) > 0
               and max(created_at) filter (where tipo = 'cashback' or (tipo = 'cashback_ajuste' and valor > 0)) + make_interval(days => p_validade) < now()
              then 0 else greatest(coalesce(sum(valor), 0), 0) end
    from public.fidelidade_movimentos
   where unidade_id = p_unidade and cliente_tel = p_tel and tipo like 'cashback%'
$$;

-- Crédito (selo ou cashback). Antes, se o saldo velho venceu, lança o "expira" dele.
create or replace function public._fidelidade_creditar(p_unidade text, p_tel text, p_tipo text, p_cartao text,
  p_selos integer, p_valor numeric, p_pedido uuid, p_validade integer)
returns void language plpgsql set search_path = public as $$
declare
  v_bruto numeric;
  v_saldo numeric;
begin
  if p_tipo = 'selo' then
    select coalesce(sum(selos), 0) into v_bruto from public.fidelidade_movimentos
     where unidade_id = p_unidade and cliente_tel = p_tel and cartao_id = p_cartao;
    v_saldo := public._fidelidade_saldo_cartao(p_unidade, p_tel, p_cartao, p_validade);
    if v_bruto > 0 and v_saldo = 0 then
      insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, cartao_id, selos, pedido_id, origem, observacao)
      values (p_unidade, p_tel, 'selo_expira', p_cartao, -v_bruto::integer, p_pedido, 'pedido', 'Selos vencidos')
      on conflict do nothing;
    end if;
    insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, cartao_id, selos, pedido_id, origem)
    values (p_unidade, p_tel, 'selo', p_cartao, p_selos, p_pedido, 'pedido')
    on conflict do nothing;
  else
    select coalesce(sum(valor), 0) into v_bruto from public.fidelidade_movimentos
     where unidade_id = p_unidade and cliente_tel = p_tel and tipo like 'cashback%';
    v_saldo := public._fidelidade_saldo_cashback(p_unidade, p_tel, p_validade);
    if v_bruto > 0 and v_saldo = 0 then
      insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, valor, pedido_id, origem, observacao)
      values (p_unidade, p_tel, 'cashback_expira', -v_bruto, p_pedido, 'pedido', 'Cashback vencido')
      on conflict do nothing;
    end if;
    insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, valor, pedido_id, origem)
    values (p_unidade, p_tel, 'cashback', p_valor, p_pedido, 'pedido')
    on conflict do nothing;
  end if;
end $$;

-- Pedido cancelado: estorna o que ele deu e devolve o cashback usado nele.
create or replace function public._fidelidade_estornar_pedido(p_pedido uuid)
returns void language plpgsql set search_path = public as $$
declare
  r record;
begin
  for r in
    select unidade_id, cliente_tel, tipo, cartao_id, sum(selos)::integer as selos, sum(valor) as valor
      from public.fidelidade_movimentos
     where pedido_id = p_pedido and tipo in ('selo', 'cashback', 'cashback_uso')
     group by unidade_id, cliente_tel, tipo, cartao_id
  loop
    insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, cartao_id, selos, valor, pedido_id, origem, observacao)
    values (r.unidade_id, r.cliente_tel,
            case r.tipo when 'selo' then 'selo_estorno' when 'cashback' then 'cashback_estorno' else 'cashback_uso_estorno' end,
            r.cartao_id,
            case when r.tipo = 'selo' then -r.selos else 0 end,
            case when r.tipo = 'selo' then 0 else -r.valor end,
            p_pedido, 'pedido', 'Pedido cancelado')
    on conflict do nothing;
  end loop;
end $$;

-- 4. Trigger: o pedido concluído dá selo e cashback; o cancelado estorna ------
create or replace function public.fidelidade_pedido_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c_concluido constant text[] := array['pago', 'entregue', 'fechado', 'finalizado', 'concluido'];
  c_cancelado constant text[] := array['cancelado', 'recusado'];
  v_novo text := lower(coalesce(new.status, ''));
  v_velho text := case when tg_op = 'UPDATE' then lower(coalesce(old.status, '')) else '' end;
  v_cfg jsonb;
  v_tel text;
  v_card jsonb;
  v_ids text[];
  v_qtd integer;
  v_sub numeric;
  v_usado numeric;
  v_pct numeric;
  v_cb numeric;
begin
  begin
    if v_novo = any (c_cancelado) and not (v_velho = any (c_cancelado)) then
      perform public._fidelidade_estornar_pedido(new.id);
      return null;
    end if;
    if not (v_novo = any (c_concluido)) or v_velho = any (c_concluido) then return null; end if;
    v_tel := public._fidelidade_tel(new.cliente_telefone);
    if v_tel is null or new.unidade_id is null then return null; end if;
    v_cfg := public._fidelidade_config(new.unidade_id);
    if coalesce(v_cfg ->> 'ativo', '') <> 'true' then return null; end if;
    perform pg_advisory_xact_lock(hashtext('fidelidade:' || new.unidade_id || ':' || v_tel));

    for v_card in
      select c from jsonb_array_elements(case when jsonb_typeof(v_cfg -> 'cartoes') = 'array' then v_cfg -> 'cartoes' else '[]'::jsonb end)
             with ordinality as t(c, n)
       where n <= 10
    loop
      continue when jsonb_typeof(v_card) <> 'object' or coalesce(v_card ->> 'ativo', 'true') = 'false'
                 or coalesce(btrim(v_card ->> 'recompensa'), '') = '' or coalesce(v_card ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,64}$'
                 or coalesce(jsonb_typeof(v_card -> 'produto_ids'), '') <> 'array';
      v_ids := array(select jsonb_array_elements_text(v_card -> 'produto_ids'));
      select coalesce(sum(greatest(quantidade, 0)), 0)::integer into v_qtd
        from public.pedidos_itens
       where pedido_id = new.id and produto_id::text = any (v_ids) and coalesce(status_kds, '') <> 'cancelado';
      continue when v_qtd <= 0;
      perform public._fidelidade_creditar(new.unidade_id, v_tel, 'selo', v_card ->> 'id',
        case when v_card ->> 'por' = 'pedido' then 1 else v_qtd end, 0, new.id,
        public._fidelidade_num(v_card ->> 'validade_dias', 0, 730, 0)::integer);
    end loop;

    if coalesce(v_cfg -> 'cashback' ->> 'ativo', '') = 'true' then
      select coalesce(sum(greatest(quantidade, 0) * coalesce(valor_unitario, 0)), 0) into v_sub
        from public.pedidos_itens where pedido_id = new.id and coalesce(status_kds, '') <> 'cancelado';
      select coalesce(-sum(valor), 0) into v_usado
        from public.fidelidade_movimentos where pedido_id = new.id and tipo = 'cashback_uso';
      v_sub := round(greatest(v_sub - v_usado, 0), 2);
      v_pct := round(public._fidelidade_num(v_cfg -> 'cashback' ->> 'percentual', 0.5, 30, 5), 2);
      if v_sub > 0 and v_sub >= round(public._fidelidade_num(v_cfg -> 'cashback' ->> 'minimo_pedido', 0, 100000, 0), 2) then
        v_cb := round(v_sub * v_pct / 100, 2);
        if v_cb > 0 then
          perform public._fidelidade_creditar(new.unidade_id, v_tel, 'cashback', null, 0, v_cb, new.id,
            public._fidelidade_num(v_cfg -> 'cashback' ->> 'validade_dias', 0, 730, 60)::integer);
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'FIDELIDADE-1: pedido % ficou sem fidelidade: %', new.id, sqlerrm;
  end;
  return null;
end $$;

create trigger fidelidade_pedido after insert or update of status on public.pedidos
  for each row execute function public.fidelidade_pedido_trg();

-- 5. Funções da equipe (permissão conferida no banco) --------------------------
create or replace function public.fidelidade_resgatar_selos(p_unidade text, p_telefone text, p_cartao text, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tel text := public._fidelidade_tel(p_telefone);
  v_card jsonb;
  v_necessarios integer;
  v_saldo integer;
begin
  if not coalesce(public.hefisto_user_can('clientes.loyalty.confirm', p_unidade), false) then
    raise exception 'Sem permissão para entregar prêmios da fidelidade nesta unidade.';
  end if;
  if v_tel is null then raise exception 'Telefone inválido (use DDD + número).'; end if;
  v_card := public._fidelidade_cartao(public._fidelidade_config(p_unidade), p_cartao);
  if v_card is null then raise exception 'Cartão de selos não encontrado.'; end if;
  v_necessarios := public._fidelidade_num(v_card ->> 'selos', 2, 30, 10)::integer;
  perform pg_advisory_xact_lock(hashtext('fidelidade:' || p_unidade || ':' || v_tel));
  v_saldo := public._fidelidade_saldo_cartao(p_unidade, v_tel, p_cartao, public._fidelidade_num(v_card ->> 'validade_dias', 0, 730, 0)::integer);
  if v_saldo < v_necessarios then
    raise exception 'Faltam % selo(s) para o prêmio deste cartão.', v_necessarios - v_saldo;
  end if;
  insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, cartao_id, selos, origem, observacao, criado_por)
  values (p_unidade, v_tel, 'selo_resgate', p_cartao, -v_necessarios, 'balcao', left(nullif(btrim(p_observacao), ''), 200), auth.uid());
  return jsonb_build_object('ok', true, 'resgatados', v_necessarios, 'selos', v_saldo - v_necessarios);
end $$;

create or replace function public.fidelidade_usar_cashback(p_unidade text, p_telefone text, p_valor numeric, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tel text := public._fidelidade_tel(p_telefone);
  v_valor numeric := round(coalesce(p_valor, 0), 2);
  v_saldo numeric;
begin
  if not coalesce(public.hefisto_user_can('clientes.loyalty.confirm', p_unidade), false) then
    raise exception 'Sem permissão para usar cashback nesta unidade.';
  end if;
  if v_tel is null then raise exception 'Telefone inválido (use DDD + número).'; end if;
  if v_valor <= 0 or v_valor > 10000 then raise exception 'Valor de cashback inválido.'; end if;
  perform pg_advisory_xact_lock(hashtext('fidelidade:' || p_unidade || ':' || v_tel));
  v_saldo := public._fidelidade_saldo_cashback(p_unidade, v_tel,
    public._fidelidade_num(public._fidelidade_config(p_unidade) -> 'cashback' ->> 'validade_dias', 0, 730, 60)::integer);
  if v_valor > v_saldo then raise exception 'Saldo de cashback insuficiente (R$ %).', to_char(v_saldo, 'FM999990D00'); end if;
  insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, valor, origem, observacao, criado_por)
  values (p_unidade, v_tel, 'cashback_uso', -v_valor, 'balcao', left(nullif(btrim(p_observacao), ''), 200), auth.uid());
  return jsonb_build_object('ok', true, 'usado', v_valor, 'saldo', v_saldo - v_valor);
end $$;

-- Selo de compra no balcão (fora dos pedidos) ou correção. Motivo obrigatório; fica quem lançou.
create or replace function public.fidelidade_lancar(p_unidade text, p_telefone text, p_cartao text, p_selos integer, p_valor numeric, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tel text := public._fidelidade_tel(p_telefone);
  v_motivo text := left(nullif(btrim(p_motivo), ''), 200);
  v_selos integer := coalesce(p_selos, 0);
  v_valor numeric := round(coalesce(p_valor, 0), 2);
begin
  if not coalesce(public.hefisto_user_can('clientes.loyalty.edit', p_unidade), false) then
    raise exception 'Sem permissão para lançar na fidelidade nesta unidade.';
  end if;
  if v_tel is null then raise exception 'Telefone inválido (use DDD + número).'; end if;
  if v_motivo is null or length(v_motivo) < 3 then raise exception 'Escreva o motivo do lançamento.'; end if;
  if (v_selos <> 0) = (v_valor <> 0) then raise exception 'Lance selos OU cashback.'; end if;
  if abs(v_selos) > 30 or abs(v_valor) > 1000 then raise exception 'Valor fora do limite do lançamento manual.'; end if;
  if v_selos <> 0 and public._fidelidade_cartao(public._fidelidade_config(p_unidade), p_cartao) is null then
    raise exception 'Cartão de selos não encontrado.';
  end if;
  insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, cartao_id, selos, valor, origem, observacao, criado_por)
  values (p_unidade, v_tel, case when v_selos <> 0 then 'selo_ajuste' else 'cashback_ajuste' end,
          case when v_selos <> 0 then p_cartao end, v_selos, v_valor, 'painel', v_motivo, auth.uid());
  return jsonb_build_object('ok', true);
end $$;

-- Cashback usado num pedido do cardápio: só o servidor chama (service_role).
create or replace function public.fidelidade_reservar_cashback(p_unidade text, p_telefone text, p_pedido uuid, p_valor numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tel text := public._fidelidade_tel(p_telefone);
  v_valor numeric := round(coalesce(p_valor, 0), 2);
  v_ped record;
  v_saldo numeric;
begin
  if v_tel is null or v_valor <= 0 or v_valor > 10000 then raise exception 'Cashback inválido.'; end if;
  select id, unidade_id, status, cliente_telefone into v_ped from public.pedidos where id = p_pedido;
  if v_ped.id is null or v_ped.unidade_id is distinct from p_unidade or lower(coalesce(v_ped.status, '')) <> 'novo_online'
     or public._fidelidade_tel(v_ped.cliente_telefone) is distinct from v_tel then
    raise exception 'Pedido não confere para usar cashback.';
  end if;
  perform pg_advisory_xact_lock(hashtext('fidelidade:' || p_unidade || ':' || v_tel));
  v_saldo := public._fidelidade_saldo_cashback(p_unidade, v_tel,
    public._fidelidade_num(public._fidelidade_config(p_unidade) -> 'cashback' ->> 'validade_dias', 0, 730, 60)::integer);
  if v_valor > v_saldo then raise exception 'Saldo de cashback insuficiente.'; end if;
  insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, valor, pedido_id, origem)
  values (p_unidade, v_tel, 'cashback_uso', -v_valor, p_pedido, 'cardapio');
  return jsonb_build_object('ok', true, 'usado', v_valor, 'saldo', v_saldo - v_valor);
end $$;

-- Quem executa o quê: ajudantes e trigger, ninguém de fora; equipe, as três; servidor, a reserva.
revoke all on function public._fidelidade_tel(text), public._fidelidade_num(text, numeric, numeric, numeric),
  public._fidelidade_config(text), public._fidelidade_cartao(jsonb, text),
  public._fidelidade_saldo_cartao(text, text, text, integer), public._fidelidade_saldo_cashback(text, text, integer),
  public._fidelidade_creditar(text, text, text, text, integer, numeric, uuid, integer), public._fidelidade_estornar_pedido(uuid),
  public.fidelidade_pedido_trg(), public.fidelidade_imutavel_trg(),
  public.fidelidade_resgatar_selos(text, text, text, text), public.fidelidade_usar_cashback(text, text, numeric, text),
  public.fidelidade_lancar(text, text, text, integer, numeric, text), public.fidelidade_reservar_cashback(text, text, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.fidelidade_resgatar_selos(text, text, text, text), public.fidelidade_usar_cashback(text, text, numeric, text),
  public.fidelidade_lancar(text, text, text, integer, numeric, text) to authenticated;
grant execute on function public.fidelidade_reservar_cashback(text, text, uuid, numeric) to service_role;

commit;

-- Verificação (só leitura): impressão digital das colunas, funções e trigger.
select md5(
  (select string_agg(column_name || ':' || data_type, '|' order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name = 'fidelidade_movimentos')
  || '#' || (select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || case when p.prosecdef then 'D' else 'I' end, '|' order by p.proname)
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and (p.proname like 'fidelidade%' or p.proname like '\_fidelidade%'))
  || '#' || (select string_agg(tgname, '|' order by tgname) from pg_trigger
              where not tgisinternal and tgrelid in ('public.pedidos'::regclass, 'public.fidelidade_movimentos'::regclass) and tgname like 'fidelidade%')
) as impressao_digital;
