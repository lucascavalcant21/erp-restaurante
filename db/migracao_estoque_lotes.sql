-- ─────────────────────────────────────────────────────────────────────────────
-- LOTES POR VALIDADE NO ESTOQUE
--
-- Por que existe: hoje cada par (estoque, insumo) tem UMA validade em
-- estoque_itens. Ao repor um pré-preparo com outra data, a validade antiga era
-- sobrescrita e as duas fornadas viravam um saldo só, sem saber o que vence
-- primeiro. Este arquivo cria o lote: uma linha por validade.
--
-- Regra pedida: adicionar com uma validade nova cria um lote; adicionar com a
-- MESMA validade soma no lote que já existe.
--
-- Compatibilidade: estoque_itens.quantidade_atual continua sendo a verdade que
-- todas as telas leem — passa a ser a soma dos lotes, recalculada a cada
-- movimento. E estoque_itens.validade passa a refletir o lote que vence
-- primeiro, então os alertas de "validade próxima" continuam funcionando sem
-- que nenhuma tela precise mudar.
--
-- A saída consome FEFO: vence antes, sai antes. Lote sem validade sai por
-- último, porque não se sabe o prazo dele.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.estoque_lotes (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  text not null,          -- TEXTO: ids de unidade no ERP não são uuid
  estoque_id  uuid not null,
  insumo_id   uuid not null,
  validade    date,                   -- nulo = entrada sem prazo informado
  quantidade  numeric(14,3) not null default 0 check (quantidade >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Um lote por validade. Em Postgres dois NULL não colidem num índice único,
-- então o lote "sem validade" precisa de uma data sentinela para ser único.
create unique index if not exists idx_estoque_lotes_chave
  on public.estoque_lotes (estoque_id, insumo_id, coalesce(validade, 'infinity'::date));

create index if not exists idx_estoque_lotes_fefo
  on public.estoque_lotes (estoque_id, insumo_id, validade nulls last);

-- ── Backfill: o saldo que já existe vira o primeiro lote ────────────────────
-- Sem isto, o primeiro recálculo somaria zero lotes e apagaria o estoque
-- inteiro. Só roda para item que ainda não tem lote nenhum.
insert into public.estoque_lotes (unidade_id, estoque_id, insumo_id, validade, quantidade)
select i.unidade_id, i.estoque_id, i.insumo_id, i.validade, i.quantidade_atual
  from public.estoque_itens i
 where coalesce(i.quantidade_atual, 0) > 0
   and not exists (
     select 1 from public.estoque_lotes l
      where l.estoque_id = i.estoque_id and l.insumo_id = i.insumo_id
   )
on conflict do nothing;

-- ── Recalcula o item a partir dos lotes ─────────────────────────────────────
-- Um lugar só decide saldo e validade do item, para as duas coisas nunca
-- discordarem entre si.
create or replace function public.sincronizar_item_por_lotes(
  p_estoque_id uuid,
  p_insumo_id  uuid
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total numeric;
  v_prox  date;
begin
  delete from public.estoque_lotes
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id and quantidade <= 0;

  select coalesce(sum(quantidade), 0), min(validade)
    into v_total, v_prox
    from public.estoque_lotes
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id;

  update public.estoque_itens
     set quantidade_atual = v_total,
         validade         = v_prox,
         updated_at       = now()
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id;

  return v_total;
end;
$$;

-- ── Entrada num lote ────────────────────────────────────────────────────────
create or replace function public.entrada_lote_estoque(
  p_estoque_id uuid,
  p_insumo_id  uuid,
  p_unidade_id text,
  p_validade   date,
  p_quantidade numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Mesma validade soma no lote existente; validade nova cria outro.
  insert into public.estoque_lotes (unidade_id, estoque_id, insumo_id, validade, quantidade)
  values (p_unidade_id, p_estoque_id, p_insumo_id, p_validade, p_quantidade)
  on conflict (estoque_id, insumo_id, coalesce(validade, 'infinity'::date))
  do update set quantidade = public.estoque_lotes.quantidade + excluded.quantidade,
                updated_at = now();
end;
$$;

-- ── Saída FEFO ──────────────────────────────────────────────────────────────
create or replace function public.saida_lote_estoque(
  p_estoque_id uuid,
  p_insumo_id  uuid,
  p_quantidade numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resta numeric := p_quantidade;
  v_lote  record;
  v_tira  numeric;
begin
  -- Vence antes, sai antes. Sem validade sai por último: não dá para garantir
  -- que seja o mais velho, então não pode passar na frente de quem tem prazo.
  for v_lote in
    select id, quantidade from public.estoque_lotes
     where estoque_id = p_estoque_id and insumo_id = p_insumo_id and quantidade > 0
     order by validade asc nulls last, created_at asc
     for update
  loop
    exit when v_resta <= 0;
    v_tira := least(v_lote.quantidade, v_resta);
    update public.estoque_lotes
       set quantidade = quantidade - v_tira, updated_at = now()
     where id = v_lote.id;
    v_resta := v_resta - v_tira;
  end loop;

  -- Sobra significa saldo em estoque_itens que nenhum lote lastreava. Some no
  -- lote sem validade para o saldo do item não ficar maior que a soma real.
  if v_resta > 0 then
    insert into public.estoque_lotes (unidade_id, estoque_id, insumo_id, validade, quantidade)
    select unidade_id, p_estoque_id, p_insumo_id, null, 0
      from public.estoque_itens
     where estoque_id = p_estoque_id and insumo_id = p_insumo_id
    on conflict (estoque_id, insumo_id, coalesce(validade, 'infinity'::date)) do nothing;
  end if;
end;
$$;

-- ── Movimento com validade ──────────────────────────────────────────────────
-- Função nova, ao lado da antiga: a de 9 argumentos continua existindo para
-- quem chama sem validade, sem ambiguidade de sobrecarga.
create or replace function public.registrar_movimento_estoque_lote(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_validade date default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null,
  p_data_movimento timestamptz default now()
)
returns table(novo_saldo numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.estoque_itens%rowtype;
  v_novo numeric;
begin
  if p_tipo not in ('entrada', 'saida') or p_quantidade <= 0 then
    raise exception 'Movimentação inválida';
  end if;

  insert into public.estoque_itens (unidade_id, estoque_id, insumo_id)
  values (p_unidade_id, p_estoque_id, p_insumo_id)
  on conflict (estoque_id, insumo_id) do nothing;

  select * into v_item
    from public.estoque_itens
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id
   for update;

  if p_tipo = 'saida' and v_item.quantidade_atual < p_quantidade then
    raise exception 'Saldo insuficiente neste estoque';
  end if;

  if p_tipo = 'entrada' then
    perform public.entrada_lote_estoque(p_estoque_id, p_insumo_id, p_unidade_id, p_validade, p_quantidade);
  else
    perform public.saida_lote_estoque(p_estoque_id, p_insumo_id, p_quantidade);
  end if;

  v_novo := public.sincronizar_item_por_lotes(p_estoque_id, p_insumo_id);

  update public.estoque_itens
     set ultima_movimentacao_em = p_data_movimento
   where id = v_item.id;

  insert into public.estoque_movimentacoes_multi (
    unidade_id, estoque_id, insumo_id, tipo, quantidade,
    saldo_anterior, saldo_posterior, usuario_id, usuario_nome,
    observacao, data_movimento
  ) values (
    p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade,
    v_item.quantidade_atual, v_novo, p_usuario_id, p_usuario_nome,
    p_observacao, p_data_movimento
  );

  return query select v_novo;
end;
$$;

-- ── A função antiga passa a manter os lotes também ──────────────────────────
-- Sem isto, movimento feito por qualquer outra tela mexeria no saldo do item
-- sem tocar nos lotes, e os dois números divergiriam em silêncio. A assinatura
-- não muda: quem já chama continua chamando igual.
create or replace function public.registrar_movimento_estoque_multi(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null,
  p_data_movimento timestamptz default now()
)
returns table(novo_saldo numeric)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query select * from public.registrar_movimento_estoque_lote(
    p_unidade_id, p_estoque_id, p_insumo_id, p_tipo, p_quantidade,
    null, p_usuario_id, p_usuario_nome, p_observacao, p_data_movimento
  );
end;
$$;

-- ── Contagem: acerta os lotes contra o saldo contado ────────────────────────
-- Faltando, tira FEFO. Sobrando, a diferença entra no lote sem validade — quem
-- contou não disse de qual fornada era a sobra.
create or replace function public.sincronizar_lotes_apos_contagem(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id  uuid,
  p_saldo_contado numeric
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lotes numeric;
begin
  select coalesce(sum(quantidade), 0) into v_lotes
    from public.estoque_lotes
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id;

  if p_saldo_contado > v_lotes then
    perform public.entrada_lote_estoque(p_estoque_id, p_insumo_id, p_unidade_id, null, p_saldo_contado - v_lotes);
  elsif p_saldo_contado < v_lotes then
    perform public.saida_lote_estoque(p_estoque_id, p_insumo_id, v_lotes - p_saldo_contado);
  end if;

  return public.sincronizar_item_por_lotes(p_estoque_id, p_insumo_id);
end;
$$;

alter table public.estoque_lotes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'estoque_lotes' and policyname = 'estoque_lotes_all'
  ) then
    create policy estoque_lotes_all on public.estoque_lotes for all using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.estoque_lotes to authenticated;
grant execute on function public.sincronizar_item_por_lotes(uuid, uuid) to authenticated;
grant execute on function public.entrada_lote_estoque(uuid, uuid, text, date, numeric) to authenticated;
grant execute on function public.saida_lote_estoque(uuid, uuid, numeric) to authenticated;
grant execute on function public.registrar_movimento_estoque_lote(text, uuid, uuid, text, numeric, date, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.sincronizar_lotes_apos_contagem(text, uuid, uuid, numeric) to authenticated;

-- O PostgREST guarda o desenho em cache; sem isto a tabela e as funções novas
-- continuam respondendo "Could not find" logo depois da migração.
notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONTAGEM E TRANSFERÊNCIA TAMBÉM PRECISAM CONHECER LOTE
--
-- As duas mexiam em quantidade_atual direto. Depois dos lotes, isso faria o
-- saldo do item discordar da soma dos lotes em silêncio — que é justamente o
-- que esta migração existe para impedir.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Contagem ────────────────────────────────────────────────────────────────
-- O saldo contado passa a ser aplicado nos lotes: faltando, tira FEFO;
-- sobrando, a diferença entra no lote sem validade, porque quem contou não
-- disse de qual fornada era a sobra. A assinatura não muda.
create or replace function public.registrar_contagem_estoque_multi(
  p_unidade_id text,
  p_estoque_id uuid,
  p_insumo_id uuid,
  p_saldo_contado numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null
)
returns table(novo_saldo numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.estoque_itens%rowtype;
  v_anterior numeric;
  v_novo numeric;
begin
  if p_saldo_contado < 0 then raise exception 'Saldo contado inválido'; end if;

  insert into public.estoque_itens (unidade_id, estoque_id, insumo_id)
  values (p_unidade_id, p_estoque_id, p_insumo_id)
  on conflict (estoque_id, insumo_id) do nothing;

  select * into v_item
    from public.estoque_itens
   where estoque_id = p_estoque_id and insumo_id = p_insumo_id
   for update;

  -- Guardado antes do acerto: depois dele o valor antigo já não existe.
  v_anterior := coalesce(v_item.quantidade_atual, 0);

  v_novo := public.sincronizar_lotes_apos_contagem(
    p_unidade_id, p_estoque_id, p_insumo_id, p_saldo_contado
  );

  update public.estoque_itens
     set ultima_movimentacao_em = now()
   where id = v_item.id;

  insert into public.estoque_movimentacoes_multi (
    unidade_id, estoque_id, insumo_id, tipo, quantidade,
    saldo_anterior, saldo_posterior, usuario_id, usuario_nome,
    observacao, data_movimento
  ) values (
    p_unidade_id, p_estoque_id, p_insumo_id, 'contagem',
    v_novo - v_anterior, v_anterior, v_novo,
    p_usuario_id, p_usuario_nome, p_observacao, now()
  );

  return query select v_novo;
end;
$$;

-- ── Transferência leva a validade junto ─────────────────────────────────────
-- Mover só a quantidade faria o destino receber mercadoria sem prazo e a
-- origem perder o controle de qual fornada saiu. Cada pedaço tirado da origem
-- entra no destino com a MESMA validade.
create or replace function public.transferir_lotes_estoque(
  p_unidade_id text,
  p_estoque_origem_id uuid,
  p_estoque_destino_id uuid,
  p_insumo_id uuid,
  p_quantidade numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_resta numeric := p_quantidade;
  v_lote  record;
  v_leva  numeric;
begin
  for v_lote in
    select id, validade, quantidade from public.estoque_lotes
     where estoque_id = p_estoque_origem_id and insumo_id = p_insumo_id and quantidade > 0
     order by validade asc nulls last, created_at asc
     for update
  loop
    exit when v_resta <= 0;
    v_leva := least(v_lote.quantidade, v_resta);

    update public.estoque_lotes
       set quantidade = quantidade - v_leva, updated_at = now()
     where id = v_lote.id;

    perform public.entrada_lote_estoque(
      p_estoque_destino_id, p_insumo_id, p_unidade_id, v_lote.validade, v_leva
    );

    v_resta := v_resta - v_leva;
  end loop;

  -- Saldo que nenhum lote lastreava (estoque anterior aos lotes) viaja sem
  -- prazo, em vez de sumir na transferência.
  if v_resta > 0 then
    perform public.entrada_lote_estoque(
      p_estoque_destino_id, p_insumo_id, p_unidade_id, null, v_resta
    );
  end if;
end;
$$;

create or replace function public.transferir_item_entre_estoques(
  p_unidade_id text,
  p_estoque_origem_id uuid,
  p_estoque_destino_id uuid,
  p_insumo_id uuid,
  p_quantidade numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null,
  p_observacao text default null
)
returns table(saldo_origem numeric, saldo_destino numeric)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_origem public.estoque_itens%rowtype;
  v_destino public.estoque_itens%rowtype;
  v_tipo_origem text;
  v_tipo_destino text;
  v_transferencia uuid := gen_random_uuid();
  v_ant_origem numeric;
  v_ant_destino numeric;
  v_novo_origem numeric;
  v_novo_destino numeric;
begin
  if p_estoque_origem_id = p_estoque_destino_id or p_quantidade <= 0 then
    raise exception 'Transferência inválida';
  end if;

  select tipo into v_tipo_origem from public.estoques where id = p_estoque_origem_id and unidade_id = p_unidade_id and status = 'ativo';
  select tipo into v_tipo_destino from public.estoques where id = p_estoque_destino_id and unidade_id = p_unidade_id and status = 'ativo';
  if v_tipo_origem is null or v_tipo_destino is null then raise exception 'Estoque inválido'; end if;
  if v_tipo_origem <> v_tipo_destino
     and not (v_tipo_origem in ('alimentos', 'bebidas') and v_tipo_destino in ('alimentos', 'bebidas')) then
    raise exception 'Tipos de estoque incompatíveis';
  end if;

  select * into v_origem
    from public.estoque_itens
   where estoque_id = p_estoque_origem_id and insumo_id = p_insumo_id
   for update;
  if v_origem.id is null or not v_origem.permite_transferencia then raise exception 'Item não transferível'; end if;
  if v_origem.quantidade_atual < p_quantidade then raise exception 'Saldo insuficiente no estoque de origem'; end if;

  insert into public.estoque_itens (
    unidade_id, estoque_id, insumo_id, quantidade_atual,
    estoque_minimo, estoque_maximo, custo_unitario, permite_transferencia
  ) values (
    p_unidade_id, p_estoque_destino_id, p_insumo_id, 0,
    v_origem.estoque_minimo, v_origem.estoque_maximo,
    v_origem.custo_unitario, v_origem.permite_transferencia
  )
  on conflict (estoque_id, insumo_id) do nothing;

  select * into v_destino
    from public.estoque_itens
   where estoque_id = p_estoque_destino_id and insumo_id = p_insumo_id
   for update;

  v_ant_origem  := coalesce(v_origem.quantidade_atual, 0);
  v_ant_destino := coalesce(v_destino.quantidade_atual, 0);

  perform public.transferir_lotes_estoque(
    p_unidade_id, p_estoque_origem_id, p_estoque_destino_id, p_insumo_id, p_quantidade
  );

  v_novo_origem  := public.sincronizar_item_por_lotes(p_estoque_origem_id, p_insumo_id);
  v_novo_destino := public.sincronizar_item_por_lotes(p_estoque_destino_id, p_insumo_id);

  update public.estoque_itens set ultima_movimentacao_em = now() where id in (v_origem.id, v_destino.id);

  insert into public.estoque_movimentacoes_multi (
    transferencia_id, unidade_id, estoque_id, estoque_destino_id,
    insumo_id, tipo, quantidade, saldo_anterior, saldo_posterior,
    usuario_id, usuario_nome, observacao
  ) values
  (
    v_transferencia, p_unidade_id, p_estoque_origem_id, p_estoque_destino_id,
    p_insumo_id, 'transferencia_saida', p_quantidade,
    v_ant_origem, v_novo_origem,
    p_usuario_id, p_usuario_nome, p_observacao
  ),
  (
    v_transferencia, p_unidade_id, p_estoque_destino_id, p_estoque_origem_id,
    p_insumo_id, 'transferencia_entrada', p_quantidade,
    v_ant_destino, v_novo_destino,
    p_usuario_id, p_usuario_nome, p_observacao
  );

  return query select v_novo_origem, v_novo_destino;
end;
$$;

grant execute on function public.transferir_lotes_estoque(text, uuid, uuid, uuid, numeric) to authenticated;
grant execute on function public.registrar_contagem_estoque_multi(text, uuid, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.transferir_item_entre_estoques(text, uuid, uuid, uuid, numeric, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
