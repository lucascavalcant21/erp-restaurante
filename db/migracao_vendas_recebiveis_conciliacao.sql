-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: MÓDULO INTEGRADO DE VENDAS, RECEBÍVEIS E CONCILIAÇÃO FINANCEIRA (V2)
-- ERP HÉFISTO — Arquitetura de Entrada de Dinheiro, Split, Conciliação N:1 e Adquirentes
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. ADICIONAR COLUNAS ESTRUTURADAS EM vendas (PRESERVANDO DADOS EXISTENTES)
alter table vendas add column if not exists empresa_id               uuid;
alter table vendas add column if not exists codigo_venda            text;
alter table vendas add column if not exists canal_venda             text default 'SALAO';
alter table vendas add column if not exists origem                  text default 'NATIVA'; -- 'NATIVA', 'SAIPOS_CSV', 'IFOOD_FILE', 'PDV'
alter table vendas add column if not exists origem_externa          text;
alter table vendas add column if not exists id_externo              text;
alter table vendas add column if not exists pedido_id               uuid references pedidos(id) on delete set null;
alter table vendas add column if not exists mesa_numero             text;
alter table vendas add column if not exists comanda_numero          text;
alter table vendas add column if not exists data_venda              date default current_date;
alter table vendas add column if not exists data_operacional        date default current_date;

-- Taxa de Serviço Decomposta
alter table vendas add column if not exists taxa_servico_cobrada      numeric default 0;
alter table vendas add column if not exists taxa_servico_destinada_equipe numeric default 0;
alter table vendas add column if not exists taxa_servico_retida_empresa   numeric default 0;

-- Deduções e Impostos
alter table vendas add column if not exists comissao_marketplace    numeric default 0;
alter table vendas add column if not exists impostos_venda          numeric default 0;
alter table vendas add column if not exists impostos_retidos_origem numeric default 0;

-- CMV e Valores
alter table vendas add column if not exists valor_bruto             numeric default 0;
alter table vendas add column if not exists valor_final             numeric default 0;
alter table vendas add column if not exists valor_liquido_esperado  numeric default 0;
alter table vendas add column if not exists cmv_teorico             numeric default 0;

-- Idempotência
alter table vendas add column if not exists chave_idempotencia      text unique;
alter table vendas add column if not exists observacao              text;

-- 2. TABELA DE SPLIT DE PAGAMENTOS DA VENDA (venda_pagamentos)
create table if not exists venda_pagamentos (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            uuid not null,
  venda_id            uuid not null references vendas(id) on delete cascade,
  forma_pagamento       text not null default 'PIX', -- 'DINHEIRO', 'PIX', 'DEBITO', 'CREDITO_AVISTA', 'CREDITO_PARCELADO', 'IFOOD_ONLINE', 'VOUCHER', 'CORTESIA'
  adquirente_nome       text default 'DIRETO',
  nsu_autorizacao       text,
  parcelas              integer default 1,
  valor                 numeric not null default 0,
  taxa_percentual       numeric default 0,
  taxa_valor            numeric default 0,
  comissao_percentual   numeric default 0,
  comissao_valor        numeric default 0,
  retencao_fiscal       numeric default 0,
  created_at            timestamptz default now()
);

-- 3. TABELA DE CONFIGURAÇÕES DE ADQUIRENTES E MARKETPLACES (regras_recebimento)
create table if not exists configuracoes_adquirentes (
  id                          uuid primary key default gen_random_uuid(),
  unidade_id                  uuid not null,
  adquirente_nome             text not null, -- 'STONE', 'CIELO', 'REDE', 'PAGSEGURO', 'IFOOD', 'MERCADOPAGO'
  canal_venda                 text default 'TODOS',
  forma_pagamento             text not null,
  taxa_debito                 numeric default 1.8,
  taxa_credito_avista         numeric default 2.8,
  taxa_credito_parcelado_base numeric default 3.8,
  taxa_parcela_adicional      numeric default 1.0,
  taxa_ifood                  numeric default 15.0,
  dias_repasse_debito         integer default 1,
  dias_repasse_credito        integer default 30,
  dias_repasse_pix            integer default 0,
  dias_repasse_ifood          integer default 7,
  conta_financeira_id         uuid references contas_financeiras(id) on delete set null,
  ativo                       boolean default true,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

-- 4. TABELA DE LOTES DE REPASSES (CONCILIAÇÃO 1:N E N:1)
create table if not exists lotes_repasses (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            uuid not null,
  adquirente_nome       text not null,
  codigo_lote           text,
  data_repasse          date not null default current_date,
  quantidade_titulos    integer default 1,
  valor_bruto_total     numeric default 0,
  taxas_totais          numeric default 0,
  valor_liquido_total   numeric default 0,
  valor_depositado_banco numeric default 0,
  diferenca             numeric default 0,
  conta_financeira_id   uuid references contas_financeiras(id) on delete set null,
  status                text default 'PREVISTO' check (status in ('PREVISTO', 'CONCILIADO', 'DIVERGENTE', 'CANCELADO')),
  created_at            timestamptz default now()
);

-- 5. TABELA DE CONTAS A RECEBER (EXPANDIDA COM RASTREABILIDADE RIGOROSA)
create table if not exists contas_receber (
  id                          uuid primary key default gen_random_uuid(),
  unidade_id                  uuid not null,
  venda_id                    uuid references vendas(id) on delete cascade,
  venda_pagamento_id          uuid references venda_pagamentos(id) on delete cascade,
  lote_repasse_id             uuid references lotes_repasses(id) on delete set null,
  codigo_venda                text,
  canal_venda                 text not null default 'SALAO',
  forma_pagamento             text not null default 'PIX',
  adquirente_nome             text default 'DIRETO',
  marketplace_nome            text,
  nsu_autorizacao             text,
  parcela_numero              integer default 1,
  total_parcelas              integer default 1,
  valor_bruto                 numeric not null default 0,
  taxa_percentual             numeric not null default 0,
  taxa_valor                  numeric not null default 0,
  comissao_marketplace_valor  numeric not null default 0,
  retencao_fiscal             numeric not null default 0,
  valor_liquido_esperado      numeric not null default 0,
  valor_recebido              numeric not null default 0,
  data_venda                  date not null default current_date,
  data_prevista_repasse       date not null default current_date,
  data_real_repasse           date,
  conta_financeira_id         uuid references contas_financeiras(id) on delete set null,
  status                      text not null default 'PREVISTO' check (status in ('PREVISTO', 'RECEBIDO', 'DIVERGENTE', 'CANCELADO')),
  motivo_divergencia          text, -- 'TAXA_DIFERENTE', 'CHARGEBACK', 'AJUSTE_ADQUIRENTE', 'ANTECIPACAO', 'ERRO_IMPORTACAO', 'OUTRO'
  justificativa_divergencia   text,
  usuario_justificativa_id    uuid,
  chave_idempotencia          text unique,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

-- 6. TABELA DE CONCILIAÇÃO FINANCEIRA (DETALHAMENTO DE AUDITORIA)
create table if not exists conciliacao_financeira (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            uuid not null,
  conta_receber_id      uuid references contas_receber(id) on delete set null,
  lote_repasse_id       uuid references lotes_repasses(id) on delete set null,
  conta_financeira_id   uuid references contas_financeiras(id) on delete set null,
  valor_esperado        numeric not null default 0,
  valor_depositado      numeric not null default 0,
  diferenca_taxa        numeric not null default 0,
  tolerancia_aplicada   numeric default 0.01,
  status_conciliacao    text not null default 'CONCILIADO_OK' check (status_conciliacao in ('CONCILIADO_OK', 'CONCILIADO_COM_DIVERGENCIA', 'REJEITADO')),
  motivo_divergencia    text,
  justificativa         text,
  data_conciliacao      timestamptz default now(),
  usuario_id            uuid,
  usuario_nome          text,
  created_at            timestamptz default now()
);

-- ÍNDICES DE ALTA PERFORMANCE
create index if not exists idx_vendas_unid_data      on vendas(unidade_id, data_venda);
create index if not exists idx_vendas_origem_ext     on vendas(origem, id_externo);
create index if not exists idx_venda_pag_venda       on venda_pagamentos(venda_id);
create index if not exists idx_contas_rec_unid_status on contas_receber(unidade_id, status);
create index if not exists idx_contas_rec_prev       on contas_receber(data_prevista_repasse);
create index if not exists idx_contas_rec_lote       on contas_receber(lote_repasse_id);
create index if not exists idx_conciliacao_lote      on conciliacao_financeira(lote_repasse_id);

-- POLÍTICAS RLS DE SEGURANÇA
alter table venda_pagamentos enable row level security;
alter table configuracoes_adquirentes enable row level security;
alter table lotes_repasses enable row level security;
alter table contas_receber enable row level security;
alter table conciliacao_financeira enable row level security;

drop policy if exists "auth_all_venda_pagamentos" on venda_pagamentos;
create policy "auth_all_venda_pagamentos" on venda_pagamentos for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_configuracoes_adquirentes" on configuracoes_adquirentes;
create policy "auth_all_configuracoes_adquirentes" on configuracoes_adquirentes for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_lotes_repasses" on lotes_repasses;
create policy "auth_all_lotes_repasses" on lotes_repasses for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_contas_receber" on contas_receber;
create policy "auth_all_contas_receber" on contas_receber for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_conciliacao_financeira" on conciliacao_financeira;
create policy "auth_all_conciliacao_financeira" on conciliacao_financeira for all to authenticated using (true) with check (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- RPC ATÔMICA IDEMPOTENTE: CONFIRMAR VENDA INTEGRADA COM SPLIT E RECEBÍVEIS
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function confirmar_venda_integrada(
  p_venda_id                  uuid,
  p_unidade_id                uuid,
  p_codigo_venda              text,
  p_canal_venda               text,
  p_origem                    text,
  p_id_externo                text,
  p_subtotal                  numeric,
  p_desconto                  numeric,
  p_taxa_servico_cobrada      numeric,
  p_taxa_servico_equipe       numeric,
  p_taxa_servico_empresa      numeric,
  p_comissao_mkt              numeric,
  p_impostos_venda            numeric,
  p_impostos_retidos          numeric,
  p_valor_bruto               numeric,
  p_valor_final               numeric,
  p_valor_liquido_esperado    numeric,
  p_cmv_teorico               numeric,
  p_cliente                   text,
  p_observacao                text,
  p_chave_idempotencia        text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_venda_rec                 vendas%rowtype;
  v_venda_id_final            uuid;
begin
  -- 1. Checar idempotência
  if p_chave_idempotencia is not null and p_chave_idempotencia <> '' then
    select * into v_venda_rec from vendas where chave_idempotencia = p_chave_idempotencia;
    if found then
      return jsonb_build_object(
        'sucesso', true,
        'mensagem', 'Venda já confirmada anteriormente (idempotência)',
        'venda_id', v_venda_rec.id,
        'codigo_venda', v_venda_rec.codigo_venda
      );
    end if;
  end if;

  -- 2. Atualizar ou Criar Venda
  if p_venda_id is not null then
    update vendas set
      codigo_venda = coalesce(p_codigo_venda, codigo_venda, 'VND-' || substr(id::text, 1, 8)),
      canal_venda = coalesce(p_canal_venda, canal_venda, 'SALAO'),
      origem = coalesce(p_origem, origem, 'NATIVA'),
      id_externo = coalesce(p_id_externo, id_externo),
      subtotal = p_subtotal,
      desconto = p_desconto,
      taxa_servico_cobrada = p_taxa_servico_cobrada,
      taxa_servico_destinada_equipe = p_taxa_servico_equipe,
      taxa_servico_retida_empresa = p_taxa_servico_empresa,
      comissao_marketplace = p_comissao_mkt,
      impostos_venda = p_impostos_venda,
      impostos_retidos_origem = p_impostos_retidos,
      valor_bruto = p_valor_bruto,
      valor_final = p_valor_final,
      valor_liquido_esperado = p_valor_liquido_esperado,
      cmv_teorico = p_cmv_teorico,
      cliente = coalesce(p_cliente, cliente),
      status = 'CONCLUIDA',
      chave_idempotencia = p_chave_idempotencia,
      observacao = p_observacao,
      updated_at = now()
    where id = p_venda_id
    returning id into v_venda_id_final;
  else
    insert into vendas (
      unidade_id, codigo_venda, canal_venda, origem, id_externo, subtotal, desconto,
      taxa_servico_cobrada, taxa_servico_destinada_equipe, taxa_servico_retida_empresa,
      comissao_marketplace, impostos_venda, impostos_retidos_origem, valor_bruto, valor_final,
      valor_liquido_esperado, cmv_teorico, cliente, status, chave_idempotencia, observacao
    ) values (
      p_unidade_id, coalesce(p_codigo_venda, 'VND-' || substr(gen_random_uuid()::text, 1, 8)),
      coalesce(p_canal_venda, 'SALAO'), coalesce(p_origem, 'NATIVA'), p_id_externo, p_subtotal, p_desconto,
      p_taxa_servico_cobrada, p_taxa_servico_equipe, p_taxa_servico_empresa,
      p_comissao_mkt, p_impostos_venda, p_impostos_retidos, p_valor_bruto, p_valor_final,
      p_valor_liquido_esperado, p_cmv_teorico, p_cliente, 'CONCLUIDA', p_chave_idempotencia, p_observacao
    ) returning id into v_venda_id_final;
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Venda integrada confirmada com sucesso',
    'venda_id', v_venda_id_final
  );
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- RPC ATÔMICA: CONCILIAR LOTE DE REPASSES (CONCILIAÇÃO N:1 DE BANCO COM RECEBÍVEIS)
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function conciliar_lote_repasses(
  p_lote_id             uuid,
  p_unidade_id          uuid,
  p_valor_depositado    numeric,
  p_conta_financeira_id uuid,
  p_usuario_id          uuid default null,
  p_usuario_nome        text default null,
  p_observacao          text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote                lotes_repasses%rowtype;
  v_diferenca           numeric;
  v_status_conc         text;
  v_status_lote         text;
begin
  select * into v_lote from lotes_repasses where id = p_lote_id and unidade_id = p_unidade_id for update;
  if not found then
    return jsonb_build_object('sucesso', false, 'erro', 'Lote de repasse não encontrado');
  end if;

  v_diferenca := round(v_lote.valor_liquido_total - p_valor_depositado, 2);

  if abs(v_diferenca) <= 0.05 then
    v_status_conc := 'CONCILIADO_OK';
    v_status_lote := 'CONCILIADO';
  else
    v_status_conc := 'CONCILIADO_COM_DIVERGENCIA';
    v_status_lote := 'DIVERGENTE';
  end if;

  -- 1. Atualizar o lote
  update lotes_repasses set
    valor_depositado_banco = p_valor_depositado,
    diferenca = v_diferenca,
    conta_financeira_id = p_conta_financeira_id,
    status = v_status_lote
  where id = p_lote_id;

  -- 2. Atualizar todos os recebíveis vinculados ao lote
  update contas_receber set
    valor_recebido = valor_liquido_esperado,
    data_real_repasse = current_date,
    conta_financeira_id = p_conta_financeira_id,
    status = case when v_status_lote = 'CONCILIADO' then 'RECEBIDO' else 'DIVERGENTE' end,
    updated_at = now()
  where lote_repasse_id = p_lote_id;

  -- 3. Incrementar saldo da conta financeira
  if p_conta_financeira_id is not null then
    update contas_financeiras set
      saldo_atual = saldo_atual + p_valor_depositado,
      updated_at = now()
    where id = p_conta_financeira_id;
  end if;

  -- 4. Registrar Conciliação
  insert into conciliacao_financeira (
    unidade_id, lote_repasse_id, conta_financeira_id, valor_esperado,
    valor_depositado, diferenca_taxa, status_conciliacao, usuario_id, usuario_nome, justificativa
  ) values (
    p_unidade_id, p_lote_id, p_conta_financeira_id, v_lote.valor_liquido_total,
    p_valor_depositado, v_diferenca, v_status_conc, p_usuario_id, p_usuario_nome, p_observacao
  );

  return jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Lote de repasse conciliado com sucesso',
    'status_lote', v_status_lote,
    'diferenca', v_diferenca
  );
end;
$$;
