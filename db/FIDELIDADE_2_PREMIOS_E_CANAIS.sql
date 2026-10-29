/* ═══════════════════════════════════════════════════════════════════════════
   FIDELIDADE-2 · CÓDIGO DE PRÊMIO E CANAIS QUE CONTAM

   STATUS: escrita em 29/10/2026 (Etapa 8 do cardápio digital). Testada no
   PGlite (app/lib/fidelidade-premios-banco.test.mjs) por cima da FIDELIDADE-1.

   O QUE O PROTÓTIPO PEDE (PainelFidelidade / DeliveryFidelidade):
     · o cliente completa o cartão e o app mostra um CÓDIGO; a equipe digita o
       código no painel, confere e confirma a retirada (o selo sai do saldo
       só aí, e fica no histórico "Retiradas recentes" com quem liberou);
     · o dono escolhe em que canais (mesa, delivery, balcão) o pedido conta
       para selo e cashback; iFood e outros apps nunca contam.

   FAZ (uma transação; só aditiva):
     1. tabela fidelidade_premios (código por cliente e cartão, validade 30
        dias). RLS: lê quem tem clientes.loyalty.view; ninguém grava direto.
     2. fidelidade_gerar_premio (servidor): devolve o código aberto do
        cliente para o cartão, ou cria um se o saldo já completa o cartão.
     3. fidelidade_validar_premio / fidelidade_confirmar_premio (equipe com
        clientes.loyalty.confirm): confere e dá baixa (selo_resgate no livro).
     4. troca o corpo de fidelidade_pedido_trg: o MESMO da FIDELIDADE-1 + o
        filtro de canal (sem canais na configuração, conta como antes).

   NÃO FAZ: não muda nenhuma linha existente, não mexe no livro nem nas
   outras funções.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.fidelidade_movimentos') is null or to_regprocedure('public.fidelidade_pedido_trg()') is null then
    raise exception 'FIDELIDADE-2: a FIDELIDADE-1 não está aplicada. Nada foi alterado.';
  end if;
  if to_regclass('public.fidelidade_premios') is not null then
    raise exception 'FIDELIDADE-2: fidelidade_premios já existe (já aplicada?). Nada foi alterado.';
  end if;
end $$;

-- 1. Códigos de prêmio --------------------------------------------------------
create table public.fidelidade_premios (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  cliente_tel text not null check (cliente_tel ~ '^[0-9]{10,11}$'),
  cartao_id text not null check (cartao_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  codigo text not null check (codigo ~ '^[A-Z2-9]{6}$'),
  recompensa text check (recompensa is null or length(recompensa) <= 80),
  selos integer not null check (selos between 2 and 30),
  completo_em timestamptz not null default now(),
  valido_ate timestamptz not null,
  retirado_em timestamptz,
  retirado_por uuid,
  movimento_id uuid,
  constraint fidelidade_premios_codigo unique (unidade_id, codigo)
);
create index fidelidade_premios_cliente on public.fidelidade_premios (unidade_id, cliente_tel, cartao_id);
alter table public.fidelidade_premios enable row level security;
revoke all on public.fidelidade_premios from public, anon, authenticated;
grant select on public.fidelidade_premios to authenticated;
create policy fidelidade_premios_ver on public.fidelidade_premios for select to authenticated
  using (public.hefisto_user_can('clientes.loyalty.view', unidade_id));

-- 2. Servidor: o código do cliente (o telefone já foi provado pelo servidor).
create or replace function public.fidelidade_gerar_premio(p_unidade text, p_telefone text, p_cartao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tel text := public._fidelidade_tel(p_telefone);
  v_card jsonb;
  v_necessarios integer;
  v_saldo integer;
  v_aberto public.fidelidade_premios;
  v_codigo text;
  v_tentativa integer := 0;
begin
  if v_tel is null then return jsonb_build_object('ok', false, 'motivo', 'telefone'); end if;
  v_card := public._fidelidade_cartao(public._fidelidade_config(p_unidade), p_cartao);
  if v_card is null or coalesce(v_card ->> 'ativo', 'true') = 'false' then return jsonb_build_object('ok', false, 'motivo', 'cartao'); end if;
  v_necessarios := public._fidelidade_num(v_card ->> 'selos', 2, 30, 10)::integer;
  perform pg_advisory_xact_lock(hashtext('fidelidade:' || p_unidade || ':' || v_tel));
  select * into v_aberto from public.fidelidade_premios
   where unidade_id = p_unidade and cliente_tel = v_tel and cartao_id = p_cartao and retirado_em is null and valido_ate > now()
   order by completo_em desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'codigo', v_aberto.codigo, 'valido_ate', v_aberto.valido_ate, 'completo_em', v_aberto.completo_em);
  end if;
  v_saldo := public._fidelidade_saldo_cartao(p_unidade, v_tel, p_cartao, public._fidelidade_num(v_card ->> 'validade_dias', 0, 730, 0)::integer);
  if v_saldo < v_necessarios then return jsonb_build_object('ok', false, 'motivo', 'faltam', 'faltam', v_necessarios - v_saldo); end if;
  loop
    v_tentativa := v_tentativa + 1;
    v_codigo := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.fidelidade_premios where unidade_id = p_unidade and codigo = v_codigo) or v_tentativa > 20;
  end loop;
  insert into public.fidelidade_premios (unidade_id, cliente_tel, cartao_id, codigo, recompensa, selos, valido_ate)
  values (p_unidade, v_tel, p_cartao, v_codigo, left(v_card ->> 'recompensa', 80), v_necessarios, now() + interval '30 days')
  returning * into v_aberto;
  return jsonb_build_object('ok', true, 'codigo', v_aberto.codigo, 'valido_ate', v_aberto.valido_ate, 'completo_em', v_aberto.completo_em);
end $$;

-- 3. Equipe: conferir e dar baixa ----------------------------------------------
create or replace function public.fidelidade_validar_premio(p_unidade text, p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.fidelidade_premios;
  v_card jsonb;
  v_nome text;
begin
  if not coalesce(public.hefisto_user_can('clientes.loyalty.confirm', p_unidade), false) then
    raise exception 'Sem permissão para entregar prêmios da fidelidade nesta unidade.';
  end if;
  select * into v_p from public.fidelidade_premios where unidade_id = p_unidade and codigo = upper(btrim(coalesce(p_codigo, '')));
  if not found then return jsonb_build_object('ok', false, 'motivo', 'nao_existe'); end if;
  v_card := public._fidelidade_cartao(public._fidelidade_config(p_unidade), v_p.cartao_id);
  select nome into v_nome from public.clientes where unidade_id = p_unidade and public._fidelidade_tel(tel) = v_p.cliente_tel order by created_at limit 1;
  return jsonb_build_object('ok', true, 'codigo', v_p.codigo, 'cartao', coalesce(v_card ->> 'nome', v_p.cartao_id), 'recompensa', v_p.recompensa,
    'cliente', v_nome, 'final', right(v_p.cliente_tel, 4), 'completo_em', v_p.completo_em, 'valido_ate', v_p.valido_ate,
    'retirado_em', v_p.retirado_em, 'vencido', v_p.retirado_em is null and v_p.valido_ate <= now(),
    'pode', v_p.retirado_em is null and v_p.valido_ate > now());
end $$;

create or replace function public.fidelidade_confirmar_premio(p_unidade text, p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p public.fidelidade_premios;
  v_card jsonb;
  v_saldo integer;
  v_mov uuid;
begin
  if not coalesce(public.hefisto_user_can('clientes.loyalty.confirm', p_unidade), false) then
    raise exception 'Sem permissão para entregar prêmios da fidelidade nesta unidade.';
  end if;
  select * into v_p from public.fidelidade_premios where unidade_id = p_unidade and codigo = upper(btrim(coalesce(p_codigo, ''))) for update;
  if not found then raise exception 'Código não encontrado.'; end if;
  if v_p.retirado_em is not null then raise exception 'Este prêmio já foi retirado.'; end if;
  if v_p.valido_ate <= now() then raise exception 'Este código venceu.'; end if;
  perform pg_advisory_xact_lock(hashtext('fidelidade:' || p_unidade || ':' || v_p.cliente_tel));
  v_card := public._fidelidade_cartao(public._fidelidade_config(p_unidade), v_p.cartao_id);
  v_saldo := public._fidelidade_saldo_cartao(p_unidade, v_p.cliente_tel, v_p.cartao_id,
    public._fidelidade_num(coalesce(v_card ->> 'validade_dias', '0'), 0, 730, 0)::integer);
  if v_saldo < v_p.selos then raise exception 'O cliente não tem mais os selos deste prêmio (faltam %).', v_p.selos - v_saldo; end if;
  insert into public.fidelidade_movimentos (unidade_id, cliente_tel, tipo, cartao_id, selos, origem, observacao, criado_por)
  values (p_unidade, v_p.cliente_tel, 'selo_resgate', v_p.cartao_id, -v_p.selos, 'balcao', 'Código ' || v_p.codigo, auth.uid())
  returning id into v_mov;
  update public.fidelidade_premios set retirado_em = now(), retirado_por = auth.uid(), movimento_id = v_mov where id = v_p.id;
  return jsonb_build_object('ok', true, 'selos', v_saldo - v_p.selos);
end $$;

-- 4. Gatilho dos pedidos: o mesmo da FIDELIDADE-1 + canais ---------------------
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
  v_tipo text := lower(coalesce(new.tipo_pedido, ''));
  v_canal text;
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
    -- FIDELIDADE-2: iFood e outros apps não contam; canal fora da lista do dono também não.
    if v_tipo like '%ifood%' or v_tipo in ('rappi', 'aiqfome', '99food', 'marketplace', 'app_externo') then return null; end if;
    v_canal := case when v_tipo in ('salao', 'qrcode', 'tablet', 'mesa') then 'mesa'
                    when v_tipo in ('delivery', 'retirada') then 'delivery'
                    when v_tipo in ('balcao', 'pdv') then 'balcao' end;
    if v_canal is not null and jsonb_typeof(v_cfg -> 'canais') = 'array' and jsonb_array_length(v_cfg -> 'canais') > 0
       and not ((v_cfg -> 'canais') ? v_canal) then return null; end if;
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
      -- Cashback só sobre o que foi pago: tira o desconto do pedido (cadastro + cashback usado).
      v_sub := round(greatest(v_sub - greatest(coalesce(new.desconto, 0), v_usado), 0), 2);
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

revoke all on function public.fidelidade_gerar_premio(text, text, text), public.fidelidade_validar_premio(text, text),
  public.fidelidade_confirmar_premio(text, text), public.fidelidade_pedido_trg() from public, anon, authenticated;
grant execute on function public.fidelidade_validar_premio(text, text), public.fidelidade_confirmar_premio(text, text) to authenticated;
grant execute on function public.fidelidade_gerar_premio(text, text, text) to service_role;

commit;

-- Verificação (só leitura)
select md5(
  (select string_agg(column_name || ':' || data_type, '|' order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name = 'fidelidade_premios')
  || '#' || (select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || case when p.prosecdef then 'D' else 'I' end, '|' order by p.proname)
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('fidelidade_gerar_premio', 'fidelidade_validar_premio', 'fidelidade_confirmar_premio'))
  || '#' || md5((select prosrc from pg_proc where proname = 'fidelidade_pedido_trg'))
) as impressao_digital;
