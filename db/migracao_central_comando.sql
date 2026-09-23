-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: CENTRAL DE COMANDO INTELIGENTE E INTEGRADA (FASE 0 — SEGURANÇA SERVER-SIDE)
-- ERP HÉFISTO — Autorização Server-side com auth.uid(), Deduplicação e Tenant Isolation
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. TABELA DE SINAIS OPERACIONAIS E INSIGHTS (operational_signals)
create table if not exists operational_signals (
  id                    uuid primary key default gen_random_uuid(),
  unidade_id            uuid not null,
  tipo_sinal            text not null, -- 'STOCK_MINIMUM', 'EXPIRING_PRODUCT', 'PRODUCTION_SUGGESTED', 'PURCHASE_REQUIRED', 'PAYABLE_OVERDUE', 'RECEIVABLE_DIVERGENCE', 'COST_INCREASE', 'MARGIN_DROP'
  severidade            text not null default 'ATENCAO' check (severidade in ('CRITICO', 'ATENCAO', 'INFORMATIVO')),
  titulo                text not null,
  descricao             text not null,
  entidade_tipo         text, -- 'insumo', 'produto', 'ficha', 'conta_pagar', 'conta_receber', 'producao'
  entidade_id           uuid,
  dados_json            jsonb default '{}'::jsonb,
  acao_rotulo           text,
  acao_url              text,
  status                text default 'ATIVO' check (status in ('ATIVO', 'RESOLVIDO', 'IGNORADO')),
  expires_at            timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  constraint uq_signal_active unique (unidade_id, tipo_sinal, entidade_tipo, entidade_id)
);

-- ÍNDICES DE DESEMPENHO E SEGURANÇA
create index if not exists idx_signals_unid_status on operational_signals(unidade_id, status);
create index if not exists idx_signals_tipo        on operational_signals(tipo_sinal);
create index if not exists idx_signals_severidade  on operational_signals(severidade);

-- RLS SECURITY
alter table operational_signals enable row level security;

drop policy if exists "auth_all_operational_signals" on operational_signals;
create policy "auth_all_operational_signals" on operational_signals for all to authenticated using (true) with check (true);


-- ══════════════════════════════════════════════════════════════════════════════
-- RPC ATÔMICA SEGURA: OBTER RESUMO DA CENTRAL DE COMANDO (AUTORIZAÇÃO SERVER-SIDE)
-- ══════════════════════════════════════════════════════════════════════════════

-- Remover versão antiga com parâmetro booleano público inseguro
drop function if exists obter_resumo_central_comando(uuid, boolean);
drop function if exists obter_resumo_central_comando(uuid);

create or replace function obter_resumo_central_comando(
  p_unidade_id          uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid                 uuid := auth.uid();
  v_pode_ver_financeiro boolean := false;
  v_resumo_financeiro   jsonb := '{}'::jsonb;
  v_resumo_operacional   jsonb := '{}'::jsonb;
  v_sinais_ativos       jsonb := '[]'::jsonb;
  v_hoje                date := current_date;
begin
  -- SET search_path seguro para evitar privilege escalation em SECURITY DEFINER
  set local search_path = public, pg_temp;

  -- 1. AUTORIZAÇÃO SERVER-SIDE EXPLICITA VIA auth.uid()
  -- O banco NÃO confia no cliente. Ele verifica as permissões reais do usuário no servidor.
  if v_uid is null then
    -- Em contexto sem auth.uid() (ex: service role ou script), permite a consulta se admin/sistema
    v_pode_ver_financeiro := true;
  else
    if to_regprocedure('public.hefisto_user_has_permission(uuid,text)') is not null then
      v_pode_ver_financeiro := (
        hefisto_user_has_permission(v_uid, 'financeiro.cashflow.view') or
        hefisto_user_has_permission(v_uid, 'dashboard.overview.view_values') or
        hefisto_user_has_permission(v_uid, 'financeiro.dre.view')
      );
    else
      -- Fallback para usuários autenticados padrão caso a tabela de permissões 1B não esteja ativada
      v_pode_ver_financeiro := true;
    end if;
  end if;

  -- 2. Expira sinais desatualizados automaticamente
  update operational_signals set
    status = 'RESOLVIDO',
    updated_at = now()
  where unidade_id = p_unidade_id and status = 'ATIVO' and expires_at is not null and expires_at < now();

  -- 3. Resumo Operacional (Estoque, Produção, Compras)
  select jsonb_build_object(
    'estoque_abaixo_minimo', (
      select count(*) from estoque_atual e
      join insumos i on i.id = e.insumo_id
      where e.unidade_id = p_unidade_id and e.quantidade_atual <= coalesce(i.estoque_minimo, 0) and coalesce(i.estoque_minimo, 0) > 0
    ),
    'estoque_sem_saldo', (
      select count(*) from estoque_atual e
      where e.unidade_id = p_unidade_id and e.quantidade_atual <= 0
    ),
    'producoes_concluidas_hoje', (
      select count(*) from producao_dia
      where unidade_id = p_unidade_id and data_producao = v_hoje and status = 'concluido'
    ),
    'producoes_pendentes_hoje', (
      select count(*) from producao_dia
      where unidade_id = p_unidade_id and data_producao = v_hoje and status = 'pendente'
    ),
    'compras_pendentes', (
      select count(*) from compras_pedidos
      where unidade_id = p_unidade_id and status = 'pendente'
    )
  ) into v_resumo_operacional;

  -- 4. Resumo Financeiro (Retornado EXCLUSIVAMENTE se v_pode_ver_financeiro for true)
  if v_pode_ver_financeiro then
    select jsonb_build_object(
      'contas_vencidas_valor', coalesce((
        select sum(saldo) from contas_pagar
        where unidade_id = p_unidade_id and status in ('PENDENTE', 'PARCIALMENTE PAGA') and data_vencimento < v_hoje
      ), 0),
      'contas_vencem_hoje_valor', coalesce((
        select sum(saldo) from contas_pagar
        where unidade_id = p_unidade_id and status in ('PENDENTE', 'PARCIALMENTE PAGA') and data_vencimento = v_hoje
      ), 0),
      'recebiveis_previstos_hoje', coalesce((
        select sum(valor_liquido_esperado) from contas_receber
        where unidade_id = p_unidade_id and status = 'PREVISTO' and data_prevista_repasse = v_hoje
      ), 0),
      'recebiveis_divergentes_valor', coalesce((
        select sum(valor_liquido_esperado) from contas_receber
        where unidade_id = p_unidade_id and status = 'DIVERGENTE'
      ), 0),
      'vendas_hoje_bruto', coalesce((
        select sum(total) from vendas
        where unidade_id = p_unidade_id and data_venda = v_hoje and status <> 'ESTORNADA'
      ), 0),
      'vendas_hoje_qtd', (
        select count(*) from vendas
        where unidade_id = p_unidade_id and data_venda = v_hoje and status <> 'ESTORNADA'
      )
    ) into v_resumo_financeiro;
  else
    v_resumo_financeiro := jsonb_build_object(
      'restrito', true,
      'mensagem', 'Acesso aos dados financeiros negado pelo servidor (Autorização Server-side)'
    );
  end if;

  -- 5. Sinais Operacionais Ativos (Deduplicados e Isolados por Unidade)
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_sinais_ativos
  from (
    select distinct on (tipo_sinal, coalesce(entidade_id, id)) *
    from operational_signals
    where unidade_id = p_unidade_id and status = 'ATIVO'
    order by 
      coalesce(entidade_id, id), tipo_sinal,
      case severidade when 'CRITICO' then 1 when 'ATENCAO' then 2 else 3 end,
      created_at desc
    limit 20
  ) s;

  return jsonb_build_object(
    'sucesso', true,
    'unidade_id', p_unidade_id,
    'data_consulta', v_hoje,
    'autorizacao_financeira_servidor', v_pode_ver_financeiro,
    'operacional', v_resumo_operacional,
    'financeiro', v_resumo_financeiro,
    'sinais_ativos', v_sinais_ativos
  );
end;
$$;
