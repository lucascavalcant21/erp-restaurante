-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: TELEMETRIA OPERACIONAL, DIAGNÓSTICO E ATRITO PILOTO SAAS
-- HÉFISTO ERP — Coleta de Métricas Técnicas, Suporte por Operation ID & Onboarding
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. TABELA DE TELEMETRIA TÉCNICA (PERFORMANCE & ERROS - ZERO DADOS COMERCIAIS)
create table if not exists public.saas_telemetria_tecnica (
  id uuid primary key default gen_random_uuid(),
  empresa_id text,
  unidade_id text,
  rpc_nome text not null,
  latencia_ms numeric default 0,
  status_code int default 200,
  operation_id text,
  is_slow_query boolean default false,
  is_synthetic boolean default false,
  criado_em timestamptz default now()
);

alter table public.saas_telemetria_tecnica enable row level security;

-- 2. TABELA DE LOGS DE SUPORTE (SANITIZADOS POR OPERATION_ID)
create table if not exists public.saas_logs_suporte (
  id uuid primary key default gen_random_uuid(),
  operation_id text not null,
  empresa_id text,
  unidade_id text,
  user_id uuid,
  endpoint text,
  error_code text,
  sanitized_stack text,
  is_synthetic boolean default false,
  criado_em timestamptz default now()
);

alter table public.saas_logs_suporte enable row level security;

-- 3. TABELA DE MEDIÇÃO DE ATRITO E INCIDENTES NO ONBOARDING
create table if not exists public.saas_onboarding_atrito (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  tempo_conclusao_minutos int default 0,
  suporte_chamados int default 0,
  sev1_count int default 0,
  sev2_count int default 0,
  sev3_count int default 0,
  sev4_count int default 0,
  criado_em timestamptz default now()
);

alter table public.saas_onboarding_atrito enable row level security;


-- 4. RPC PARA REGISTRO SILENCIOSO DE TELEMETRIA TÉCNICA
create or replace function registrar_telemetria_saas(
  p_empresa_id text,
  p_unidade_id text,
  p_rpc_nome text,
  p_latencia_ms numeric,
  p_status_code int default 200,
  p_operation_id text default null,
  p_is_synthetic boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.saas_telemetria_tecnica (
    empresa_id, unidade_id, rpc_nome, latencia_ms, status_code, operation_id, is_slow_query, is_synthetic, criado_em
  ) values (
    p_empresa_id, p_unidade_id, p_rpc_nome, coalesce(p_latencia_ms, 0), coalesce(p_status_code, 200),
    p_operation_id, (coalesce(p_latencia_ms, 0) > 500), coalesce(p_is_synthetic, false), now()
  );
exception when others then
  -- Fail-safe silencioso para não interromper a operação do usuário
  null;
end;
$$;


-- 5. RPC PARA REGISTRO DE LOG DE SUPORTE COM SANITIZAÇÃO
create or replace function registrar_log_suporte_saas(
  p_operation_id text,
  p_empresa_id text,
  p_unidade_id text,
  p_user_id uuid,
  p_endpoint text,
  p_error_code text,
  p_sanitized_stack text,
  p_is_synthetic boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_operation_id is null or trim(p_operation_id) = '' then
    return;
  end if;

  insert into public.saas_logs_suporte (
    operation_id, empresa_id, unidade_id, user_id, endpoint, error_code, sanitized_stack, is_synthetic, criado_em
  ) values (
    p_operation_id, p_empresa_id, p_unidade_id, p_user_id, p_endpoint, p_error_code, p_sanitized_stack, coalesce(p_is_synthetic, false), now()
  );
exception when others then
  null;
end;
$$;


-- 6. RPC DO CONTROL PLANE: DASHBOARD DE TELEMETRIA TÉCNICA (SEM MISTURAR DADOS SINTÉTICOS)
create or replace function obter_telemetria_control_plane_saas()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_platform_admin boolean := false;
  v_telemetria_tenants jsonb := '[]'::jsonb;
  v_resumo_atrito jsonb := '[]'::jsonb;
begin
  -- Autorização server-side
  select true into v_is_platform_admin
  from public.saas_plataforma_admins
  where user_id = v_uid;

  if not coalesce(v_is_platform_admin, false) then
    return jsonb_build_object('sucesso', false, 'erro', 'Acesso negado: Requer privilégios de Administrador da Plataforma Héfisto');
  end if;

  -- 1. Métricas Técnicas por Tenant (Filtrando dados sintéticos e sem números hardcoded)
  select coalesce(jsonb_agg(jsonb_build_object(
    'empresa_id', e.id,
    'nome_empresa', e.nome,
    'status_empresa', coalesce(e.status, 'ACTIVE'),
    'plano_id', coalesce(e.plano_id, 'PILOT_PRO'),
    'usuarios_ativos_hoje', (
      select count(distinct user_id) 
      from public.saas_logs_suporte 
      where empresa_id = e.id and criado_em >= current_date and is_synthetic = false
    ) + (
      select count(*) from public.usuarios_erp u
      join public.unidades unid on u.unidade_principal_id = unid.id
      where unid.empresa_id = e.id and u.ativo = true
    ),
    'latencia_media_ms', (
      select round(avg(latencia_ms), 1) from public.saas_telemetria_tecnica 
      where empresa_id = e.id and is_synthetic = false
    ),
    'contagem_erros', (
      select count(*) from public.saas_logs_suporte 
      where empresa_id = e.id and is_synthetic = false
    ),
    'slow_queries_count', (
      select count(*) from public.saas_telemetria_tecnica 
      where empresa_id = e.id and is_synthetic = false and (is_slow_query = true or latencia_ms > 500)
    ),
    'status_saude', case
      when (select count(*) from public.saas_logs_suporte where empresa_id = e.id and is_synthetic = false) > 10 then 'RED'
      when (select count(*) from public.saas_telemetria_tecnica where empresa_id = e.id and is_synthetic = false and is_slow_query = true) > 5 then 'YELLOW'
      when (select avg(latencia_ms) from public.saas_telemetria_tecnica where empresa_id = e.id and is_synthetic = false) > 300 then 'YELLOW'
      else 'GREEN'
    end
  )), '[]'::jsonb) into v_telemetria_tenants
  from public.empresas e;

  -- 2. Resumo de Atrito e Severidades
  select coalesce(jsonb_agg(jsonb_build_object(
    'empresa_id', a.empresa_id,
    'tempo_conclusao_minutos', a.tempo_conclusao_minutos,
    'suporte_chamados', a.suporte_chamados,
    'sev1_count', a.sev1_count,
    'sev2_count', a.sev2_count,
    'sev3_count', a.sev3_count,
    'sev4_count', a.sev4_count,
    'criado_em', a.criado_em
  )), '[]'::jsonb) into v_resumo_atrito
  from public.saas_onboarding_atrito a;

  return jsonb_build_object(
    'sucesso', true,
    'telemetria_tenants', v_telemetria_tenants,
    'resumo_atrito', v_resumo_atrito
  );
end;
$$;


-- 7. RPC DO CONTROL PLANE: PESQUISA DE DIAGNÓSTICO POR OPERATION_ID
create or replace function pesquisar_log_suporte_saas(
  p_operation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_platform_admin boolean := false;
  v_log jsonb;
begin
  -- Autorização server-side
  select true into v_is_platform_admin
  from public.saas_plataforma_admins
  where user_id = v_uid;

  if not coalesce(v_is_platform_admin, false) then
    return jsonb_build_object('sucesso', false, 'erro', 'Acesso negado: Requer privilégios de Administrador da Plataforma Héfisto');
  end if;

  if p_operation_id is null or trim(p_operation_id) = '' then
    return jsonb_build_object('sucesso', false, 'erro', 'Operation ID é obrigatório.');
  end if;

  select jsonb_build_object(
    'id', l.id,
    'operation_id', l.operation_id,
    'empresa_id', l.empresa_id,
    'unidade_id', l.unidade_id,
    'user_id', l.user_id,
    'endpoint', l.endpoint,
    'error_code', l.error_code,
    'sanitized_stack', l.sanitized_stack,
    'is_synthetic', l.is_synthetic,
    'criado_em', l.criado_em
  ) into v_log
  from public.saas_logs_suporte l
  where l.operation_id = trim(p_operation_id)
  order by l.criado_em desc
  limit 1;

  if v_log is null then
    return jsonb_build_object('sucesso', false, 'erro', 'Nenhum log técnico encontrado para o Operation ID fornecido.');
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'log', v_log
  );
end;
$$;
