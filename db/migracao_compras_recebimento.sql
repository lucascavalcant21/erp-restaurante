-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: MÓDULO DE COMPRAS, RECEBIMENTO DE MERCADORIAS E DEVOLUÇÕES INTEGRADO
-- ERP HÉFISTO — Execução Atômica, Lotes, Custo Cascata e Contas a Pagar
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. TABELA DE PEDIDOS DE COMPRA
create table if not exists pedidos_compra (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            uuid not null,
  fornecedor_id         uuid references fornecedores(id) on delete set null,
  numero_pedido         text not null,
  status                text not null default 'RASCUNHO' check (status in ('RASCUNHO', 'ENVIADO', 'PARCIAL', 'RECEBIDO', 'CANCELADO')),
  valor_total_estimado  numeric not null default 0,
  valor_total_real      numeric not null default 0,
  observacoes           text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- 2. ITENS DO PEDIDO DE COMPRA
create table if not exists pedidos_compra_itens (
  id                            uuid primary key default gen_random_uuid(),
  pedido_id                     uuid not null references pedidos_compra(id) on delete cascade,
  insumo_id                     uuid not null references insumos(id) on delete cascade,
  quantidade_pedida_embalagem   numeric not null default 1,
  quantidade_pedida_base        numeric not null default 1,
  unidade_embalagem             text,
  preco_unitario_estimado       numeric not null default 0,
  valor_total_estimado          numeric not null default 0,
  quantidade_recebida_embalagem numeric not null default 0,
  status_item                   text not null default 'PENDENTE' check (status_item in ('PENDENTE', 'PARCIAL', 'ENTREGUE', 'CANCELADO')),
  created_at                    timestamptz default now()
);

-- 3. TABELA DE RECEBIMENTOS DE MERCADORIA
create table if not exists recebimentos_compra (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            uuid not null,
  pedido_id             uuid references pedidos_compra(id) on delete set null,
  fornecedor_id         uuid references fornecedores(id) on delete set null,
  numero_nota_fiscal    text,
  data_recebimento      timestamptz default now(),
  valor_total_nota      numeric not null default 0,
  divergencia_detectada boolean not null default false,
  observacoes           text,
  comprovante_url       text,
  chave_idempotencia    text unique,
  created_at            timestamptz default now()
);

-- 4. ITENS DO RECEBIMENTO DE MERCADORIA
create table if not exists recebimentos_compra_itens (
  id                            uuid primary key default gen_random_uuid(),
  recebimento_id                uuid not null references recebimentos_compra(id) on delete cascade,
  insumo_id                     uuid not null references insumos(id) on delete cascade,
  quantidade_recebida_embalagem numeric not null default 1,
  tamanho_embalagem             numeric not null default 1,
  quantidade_recebida_base      numeric not null default 1,
  unidade_medida                text,
  preco_unitario_pago           numeric not null default 0,
  valor_total_item              numeric not null default 0,
  preco_esperado                numeric default 0,
  divergencia_preco_pct         numeric default 0,
  numero_lote                   text,
  data_validade                 date,
  departamento_destino          text default 'cozinha',
  created_at                    timestamptz default now()
);

-- 5. TABELA DE DEVOLUÇÕES AO FORNECEDOR
create table if not exists devolucoes_fornecedor (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            uuid not null,
  recebimento_id        uuid references recebimentos_compra(id) on delete set null,
  fornecedor_id         uuid references fornecedores(id) on delete set null,
  motivo                text not null,
  valor_total_devolucao numeric not null default 0,
  status                text not null default 'CONCLUIDO' check (status in ('PENDENTE', 'CONCLUIDO', 'CANCELADO')),
  created_at            timestamptz default now()
);

create table if not exists devolucoes_fornecedor_itens (
  id                        uuid primary key default gen_random_uuid(),
  devolucao_id              uuid not null references devolucoes_fornecedor(id) on delete cascade,
  insumo_id                 uuid not null references insumos(id) on delete cascade,
  quantidade_devolvida_base numeric not null default 1,
  valor_unitario            numeric not null default 0,
  motivo_item               text,
  created_at                timestamptz default now()
);

-- ÍNDICES DE DESEMPENHO
create index if not exists idx_pedidos_compra_unid on pedidos_compra(unidade_id);
create index if not exists idx_pedidos_compra_forn on pedidos_compra(fornecedor_id);
create index if not exists idx_recebimentos_unid   on recebimentos_compra(unidade_id);
create index if not exists idx_recebimentos_ped    on recebimentos_compra(pedido_id);

-- POLÍTICAS RLS
alter table pedidos_compra enable row level security;
alter table pedidos_compra_itens enable row level security;
alter table recebimentos_compra enable row level security;
alter table recebimentos_compra_itens enable row level security;
alter table devolucoes_fornecedor enable row level security;
alter table devolucoes_fornecedor_itens enable row level security;

drop policy if exists "auth_all_pedidos_compra" on pedidos_compra;
create policy "auth_all_pedidos_compra" on pedidos_compra for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_pedidos_compra_itens" on pedidos_compra_itens;
create policy "auth_all_pedidos_compra_itens" on pedidos_compra_itens for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_recebimentos_compra" on recebimentos_compra;
create policy "auth_all_recebimentos_compra" on recebimentos_compra for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_recebimentos_compra_itens" on recebimentos_compra_itens;
create policy "auth_all_recebimentos_compra_itens" on recebimentos_compra_itens for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_devolucoes_fornecedor" on devolucoes_fornecedor;
create policy "auth_all_devolucoes_fornecedor" on devolucoes_fornecedor for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_devolucoes_fornecedor_itens" on devolucoes_fornecedor_itens;
create policy "auth_all_devolucoes_fornecedor_itens" on devolucoes_fornecedor_itens for all to authenticated using (true) with check (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- RPC ATÔMICA: CONSOLIDAÇÃO INTEGRADA DE RECEBIMENTO DE COMPRAS
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function confirmar_recebimento_integrado(
  p_unidade_id          uuid,
  p_pedido_id           uuid default null,
  p_fornecedor_id       uuid default null,
  p_numero_nf           text default null,
  p_comprovante_url     text default null,
  p_itens               jsonb default '[]'::jsonb,
  p_chave_idempotencia  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recebimento_id      uuid;
  v_item                jsonb;
  v_insumo_id           uuid;
  v_qtd_emb             numeric;
  v_tam_emb             numeric;
  v_qtd_base            numeric;
  v_preco_pago          numeric;
  v_preco_esp           numeric;
  v_val_total_item      numeric;
  v_div_pct             numeric := 0;
  v_lote                text;
  v_validade            date;
  v_dept                text;
  v_insumo_nome         text;
  v_forn_nome           text := '';
  v_total_nota          numeric := 0;
  v_has_divergencia     boolean := false;
  v_saldo_ant           numeric;
  v_saldo_pos           numeric;
  v_preco_norm_novo     numeric;
  v_preco_norm_ant      numeric;
  v_conta_id            uuid;
  v_itens_processados   integer := 0;
begin
  -- 1. Proteção de Idempotência
  if p_chave_idempotencia is not null and p_chave_idempotencia <> '' then
    select id into v_recebimento_id
    from recebimentos_compra
    where chave_idempotencia = p_chave_idempotencia;

    if v_recebimento_id is not null then
      return jsonb_build_object(
        'success', true,
        'idempotente', true,
        'recebimento_id', v_recebimento_id,
        'mensagem', 'Recebimento já processado anteriormente.'
      );
    end if;
  end if;

  -- 2. Nome do Fornecedor (se informado)
  if p_fornecedor_id is not null then
    select nome into v_forn_nome from fornecedores where id = p_fornecedor_id;
  end if;

  -- 3. Criação do Cabeçalho de Recebimento
  insert into recebimentos_compra (
    unidade_id, pedido_id, fornecedor_id, numero_nota_fiscal,
    data_recebimento, valor_total_nota, divergencia_detectada,
    comprovante_url, chave_idempotencia
  ) values (
    p_unidade_id, p_pedido_id, p_fornecedor_id, p_numero_nf,
    now(), 0, false, p_comprovante_url, p_chave_idempotencia
  ) returning id into v_recebimento_id;

  -- 4. Processamento de Itens
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_insumo_id     := (v_item->>'insumo_id')::uuid;
    v_qtd_emb       := coalesce((v_item->>'quantidade_embalagem')::numeric, 1);
    v_tam_emb       := coalesce((v_item->>'tamanho_embalagem')::numeric, 1);
    v_preco_pago    := coalesce((v_item->>'preco_pago')::numeric, 0);
    v_preco_esp     := coalesce((v_item->>'preco_esperado')::numeric, v_preco_pago);
    v_lote          := v_item->>'lote';
    v_validade      := case when (v_item->>'validade') is not null and (v_item->>'validade') <> '' then (v_item->>'validade')::date else null end;
    v_dept          := coalesce(v_item->>'departamento', 'cozinha');

    v_qtd_base       := v_qtd_emb * v_tam_emb;
    v_val_total_item := v_qtd_emb * v_preco_pago;
    v_total_nota     := v_total_nota + v_val_total_item;

    -- Cálculo de Divergência de Preço
    if v_preco_esp > 0 and abs(v_preco_pago - v_preco_esp) > 0.01 then
      v_div_pct := ((v_preco_pago - v_preco_esp) / v_preco_esp) * 100;
      if abs(v_div_pct) >= 5 then
        v_has_divergencia := true;
      end if;
    else
      v_div_pct := 0;
    end if;

    -- Inserir Item do Recebimento
    insert into recebimentos_compra_itens (
      recebimento_id, insumo_id, quantidade_recebida_embalagem,
      tamanho_embalagem, quantidade_recebida_base, preco_unitario_pago,
      valor_total_item, preco_esperado, divergencia_preco_pct,
      numero_lote, data_validade, departamento_destino
    ) values (
      v_recebimento_id, v_insumo_id, v_qtd_emb,
      v_tam_emb, v_qtd_base, v_preco_pago,
      v_val_total_item, v_preco_esp, v_div_pct,
      v_lote, v_validade, v_dept
    );

    -- Atualizar Saldo de Estoque
    select coalesce(quantidade_atual, 0) into v_saldo_ant
    from estoque_atual
    where unidade_id = p_unidade_id and insumo_id = v_insumo_id;

    if v_saldo_ant is null then v_saldo_ant := 0; end if;
    v_saldo_pos := v_saldo_ant + v_qtd_base;

    insert into estoque_atual (unidade_id, insumo_id, quantidade_atual, updated_at)
    values (p_unidade_id, v_insumo_id, v_saldo_pos, now())
    on conflict (unidade_id, insumo_id)
    do update set quantidade_atual = v_saldo_pos, updated_at = now();

    -- Registrar Movimentação em estoque_movimentos
    insert into estoque_movimentos (
      unidade_id, insumo_id, departamento, tipo,
      quantidade_unidades, conteudo_por_unidade, quantidade_base,
      saldo_anterior, saldo_posterior, responsavel, motivo, data_movimento
    ) values (
      p_unidade_id, v_insumo_id, v_dept, 'entrada',
      v_qtd_emb, v_tam_emb, v_qtd_base,
      v_saldo_ant, v_saldo_pos, 'Recebimento de Mercadoria',
      coalesce('NF ' || p_numero_nf, 'Entrada via Recebimento'), now()
    );

    -- Registrar Lote se informado
    if v_lote is not null and v_lote <> '' then
      insert into estoque_lotes (
        unidade_id, insumo_id, quantidade_inicial, quantidade_atual,
        numero_lote, data_validade, setor, created_at
      ) values (
        p_unidade_id, v_insumo_id, v_qtd_base, v_qtd_base,
        v_lote, v_validade, v_dept, now()
      );
    end if;

    -- Atualizar Preço do Insumo e Histórico
    select nome, preco_normalizado into v_insumo_nome, v_preco_norm_ant
    from insumos where id = v_insumo_id;

    v_preco_norm_novo := case when v_tam_emb > 0 then v_preco_pago / v_tam_emb else v_preco_pago end;

    update insumos set
      custo_compra = v_preco_pago,
      tamanho_embalagem = v_tam_emb,
      custo_unitario = v_preco_norm_novo,
      preco_normalizado = v_preco_norm_novo,
      fornecedor_atual_id = coalesce(p_fornecedor_id, fornecedor_atual_id),
      preco_atualizado_em = now()
    where id = v_insumo_id;

    -- Registrar no histórico se alterou preço
    if v_preco_norm_ant is null or abs(v_preco_norm_novo - v_preco_norm_ant) > 0.0001 then
      insert into insumos_precos_historico (
        unidade_id, insumo_id, insumo_nome, fornecedor_id, fornecedor_nome,
        valor_anterior, valor_novo, preco_normalizado_anterior, preco_normalizado_novo,
        diferenca_valor, diferenca_percentual, origem, usuario_nome
      ) values (
        p_unidade_id, v_insumo_id, v_insumo_nome, p_fornecedor_id, v_forn_nome,
        v_preco_norm_ant * v_tam_emb, v_preco_pago, v_preco_norm_ant, v_preco_norm_novo,
        v_preco_norm_novo - coalesce(v_preco_norm_ant, 0),
        case when v_preco_norm_ant > 0 then ((v_preco_norm_novo - v_preco_norm_ant) / v_preco_norm_ant) * 100 else 0 end,
        'Recebimento de Compra', 'Sistema ERP'
      );
    end if;

    -- Atualizar item do pedido de origem (se houver)
    if p_pedido_id is not null then
      update pedidos_compra_itens set
        quantidade_recebida_embalagem = quantidade_recebida_embalagem + v_qtd_emb,
        status_item = case
          when (quantidade_recebida_embalagem + v_qtd_emb) >= quantidade_pedida_embalagem then 'ENTREGUE'
          else 'PARCIAL'
        end
      where pedido_id = p_pedido_id and insumo_id = v_insumo_id;
    end if;

    v_itens_processados := v_itens_processados + 1;
  end loop;

  -- 5. Atualizar Valor Total e Divergência no Cabeçalho
  update recebimentos_compra set
    valor_total_nota = v_total_nota,
    divergencia_detectada = v_has_divergencia
  where id = v_recebimento_id;

  -- 6. Atualizar Status do Pedido de Origem
  if p_pedido_id is not null then
    update pedidos_compra set
      status = case
        when not exists (select 1 from pedidos_compra_itens where pedido_id = p_pedido_id and status_item <> 'ENTREGUE') then 'RECEBIDO'
        else 'PARCIAL'
      end,
      valor_total_real = valor_total_real + v_total_nota,
      updated_at = now()
    where id = p_pedido_id;
  end if;

  -- 7. Lançamento Automático em Contas a Pagar (Financeiro)
  if v_total_nota > 0 then
    insert into contas_pagar (
      unidade_id, descricao, valor, data_vencimento, categoria, status
    ) values (
      p_unidade_id,
      'Recebimento Compra NF: ' || coalesce(p_numero_nf, 'S/N') || case when v_forn_nome <> '' then ' (' || v_forn_nome || ')' else '' end,
      v_total_nota,
      (now() + interval '30 days')::date,
      'cmv',
      'pendente'
    ) returning id into v_conta_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'recebimento_id', v_recebimento_id,
    'valor_total', v_total_nota,
    'itens_processados', v_itens_processados,
    'divergencia_detectada', v_has_divergencia,
    'conta_pagar_id', v_conta_id
  );
end;
$$;
