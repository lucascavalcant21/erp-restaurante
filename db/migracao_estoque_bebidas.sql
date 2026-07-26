-- ============================================================================
-- MIGRAÇÃO: Estoque de bebidas/embalados — saldo FECHADO x ABERTO
-- ----------------------------------------------------------------------------
-- Segurança: NÃO altera a função existente registrar_movimento_estoque_multi.
-- As funções novas REAPROVEITAM essa função (testada) para mexer no
-- quantidade_atual e gravar o histórico, e só gerenciam o split fechado/aberto.
-- Assim o total (quantidade_atual) e o split ficam sempre consistentes.
--
-- Convenção de saldos, por item de estoque (estoque_itens):
--   quantidade_atual = total em CONTEÚDO (ml/g/L/kg) — como já é hoje.
--   saldo_fechado    = nº de unidades comerciais fechadas (garrafas/latas...).
--   saldo_aberto     = conteúdo solto na embalagem aberta (ml/g...).
--   Invariante: quantidade_atual = saldo_fechado * conteudo + saldo_aberto.
--
-- Conteúdo por embalagem: usa insumos.tamanho_embalagem (já existente).
-- Rode em ambiente de teste antes de produção. Revise nomes de coluna.
-- ============================================================================

-- 1) COLUNAS NOVAS (aditivas, não destrutivas) -------------------------------
alter table estoque_itens add column if not exists saldo_fechado numeric not null default 0;
alter table estoque_itens add column if not exists saldo_aberto  numeric not null default 0;

alter table insumos add column if not exists unidade_comercial text;      -- garrafa, lata, caixa, pacote, fardo, barril, unidade, outro
alter table insumos add column if not exists unidade_conteudo  text;      -- ml, l, g, kg, unidade
alter table insumos add column if not exists permite_fracionado boolean not null default true;

-- 2) BACKFILL DOS SALDOS EXISTENTES ------------------------------------------
-- Converte o quantidade_atual atual em fechadas + aberto, sem perder nada.
-- Itens com conteúdo por embalagem > 1 (bebidas/embalados). Não fracionáveis
-- (permite_fracionado = false) ficam com tudo em fechadas e aberto = 0.
update estoque_itens ei
set
  saldo_fechado = floor(coalesce(ei.quantidade_atual,0) / nullif(i.tamanho_embalagem,0)),
  saldo_aberto  = case when coalesce(i.permite_fracionado,true)
                       then coalesce(ei.quantidade_atual,0) - floor(coalesce(ei.quantidade_atual,0) / nullif(i.tamanho_embalagem,0)) * i.tamanho_embalagem
                       else 0 end
from insumos i
where ei.insumo_id = i.id
  and coalesce(i.tamanho_embalagem,1) > 1;

-- Para produtos SEM embalagem fracionável (conteudo <= 1): fechadas = total.
update estoque_itens ei
set saldo_fechado = coalesce(ei.quantidade_atual,0), saldo_aberto = 0
from insumos i
where ei.insumo_id = i.id
  and coalesce(i.tamanho_embalagem,1) <= 1;

-- 3) HELPER: conteúdo por embalagem do insumo --------------------------------
create or replace function bebida_conteudo(p_insumo_id uuid)
returns numeric language sql stable as $$
  select greatest(coalesce((select tamanho_embalagem from insumos where id = p_insumo_id), 1), 0.000001);
$$;

-- 4) ENTRADA POR UNIDADE COMERCIAL -------------------------------------------
-- Ex.: +3 garrafas → saldo_fechado += 3 e quantidade_atual += 3 * conteudo.
create or replace function bebida_entrada_unidades(
  p_unidade_id  text,
  p_estoque_id  uuid,
  p_insumo_id   uuid,
  p_unidades    numeric,
  p_usuario_id  uuid   default null,
  p_usuario_nome text  default null,
  p_observacao  text   default null,
  p_data        timestamptz default now()
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item_id uuid;
begin
  if p_unidades is null or p_unidades <= 0 then raise exception 'Informe uma quantidade de unidades maior que zero.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select id into v_item_id from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if v_item_id is null then raise exception 'Item não vinculado a este estoque.'; end if;

  -- total + histórico via engine existente (entrada do equivalente em conteúdo)
  perform registrar_movimento_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_tipo := 'entrada', p_quantidade := p_unidades * v_conteudo,
    p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Entrada de ' || p_unidades || ' unidade(s)'),
    p_data_movimento := coalesce(p_data, now()));

  update estoque_itens set saldo_fechado = saldo_fechado + p_unidades where id = v_item_id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item_id;
end; $$;

-- 5) BAIXA POR UNIDADE (garrafa inteira descartada/transferida/consumida) -----
create or replace function bebida_baixa_unidades(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_unidades numeric,
  p_usuario_id uuid default null, p_usuario_nome text default null,
  p_observacao text default null, p_data timestamptz default now()
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item estoque_itens%rowtype;
begin
  if p_unidades is null or p_unidades <= 0 then raise exception 'Informe uma quantidade de unidades maior que zero.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select * into v_item from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if not found then raise exception 'Item não vinculado a este estoque.'; end if;
  if p_unidades > coalesce(v_item.saldo_fechado,0) + 1e-9 then
    raise exception 'Só há % unidade(s) fechada(s) disponível(is).', v_item.saldo_fechado;
  end if;

  perform registrar_movimento_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_tipo := 'saida', p_quantidade := p_unidades * v_conteudo,
    p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Baixa de ' || p_unidades || ' unidade(s) fechada(s)'),
    p_data_movimento := coalesce(p_data, now()));

  update estoque_itens set saldo_fechado = saldo_fechado - p_unidades where id = v_item.id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item.id;
end; $$;

-- 6) BAIXA POR CONTEÚDO (ml/g) — consome o aberto e abre garrafa se faltar ----
-- 1) consome o saldo aberto; 2) se faltar, abre quantas unidades forem
-- necessárias (fechado -1, aberto += conteudo por unidade); 3) consome; nunca
-- deixa saldo negativo. Retorna também quantas embalagens foram abertas.
create or replace function bebida_baixa_conteudo(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_qtd numeric,
  p_usuario_id uuid default null, p_usuario_nome text default null,
  p_observacao text default null, p_data timestamptz default now()
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric, abertas int)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item estoque_itens%rowtype; v_precisa numeric; v_abrir int := 0;
begin
  if p_qtd is null or p_qtd <= 0 then raise exception 'Informe uma quantidade maior que zero.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select * into v_item from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if not found then raise exception 'Item não vinculado a este estoque.'; end if;
  if p_qtd > coalesce(v_item.quantidade_atual,0) + 1e-9 then
    raise exception 'Saldo insuficiente: disponível %.', v_item.quantidade_atual;
  end if;

  -- abre embalagens fechadas se o aberto não cobre o pedido
  v_precisa := p_qtd - coalesce(v_item.saldo_aberto,0);
  if v_precisa > 1e-9 then
    v_abrir := ceil(v_precisa / v_conteudo);
    if v_abrir > coalesce(v_item.saldo_fechado,0) then
      raise exception 'Saldo insuficiente para abrir embalagem.';
    end if;
    update estoque_itens set saldo_fechado = saldo_fechado - v_abrir,
                             saldo_aberto  = saldo_aberto + v_abrir * v_conteudo
    where id = v_item.id;
  end if;

  -- consome do aberto e baixa o total (quantidade_atual) + histórico via engine
  update estoque_itens set saldo_aberto = saldo_aberto - p_qtd where id = v_item.id;
  perform registrar_movimento_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_tipo := 'saida', p_quantidade := p_qtd,
    p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Baixa fracionada' || case when v_abrir > 0 then ' (' || v_abrir || ' embalagem aberta automaticamente)' else '' end),
    p_data_movimento := coalesce(p_data, now()));

  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual, v_abrir from estoque_itens ei where ei.id = v_item.id;
end; $$;

-- 7) CONTAGEM COM DOIS CAMPOS (fechadas + aberto) ----------------------------
create or replace function bebida_contagem(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid,
  p_fechadas numeric, p_aberto numeric,
  p_usuario_id uuid default null, p_usuario_nome text default null, p_observacao text default null
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_conteudo numeric; v_item_id uuid; v_total numeric;
begin
  if p_fechadas < 0 or p_aberto < 0 then raise exception 'Contagem não pode ser negativa.'; end if;
  v_conteudo := bebida_conteudo(p_insumo_id);
  select id into v_item_id from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if v_item_id is null then raise exception 'Item não vinculado a este estoque.'; end if;
  v_total := p_fechadas * v_conteudo + p_aberto;

  -- ajusta o total + registra a divergência via engine de contagem existente
  perform registrar_contagem_estoque_multi(
    p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
    p_saldo_contado := v_total, p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
    p_observacao := coalesce(p_observacao, 'Contagem: ' || p_fechadas || ' fechadas + ' || p_aberto || ' aberto'));

  update estoque_itens set saldo_fechado = p_fechadas, saldo_aberto = p_aberto where id = v_item_id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item_id;
end; $$;

-- 8) ZERAR PRODUTO (com motivo obrigatório) ----------------------------------
create or replace function bebida_zerar(
  p_unidade_id text, p_estoque_id uuid, p_insumo_id uuid, p_motivo text,
  p_usuario_id uuid default null, p_usuario_nome text default null
) returns table(saldo_fechado numeric, saldo_aberto numeric, quantidade_atual numeric)
language plpgsql security definer as $$
declare v_item estoque_itens%rowtype;
begin
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Informe o motivo para zerar o produto.'; end if;
  select * into v_item from estoque_itens where estoque_id = p_estoque_id and insumo_id = p_insumo_id for update;
  if not found then raise exception 'Item não vinculado a este estoque.'; end if;
  if coalesce(v_item.quantidade_atual,0) > 0 then
    perform registrar_movimento_estoque_multi(
      p_unidade_id := p_unidade_id, p_estoque_id := p_estoque_id, p_insumo_id := p_insumo_id,
      p_tipo := 'saida', p_quantidade := v_item.quantidade_atual,
      p_usuario_id := p_usuario_id, p_usuario_nome := p_usuario_nome,
      p_observacao := 'Zerar produto — ' || p_motivo, p_data_movimento := now());
  end if;
  update estoque_itens set saldo_fechado = 0, saldo_aberto = 0 where id = v_item.id;
  return query select ei.saldo_fechado, ei.saldo_aberto, ei.quantidade_atual from estoque_itens ei where ei.id = v_item.id;
end; $$;

-- FIM. Após rodar, a tela passa a usar estas funções para itens fracionáveis.
