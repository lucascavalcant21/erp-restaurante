-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: MÓDULO FINANCEIRO INTEGRADO (FONTE ÚNICA DA VERDADE)
-- ERP HÉFISTO — Contas a Pagar, Contas Financeiras, Pagamentos, Estornos e DRE
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. ADICIONAR COLUNAS ESTRUTURADAS EM contas_pagar (SE NÃO EXISTIREM)
alter table contas_pagar add column if not exists fornecedor_id        uuid references fornecedores(id) on delete set null;
alter table contas_pagar add column if not exists numero_documento     text;
alter table contas_pagar add column if not exists valor_original       numeric default 0;
alter table contas_pagar add column if not exists valor_pago           numeric default 0;
alter table contas_pagar add column if not exists saldo                numeric default 0;
alter table contas_pagar add column if not exists juros                numeric default 0;
alter table contas_pagar add column if not exists multa                numeric default 0;
alter table contas_pagar add column if not exists desconto             numeric default 0;
alter table contas_pagar add column if not exists competencia          date;
alter table contas_pagar add column if not exists forma_pagamento      text;
alter table contas_pagar add column if not exists conta_financeira_id  uuid;
alter table contas_pagar add column if not exists centro_custo         text default 'geral';
alter table contas_pagar add column if not exists origem_tipo          text default 'MANUAL'; -- 'RECEBIMENTO', 'FOLHA', 'MANUAL', 'RECORRENTE'
alter table contas_pagar add column if not exists origem_id            uuid;
alter table contas_pagar add column if not exists anexo_url            text;
alter table contas_pagar add column if not exists chave_idempotencia   text unique;
alter table contas_pagar add column if not exists parcela_numero       integer default 1;
alter table contas_pagar add column if not exists total_parcelas       integer default 1;
alter table contas_pagar add column if not exists documento_grupo_id   uuid;
alter table contas_pagar add column if not exists observacao           text;

-- Garantir que o valor original e saldo estejam preenchidos para registros antigos
update contas_pagar set
  valor_original = coalesce(valor_original, valor, 0),
  valor_pago = case when status = 'pago' or status = 'PAGA' then coalesce(valor_pago, valor, 0) else coalesce(valor_pago, 0) end,
  saldo = case when status = 'pago' or status = 'PAGA' then 0 else coalesce(valor, 0) - coalesce(valor_pago, 0) end,
  status = case when status = 'pago' then 'PAGA' when status = 'pendente' then 'PENDENTE' else status end
where valor_original is null or valor_original = 0;


-- 2. TABELA DE CONTAS FINANCEIRAS (BANCOS, CAIXAS, CARTÕES)
create table if not exists contas_financeiras (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null,
  nome          text not null, -- Ex: "Caixa Restaurante", "Banco Itaú", "Banco Inter"
  tipo          text not null default 'banco' check (tipo in ('caixa', 'banco', 'cartao', 'digital')),
  saldo_inicial numeric not null default 0,
  saldo_atual   numeric not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);


-- 3. TABELA DE HISTÓRICO DE PAGAMENTOS E LIQUIDAÇÕES
create table if not exists contas_pagar_pagamentos (
  id                    uuid primary key default gen_random_uuid(),
  conta_pagar_id        uuid not null references contas_pagar(id) on delete cascade,
  unidade_id            uuid not null,
  valor_pago            numeric not null default 0,
  juros                 numeric not null default 0,
  multa                 numeric not null default 0,
  desconto              numeric not null default 0,
  valor_efetivo_saida   numeric not null default 0, -- (valor_pago + juros + multa - desconto)
  data_pagamento        timestamptz default now(),
  forma_pagamento       text default 'pix',
  conta_financeira_id   uuid references contas_financeiras(id) on delete set null,
  observacao            text,
  comprovante_url       text,
  usuario_id            uuid,
  usuario_nome          text,
  estornado             boolean not null default false,
  chave_idempotencia    text unique,
  created_at            timestamptz default now()
);


-- ÍNDICES DE DESEMPENHO E SEGURANÇA
create index if not exists idx_contas_pagar_unid   on contas_pagar(unidade_id);
create index if not exists idx_contas_pagar_st     on contas_pagar(status);
create index if not exists idx_contas_pagar_venc   on contas_pagar(data_vencimento);
create index if not exists idx_contas_pagar_forn   on contas_pagar(fornecedor_id);
create index if not exists idx_contas_pagar_orig   on contas_pagar(origem_tipo, origem_id);
create index if not exists idx_contas_fin_unid     on contas_financeiras(unidade_id);
create index if not exists idx_pagamentos_cp       on contas_pagar_pagamentos(conta_pagar_id);

-- POLÍTICAS RLS
alter table contas_financeiras enable row level security;
alter table contas_pagar_pagamentos enable row level security;

drop policy if exists "auth_all_contas_financeiras" on contas_financeiras;
create policy "auth_all_contas_financeiras" on contas_financeiras for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_contas_pagar_pagamentos" on contas_pagar_pagamentos;
create policy "auth_all_contas_pagar_pagamentos" on contas_pagar_pagamentos for all to authenticated using (true) with check (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- RPC ATÔMICA: REGISTRAR PAGAMENTO / LIQUIDAÇÃO DE CONTA A PAGAR
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function registrar_pagamento_conta(
  p_conta_pagar_id      uuid,
  p_unidade_id          uuid,
  p_valor_pago          numeric,
  p_juros               numeric default 0,
  p_multa               numeric default 0,
  p_desconto            numeric default 0,
  p_data_pagamento      timestamptz default now(),
  p_forma_pagamento     text default 'pix',
  p_conta_financeira_id uuid default null,
  p_observacao          text default null,
  p_comprovante_url     text default null,
  p_usuario_nome        text default 'Usuário ERP',
  p_chave_idempotencia  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta               record;
  v_saida_efetiva       numeric;
  v_novo_valor_pago     numeric;
  v_novo_saldo          numeric;
  v_novo_status         text;
  v_pagamento_id        uuid;
  v_data_pagamento_str  text;
begin
  -- 1. Proteção de Idempotência
  if p_chave_idempotencia is not null and p_chave_idempotencia <> '' then
    select id into v_pagamento_id
    from contas_pagar_pagamentos
    where chave_idempotencia = p_chave_idempotencia;

    if v_pagamento_id is not null then
      return jsonb_build_object(
        'success', true,
        'idempotente', true,
        'pagamento_id', v_pagamento_id,
        'mensagem', 'Pagamento já processado anteriormente.'
      );
    end if;
  end if;

  -- 2. Busca e Trava a Conta a Pagar com FOR UPDATE (Prevenção de Concorrência)
  select * into v_conta
  from contas_pagar
  where id = p_conta_pagar_id and unidade_id = p_unidade_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Conta a pagar não encontrada.');
  end if;

  if v_conta.status = 'CANCELADA' then
    return jsonb_build_object('success', false, 'error', 'Esta conta está cancelada.');
  end if;

  if v_conta.status = 'PAGA' or coalesce(v_conta.saldo, v_conta.valor) <= 0 then
    return jsonb_build_object('success', false, 'error', 'Esta conta já está totalmente paga.');
  end if;

  -- 3. Cálculos Financeiros
  v_saida_efetiva   := p_valor_pago + coalesce(p_juros, 0) + coalesce(p_multa, 0) - coalesce(p_desconto, 0);
  v_novo_valor_pago := coalesce(v_conta.valor_pago, 0) + p_valor_pago;
  v_novo_saldo      := coalesce(v_conta.valor_original, v_conta.valor) - v_novo_valor_pago;

  if v_novo_saldo <= 0.001 then
    v_novo_saldo  := 0;
    v_novo_status := 'PAGA';
  else
    v_novo_status := 'PARCIALMENTE PAGA';
  end if;

  v_data_pagamento_str := to_char(p_data_pagamento, 'YYYY-MM-DD');

  -- 4. Atualiza o Cabeçalho da Conta a Pagar
  update contas_pagar set
    valor_pago = v_novo_valor_pago,
    saldo = v_novo_saldo,
    status = v_novo_status,
    juros = coalesce(juros, 0) + coalesce(p_juros, 0),
    multa = coalesce(multa, 0) + coalesce(p_multa, 0),
    desconto = coalesce(desconto, 0) + coalesce(p_desconto, 0),
    data_pagamento = v_data_pagamento_str,
    forma_pagamento = coalesce(p_forma_pagamento, v_conta.forma_pagamento),
    conta_financeira_id = coalesce(p_conta_financeira_id, v_conta.conta_financeira_id)
  where id = p_conta_pagar_id;

  -- 5. Registra o Histórico em contas_pagar_pagamentos
  insert into contas_pagar_pagamentos (
    conta_pagar_id, unidade_id, valor_pago, juros, multa, desconto,
    valor_efetivo_saida, data_pagamento, forma_pagamento, conta_financeira_id,
    observacao, comprovante_url, usuario_nome, chave_idempotencia
  ) values (
    p_conta_pagar_id, p_unidade_id, p_valor_pago, coalesce(p_juros, 0), coalesce(p_multa, 0), coalesce(p_desconto, 0),
    v_saida_efetiva, p_data_pagamento, p_forma_pagamento, p_conta_financeira_id,
    p_observacao, p_comprovante_url, p_usuario_nome, p_chave_idempotencia
  ) returning id into v_pagamento_id;

  -- 6. Debita da Conta Financeira (se informada)
  if p_conta_financeira_id is not null then
    update contas_financeiras set
      saldo_atual = saldo_atual - v_saida_efetiva,
      updated_at = now()
    where id = p_conta_financeira_id;
  end if;

  -- 7. Lança a movimentação de saída em lancamentos
  insert into lancamentos (
    unidade_id, tipo, categoria, descricao, valor, data
  ) values (
    p_unidade_id, 'saida', coalesce(v_conta.categoria, 'Fornecedores'),
    'Pagamento: ' || v_conta.descricao || coalesce(' (NF ' || v_conta.numero_documento || ')', ''),
    v_saida_efetiva, v_data_pagamento_str
  );

  return jsonb_build_object(
    'success', true,
    'pagamento_id', v_pagamento_id,
    'novo_status', v_novo_status,
    'novo_saldo', v_novo_saldo,
    'saida_efetiva', v_saida_efetiva
  );
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- RPC ATÔMICA: ESTORNAR PAGAMENTO DE CONTA A PAGAR
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function estornar_pagamento_conta(
  p_pagamento_id        uuid,
  p_unidade_id          uuid,
  p_motivo              text default 'Estorno de Pagamento Incorreto',
  p_usuario_nome        text default 'Usuário ERP'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pag                 record;
  v_conta               record;
  v_novo_valor_pago     numeric;
  v_novo_saldo          numeric;
  v_novo_status         text;
  v_hoje                text;
begin
  select * into v_pag
  from contas_pagar_pagamentos
  where id = p_pagamento_id and unidade_id = p_unidade_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Registro de pagamento não encontrado.');
  end if;

  if v_pag.estornado then
    return jsonb_build_object('success', false, 'error', 'Este pagamento já foi estornado anteriormente.');
  end if;

  select * into v_conta
  from contas_pagar
  where id = v_pag.conta_pagar_id
  for update;

  v_novo_valor_pago := greatest(0, coalesce(v_conta.valor_pago, 0) - v_pag.valor_pago);
  v_novo_saldo      := coalesce(v_conta.valor_original, v_conta.valor) - v_novo_valor_pago;
  v_hoje            := to_char(now(), 'YYYY-MM-DD');

  if v_novo_valor_pago <= 0 then
    v_novo_status := 'PENDENTE';
  else
    v_novo_status := 'PARCIALMENTE PAGA';
  end if;

  -- 1. Marcar pagamento como estornado
  update contas_pagar_pagamentos set
    estornado = true,
    observacao = coalesce(observacao, '') || ' [ESTORNADO em ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || ': ' || p_motivo || ']'
  where id = p_pagamento_id;

  -- 2. Atualizar a conta a pagar
  update contas_pagar set
    valor_pago = v_novo_valor_pago,
    saldo = v_novo_saldo,
    status = v_novo_status,
    juros = greatest(0, coalesce(juros, 0) - v_pag.juros),
    multa = greatest(0, coalesce(multa, 0) - v_pag.multa),
    desconto = greatest(0, coalesce(desconto, 0) - v_pag.desconto)
  where id = v_pag.conta_pagar_id;

  -- 3. Creditar de volta na Conta Financeira
  if v_pag.conta_financeira_id is not null then
    update contas_financeiras set
      saldo_atual = saldo_atual + v_pag.valor_efetivo_saida,
      updated_at = now()
    where id = v_pag.conta_financeira_id;
  end if;

  -- 4. Registrar lançamento estorno (entrada estorno) em lancamentos
  insert into lancamentos (
    unidade_id, tipo, categoria, descricao, valor, data
  ) values (
    p_unidade_id, 'entrada', coalesce(v_conta.categoria, 'Outras receitas'),
    'Estorno Pagamento: ' || v_conta.descricao || ' - ' || p_motivo,
    v_pag.valor_efetivo_saida, v_hoje
  );

  return jsonb_build_object(
    'success', true,
    'novo_status', v_novo_status,
    'novo_saldo', v_novo_saldo,
    'valor_estornado', v_pag.valor_efetivo_saida
  );
end;
$$;
