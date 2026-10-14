/* ═══════════════════════════════════════════════════════════════════════════
   IFOOD-2 · pedidos do iFood no Héfisto (14/10/2026)

   POR QUE
   Com a loja conectada (IFOOD-1), os pedidos do iFood precisam chegar sozinhos
   às vendas, à cozinha, ao estoque e ao DRE da operação dona da loja — sem
   duplicar nada e sem interferir na Saipos.

   O QUE FAZ (aditivo; nada é apagado ou reescrito)
   1. integration_events: + colunas de processamento (pedido, loja, data do
      evento, próxima tentativa, ACK). A caixa de entrada vira fila com
      histórico, erro e reprocessamento.
   2. delivery_pedidos: um registro por pedido (único por unidade + canal + id
      do pedido no canal). Guarda só o necessário: sem telefone, documento ou
      endereço do cliente (LGPD). Status só avança (evento atrasado não volta
      o pedido), cancelamento sempre vale.
   3. delivery_itens_mapeamento: item do cardápio do iFood → marmita (ficha).
   4. delivery_repasses: lançamentos financeiros REAIS vindos do iFood
      (repasses/conciliação), quando o módulo financeiro for homologado.
   5. delivery_gravar_pedido(pedido, vendas): grava o pedido e as linhas de
      venda (marmitaria_vendas, fonte 'ifood') numa transação. Só o servidor
      (service_role) executa. Reenvio = atualização, nunca duplicata.
   6. marmitaria_baixar_pedidos(dados): baixa/estorno de estoque dos pedidos
      pela ficha técnica, feita por um USUÁRIO logado através de
      estoque_movimentar (mesmas permissões e auditoria do estoque), com chave
      idempotente e controle de versão por pedido.

   SEGURANÇA
   - delivery_pedidos e delivery_repasses: leitura por unidade (sec_unidade);
     escrita só do servidor. Usuário só pode marcar a separação da cozinha.
   - delivery_itens_mapeamento: CRUD por unidade (sec_unidade).
   - delivery_gravar_pedido: EXECUTE só para service_role.
   - marmitaria_baixar_pedidos: SECURITY DEFINER com checagem explícita da
     unidade do usuário; o estoque continua passando por estoque_movimentar,
     que confere auth.uid() e a permissão de movimentar.

   ROLLBACK (não rodar sem decisão do dono; apaga pedidos importados):
     drop function if exists public.marmitaria_baixar_pedidos(jsonb);
     drop function if exists public.delivery_gravar_pedido(jsonb, jsonb);
     drop table if exists public.delivery_repasses;
     drop table if exists public.delivery_itens_mapeamento;
     drop table if exists public.delivery_pedidos;
     alter table public.integration_events
       drop column if exists order_id, drop column if exists merchant_id,
       drop column if exists evento_em, drop column if exists proxima_tentativa_em,
       drop column if exists ack_em;
     -- as linhas de marmitaria_vendas com fonte = 'ifood' ficam (são vendas).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- ── 0. Preflight ──────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['unidades', 'integration_events', 'integration_connections', 'marmitaria_vendas', 'fichas_tecnicas'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'IFOOD-2: tabela % não existe. Nada foi alterado.', t;
    end if;
  end loop;
  if to_regprocedure('public.hefisto_unidades_do_usuario()') is null
     or to_regprocedure('public.hefisto_ve_todas_unidades()') is null then
    raise exception 'IFOOD-2: funções de escopo (SEC-RLS-1) ausentes. Nada foi alterado.';
  end if;
  if to_regprocedure('public.estoque_movimentar(text,uuid,uuid,text,text,numeric,date,numeric,text,jsonb,text,text,text,text,text,text)') is null then
    raise exception 'IFOOD-2: estoque_movimentar ausente. Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'marmitaria_vendas_externa_uq') then
    raise exception 'IFOOD-2: índice marmitaria_vendas_externa_uq ausente (MARMITARIA-V2). Nada foi alterado.';
  end if;
end $$;

-- ── 1. Fila de eventos com histórico ──────────────────────────────────────────
alter table public.integration_events
  add column if not exists order_id text,
  add column if not exists merchant_id text,
  add column if not exists evento_em timestamptz,
  add column if not exists proxima_tentativa_em timestamptz,
  add column if not exists ack_em timestamptz;
create index if not exists integration_events_fila_idx
  on public.integration_events (provider, status, proxima_tentativa_em);
create index if not exists integration_events_pedido_idx
  on public.integration_events (unidade_id, provider, order_id);

-- ── 2. Pedidos ────────────────────────────────────────────────────────────────
create table if not exists public.delivery_pedidos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  canal text not null default 'ifood',
  pedido_externo_id text not null,
  display_id text,
  merchant_id text,
  status text not null default 'RECEBIDO',
  status_canal text,
  tipo text,
  agendado boolean not null default false,
  agendado_para timestamptz,
  criado_no_canal_em timestamptz,
  data_operacao date not null,
  cliente_nome text,
  itens jsonb not null default '[]'::jsonb,
  subtotal numeric,
  taxa_entrega numeric,
  descontos_loja numeric not null default 0,
  beneficios_canal numeric not null default 0,
  taxas_adicionais numeric not null default 0,
  valor_pedido numeric,
  pagamento jsonb not null default '{}'::jsonb,
  entregue_por text,
  teste boolean not null default false,
  detalhes_carregados boolean not null default false,
  cancelado_em timestamptz,
  cancelamento jsonb,
  disputa jsonb,
  fonte text not null default 'ifood_api',
  estoque_aplicado jsonb not null default '{}'::jsonb,
  estoque_versao integer not null default 0,
  estoque_atualizado_em timestamptz,
  separacao text not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_pedidos_unico unique (unidade_id, canal, pedido_externo_id),
  constraint delivery_pedidos_canal_ck check (canal ~ '^[a-z0-9_]{2,30}$'),
  constraint delivery_pedidos_status_ck check (status in ('RECEBIDO', 'CONFIRMADO', 'EM_PREPARO', 'PRONTO', 'DESPACHADO', 'CONCLUIDO', 'CANCELADO')),
  constraint delivery_pedidos_fonte_ck check (fonte in ('ifood_api', 'saipos', 'manual')),
  constraint delivery_pedidos_separacao_ck check (separacao in ('pendente', 'separado'))
);
create index if not exists delivery_pedidos_dia_idx on public.delivery_pedidos (unidade_id, data_operacao);
-- casamento com pedidos que vierem por outra fonte (ex.: exportação da Saipos traz o número curto)
create index if not exists delivery_pedidos_display_idx on public.delivery_pedidos (unidade_id, canal, display_id, data_operacao);

alter table public.delivery_pedidos enable row level security;
drop policy if exists sec_unidade_ler on public.delivery_pedidos;
create policy sec_unidade_ler on public.delivery_pedidos for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));
drop policy if exists sec_unidade_separar on public.delivery_pedidos;
create policy sec_unidade_separar on public.delivery_pedidos for update to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));
revoke all on public.delivery_pedidos from public, anon, authenticated;
grant select on public.delivery_pedidos to authenticated;
grant update (separacao) on public.delivery_pedidos to authenticated;
grant all on public.delivery_pedidos to service_role;

-- ── 3. Item do iFood → marmita ────────────────────────────────────────────────
create table if not exists public.delivery_itens_mapeamento (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  canal text not null default 'ifood',
  codigo_externo text not null,
  nome_externo text,
  ficha_id uuid references public.fichas_tecnicas(id) on delete set null,
  quantidade_por_item numeric not null default 1,
  ignorar boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint delivery_itens_mapeamento_unico unique (unidade_id, canal, codigo_externo),
  constraint delivery_itens_mapeamento_qtd_ck check (quantidade_por_item > 0)
);
alter table public.delivery_itens_mapeamento enable row level security;
drop policy if exists sec_unidade on public.delivery_itens_mapeamento;
create policy sec_unidade on public.delivery_itens_mapeamento for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));
revoke all on public.delivery_itens_mapeamento from public, anon;
grant select, insert, update, delete on public.delivery_itens_mapeamento to authenticated;
grant all on public.delivery_itens_mapeamento to service_role;

-- ── 4. Repasses e conciliação (valores REAIS informados pelo iFood) ───────────
create table if not exists public.delivery_repasses (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id) on delete cascade,
  canal text not null default 'ifood',
  referencia_externa text not null,
  tipo text not null,
  status text,
  competencia text,
  data_pagamento date,
  valor numeric not null,
  pedido_externo_id text,
  payload jsonb not null default '{}'::jsonb,
  importado_em timestamptz not null default now(),
  constraint delivery_repasses_unico unique (unidade_id, canal, referencia_externa)
);
create index if not exists delivery_repasses_data_idx on public.delivery_repasses (unidade_id, data_pagamento);
alter table public.delivery_repasses enable row level security;
drop policy if exists sec_unidade_ler on public.delivery_repasses;
create policy sec_unidade_ler on public.delivery_repasses for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));
revoke all on public.delivery_repasses from public, anon, authenticated;
grant select on public.delivery_repasses to authenticated;
grant all on public.delivery_repasses to service_role;

-- ── 5. Gravação do pedido + vendas (servidor) ─────────────────────────────────
create or replace function public._delivery_rank(p_status text) returns integer
language sql immutable set search_path = public as $$
  select case p_status when 'RECEBIDO' then 1 when 'CONFIRMADO' then 2 when 'EM_PREPARO' then 3
    when 'PRONTO' then 4 when 'DESPACHADO' then 5 when 'CONCLUIDO' then 6 when 'CANCELADO' then 9 else 0 end
$$;

create or replace function public.delivery_gravar_pedido(p_pedido jsonb, p_vendas jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_unidade text := nullif(p_pedido ->> 'unidade_id', '');
  v_canal text := coalesce(nullif(p_pedido ->> 'canal', ''), 'ifood');
  v_ext text := nullif(p_pedido ->> 'pedido_externo_id', '');
  v_status text := coalesce(nullif(p_pedido ->> 'status', ''), 'RECEBIDO');
  v_det boolean := coalesce((p_pedido ->> 'detalhes_carregados')::boolean, false);
  v_row public.delivery_pedidos;
  v_v jsonb;
  v_refs text[] := '{}';
  v_prefixo text;
  v_linhas integer := 0;
begin
  if v_unidade is null or v_ext is null then
    raise exception 'Pedido sem unidade ou sem identificador.' using errcode = '22023';
  end if;
  if public._delivery_rank(v_status) = 0 then
    raise exception 'Status de pedido inválido: %.', v_status using errcode = '22023';
  end if;

  insert into public.delivery_pedidos as d (
    unidade_id, canal, pedido_externo_id, display_id, merchant_id, status, status_canal, tipo, agendado, agendado_para,
    criado_no_canal_em, data_operacao, cliente_nome, itens, subtotal, taxa_entrega, descontos_loja, beneficios_canal,
    taxas_adicionais, valor_pedido, pagamento, entregue_por, teste, detalhes_carregados, cancelado_em, cancelamento, disputa, fonte)
  values (
    v_unidade, v_canal, v_ext, p_pedido ->> 'display_id', p_pedido ->> 'merchant_id', v_status, p_pedido ->> 'status_canal',
    p_pedido ->> 'tipo', coalesce((p_pedido ->> 'agendado')::boolean, false), nullif(p_pedido ->> 'agendado_para', '')::timestamptz,
    nullif(p_pedido ->> 'criado_no_canal_em', '')::timestamptz, coalesce(nullif(p_pedido ->> 'data_operacao', '')::date, current_date),
    p_pedido ->> 'cliente_nome', coalesce(p_pedido -> 'itens', '[]'::jsonb),
    nullif(p_pedido ->> 'subtotal', '')::numeric, nullif(p_pedido ->> 'taxa_entrega', '')::numeric,
    coalesce(nullif(p_pedido ->> 'descontos_loja', '')::numeric, 0), coalesce(nullif(p_pedido ->> 'beneficios_canal', '')::numeric, 0),
    coalesce(nullif(p_pedido ->> 'taxas_adicionais', '')::numeric, 0), nullif(p_pedido ->> 'valor_pedido', '')::numeric,
    coalesce(p_pedido -> 'pagamento', '{}'::jsonb), p_pedido ->> 'entregue_por', coalesce((p_pedido ->> 'teste')::boolean, false),
    v_det, nullif(p_pedido ->> 'cancelado_em', '')::timestamptz, p_pedido -> 'cancelamento', p_pedido -> 'disputa',
    coalesce(nullif(p_pedido ->> 'fonte', ''), 'ifood_api'))
  on conflict (unidade_id, canal, pedido_externo_id) do update set
    -- status só avança; cancelamento sempre vale e é final
    status = case
      when d.status = 'CANCELADO' then d.status
      when excluded.status = 'CANCELADO' then excluded.status
      when public._delivery_rank(excluded.status) > public._delivery_rank(d.status) then excluded.status
      else d.status end,
    status_canal = case when d.status = 'CANCELADO' then d.status_canal
      when excluded.status = 'CANCELADO' or public._delivery_rank(excluded.status) > public._delivery_rank(d.status) then excluded.status_canal
      else d.status_canal end,
    -- detalhes: só sobrescreve quando a nova versão veio dos detalhes do canal
    display_id = case when excluded.detalhes_carregados then excluded.display_id else coalesce(d.display_id, excluded.display_id) end,
    merchant_id = coalesce(excluded.merchant_id, d.merchant_id),
    tipo = case when excluded.detalhes_carregados then excluded.tipo else d.tipo end,
    agendado = case when excluded.detalhes_carregados then excluded.agendado else d.agendado end,
    agendado_para = case when excluded.detalhes_carregados then excluded.agendado_para else d.agendado_para end,
    criado_no_canal_em = coalesce(d.criado_no_canal_em, excluded.criado_no_canal_em),
    data_operacao = case when excluded.detalhes_carregados then excluded.data_operacao else d.data_operacao end,
    cliente_nome = case when excluded.detalhes_carregados then excluded.cliente_nome else d.cliente_nome end,
    itens = case when excluded.detalhes_carregados then excluded.itens else d.itens end,
    subtotal = case when excluded.detalhes_carregados then excluded.subtotal else d.subtotal end,
    taxa_entrega = case when excluded.detalhes_carregados then excluded.taxa_entrega else d.taxa_entrega end,
    descontos_loja = case when excluded.detalhes_carregados then excluded.descontos_loja else d.descontos_loja end,
    beneficios_canal = case when excluded.detalhes_carregados then excluded.beneficios_canal else d.beneficios_canal end,
    taxas_adicionais = case when excluded.detalhes_carregados then excluded.taxas_adicionais else d.taxas_adicionais end,
    valor_pedido = case when excluded.detalhes_carregados then excluded.valor_pedido else d.valor_pedido end,
    pagamento = case when excluded.detalhes_carregados then excluded.pagamento else d.pagamento end,
    entregue_por = case when excluded.detalhes_carregados then excluded.entregue_por else d.entregue_por end,
    teste = d.teste or excluded.teste,
    detalhes_carregados = d.detalhes_carregados or excluded.detalhes_carregados,
    cancelado_em = coalesce(d.cancelado_em, excluded.cancelado_em),
    cancelamento = coalesce(excluded.cancelamento, d.cancelamento),
    disputa = coalesce(excluded.disputa, d.disputa),
    updated_at = now()
  returning * into v_row;

  -- Linhas de venda do pedido (uma por marmita; referência ifood:<pedido>:<chave>).
  -- p_vendas nulo = evento só de status: as vendas não são tocadas.
  -- p_vendas [] = o pedido não gera venda (ex.: teste ou recusado antes de confirmar).
  if p_vendas is null or jsonb_typeof(p_vendas) <> 'array' then
    return jsonb_build_object('ok', true, 'pedido_id', v_row.id, 'status', v_row.status, 'linhas', null);
  end if;
  v_prefixo := v_canal || ':' || v_ext || ':';
  for v_v in select value from jsonb_array_elements(p_vendas) loop
    if left(coalesce(v_v ->> 'referencia_externa', ''), length(v_prefixo)) <> v_prefixo then
      raise exception 'Linha de venda com referência de outro pedido.' using errcode = '22023';
    end if;
    v_refs := v_refs || (v_v ->> 'referencia_externa');
    insert into public.marmitaria_vendas as mv (
      unidade_id, data, canal, ficha_id, quantidade, valor_bruto, descontos, cancelamentos, tributos, comissao,
      taxa_pagamento, entrega_subsidiada, promocoes, outras_taxas, repasse_liquido, taxas_estimadas, fonte,
      referencia_externa, observacao, criado_por)
    values (
      v_unidade, v_row.data_operacao, v_canal, nullif(v_v ->> 'ficha_id', '')::uuid,
      coalesce((v_v ->> 'quantidade')::numeric, 0), coalesce((v_v ->> 'valor_bruto')::numeric, 0),
      coalesce((v_v ->> 'descontos')::numeric, 0), coalesce((v_v ->> 'cancelamentos')::numeric, 0),
      nullif(v_v ->> 'tributos', '')::numeric, coalesce((v_v ->> 'comissao')::numeric, 0),
      coalesce((v_v ->> 'taxa_pagamento')::numeric, 0), coalesce((v_v ->> 'entrega_subsidiada')::numeric, 0),
      coalesce((v_v ->> 'promocoes')::numeric, 0), coalesce((v_v ->> 'outras_taxas')::numeric, 0),
      nullif(v_v ->> 'repasse_liquido', '')::numeric, coalesce((v_v ->> 'taxas_estimadas')::boolean, true),
      'ifood', v_v ->> 'referencia_externa', v_v ->> 'observacao', null)
    on conflict (unidade_id, fonte, referencia_externa) where referencia_externa is not null do update set
      data = excluded.data, ficha_id = excluded.ficha_id, quantidade = excluded.quantidade,
      valor_bruto = excluded.valor_bruto, descontos = excluded.descontos, cancelamentos = excluded.cancelamentos,
      tributos = excluded.tributos, comissao = excluded.comissao, taxa_pagamento = excluded.taxa_pagamento,
      entrega_subsidiada = excluded.entrega_subsidiada, promocoes = excluded.promocoes, outras_taxas = excluded.outras_taxas,
      -- repasse real informado pelo iFood não é apagado por uma estimativa
      repasse_liquido = case when mv.taxas_estimadas = false and excluded.taxas_estimadas then mv.repasse_liquido else excluded.repasse_liquido end,
      taxas_estimadas = mv.taxas_estimadas and excluded.taxas_estimadas,
      observacao = excluded.observacao;
    v_linhas := v_linhas + 1;
  end loop;

  -- linhas que o pedido não tem mais (itens alterados) ficam zeradas, não apagadas
  update public.marmitaria_vendas set quantidade = 0, valor_bruto = 0, descontos = 0, cancelamentos = 0,
         comissao = 0, taxa_pagamento = 0, entrega_subsidiada = 0, promocoes = 0, outras_taxas = 0,
         repasse_liquido = case when taxas_estimadas then null else repasse_liquido end,
         observacao = 'Item retirado do pedido'
   where unidade_id = v_unidade and fonte = 'ifood'
     and left(coalesce(referencia_externa, ''), length(v_prefixo)) = v_prefixo
     and not (referencia_externa = any (v_refs))
     and (quantidade <> 0 or valor_bruto <> 0);

  return jsonb_build_object('ok', true, 'pedido_id', v_row.id, 'status', v_row.status, 'linhas', v_linhas);
end $$;

revoke all on function public.delivery_gravar_pedido(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.delivery_gravar_pedido(jsonb, jsonb) to service_role;

-- ── 6. Baixa de estoque dos pedidos pela ficha (usuário logado) ───────────────
create or replace function public.marmitaria_baixar_pedidos(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unidade text := nullif(p_dados ->> 'unidade_id', '');
  v_p jsonb;
  v_m jsonb;
  v_ped public.delivery_pedidos;
  v_versao integer;
  v_res jsonb;
  v_movs integer := 0;
  v_pedidos integer := 0;
begin
  if auth.uid() is null then raise exception 'Faça login para dar baixa no estoque.'; end if;
  if v_unidade is null then raise exception 'Unidade não informada.' using errcode = '22023'; end if;
  if not (public.hefisto_ve_todas_unidades() or v_unidade = any (public.hefisto_unidades_do_usuario())) then
    raise exception 'Sem acesso a esta unidade.' using errcode = '42501';
  end if;

  for v_p in select value from jsonb_array_elements(coalesce(p_dados -> 'pedidos', '[]'::jsonb)) loop
    select * into v_ped from public.delivery_pedidos
     where id = (v_p ->> 'pedido_id')::uuid and unidade_id = v_unidade
     for update;
    if v_ped.id is null then raise exception 'Pedido não encontrado nesta unidade.' using errcode = '22023'; end if;
    v_versao := coalesce((v_p ->> 'versao')::integer, -1);
    if v_versao <> v_ped.estoque_versao then
      raise exception 'O pedido % mudou enquanto a tela estava aberta: atualize e tente de novo.', coalesce(v_ped.display_id, v_ped.pedido_externo_id)
        using errcode = '40001';
    end if;
    for v_m in select value from jsonb_array_elements(coalesce(v_p -> 'movimentos', '[]'::jsonb)) loop
      v_res := public.estoque_movimentar(
        p_unidade_id => v_unidade,
        p_estoque_id => (v_m ->> 'estoque_id')::uuid,
        p_insumo_id => (v_m ->> 'insumo_id')::uuid,
        p_tipo => v_m ->> 'tipo',
        p_motivo => case when v_m ->> 'tipo' = 'entrada' then 'devolucao' else 'consumo' end,
        p_quantidade => (v_m ->> 'quantidade')::numeric,
        p_observacao => 'Pedido ' || v_ped.canal || ' #' || coalesce(v_ped.display_id, v_ped.pedido_externo_id),
        p_chave => 'pedido:' || v_ped.id::text || ':' || (v_versao + 1)::text || ':' || (v_m ->> 'estoque_id') || ':' || (v_m ->> 'insumo_id') || ':' || (v_m ->> 'tipo'));
      if coalesce((v_res ->> 'ok')::boolean, false) is not true then
        raise exception 'Baixa recusada: %', coalesce(v_res ->> 'erro', 'motivo não informado') using errcode = '22023';
      end if;
      v_movs := v_movs + 1;
    end loop;
    update public.delivery_pedidos
       set estoque_aplicado = coalesce(v_p -> 'aplicado', '{}'::jsonb), estoque_versao = v_versao + 1,
           estoque_atualizado_em = now(), updated_at = now()
     where id = v_ped.id;
    v_pedidos := v_pedidos + 1;
  end loop;
  return jsonb_build_object('ok', true, 'pedidos', v_pedidos, 'movimentos', v_movs);
end $$;

revoke all on function public.marmitaria_baixar_pedidos(jsonb) from public, anon;
grant execute on function public.marmitaria_baixar_pedidos(jsonb) to authenticated;

commit;

-- Verificação (impressão digital): RLS e privilégios das tabelas novas
select c.relname, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
       has_table_privilege('anon', c.oid, 'select') as anon_le,
       has_table_privilege('authenticated', c.oid, 'insert') as authenticated_insere
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('delivery_pedidos', 'delivery_itens_mapeamento', 'delivery_repasses')
 order by 1;
