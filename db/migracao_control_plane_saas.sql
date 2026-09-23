-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: SAAS CONTROL PLANE & MULTI-TENANT MANAGEMENT
-- HÉFISTO ERP — Administração da Plataforma, Entitlements e Provisionamento SaaS
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. TABELA DE ADMINISTRADORES DA PLATAFORMA (SUPERADMINS SAAS)
create table if not exists public.saas_plataforma_admins (
  user_id uuid primary key,
  criado_em timestamptz default now()
);

alter table public.saas_plataforma_admins enable row level security;

-- 2. TABELA DE AUDITORIA DO CONTROL PLANE SAAS
create table if not exists public.saas_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  empresa_id text,
  acao text not null,
  detalhes jsonb default '{}'::jsonb,
  criado_em timestamptz default now()
);

alter table public.saas_audit_logs enable row level security;

-- 3. ADICIONAR CAMPOS DE PLANO E STATUS EM EMPRESAS
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'empresas' and column_name = 'plano_id') then
    alter table public.empresas add column plano_id text default 'PRO';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'empresas' and column_name = 'status') then
    alter table public.empresas add column status text default 'ACTIVE';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'empresas' and column_name = 'onboarding_status') then
    alter table public.empresas add column onboarding_status text default 'COMPLETED';
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'empresas' and column_name = 'trial_inicio') then
    alter table public.empresas add column trial_inicio timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'empresas' and column_name = 'trial_fim') then
    alter table public.empresas add column trial_fim timestamptz;
  end if;
end $$;

-- 4. BACKFILL DO TENANT EXISTENTE (SELDEESTRELA)
update public.empresas
set plano_id = coalesce(plano_id, 'PRO'),
    status = coalesce(status, 'ACTIVE'),
    onboarding_status = coalesce(onboarding_status, 'COMPLETED')
where plano_id is null or status is null or onboarding_status is null;


-- 5. FUNÇÃO AVALIADORA DE ENTITLEMENTS NO SERVIDOR (SQL)
create or replace function hefisto_eval_entitlement(
  p_empresa_id text,
  p_feature text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plano text;
  v_status text;
begin
  if p_empresa_id is null or p_feature is null then
    return false;
  end if;

  select plano_id, status into v_plano, v_status
  from public.empresas
  where id = p_empresa_id;

  if v_status = 'SUSPENDED' or v_status = 'CANCELLED' then
    return false;
  end if;

  v_plano := coalesce(v_plano, 'PRO');

  -- Regras de Entitlements por Plano
  if p_feature = 'hasFinancial' then
    return v_plano in ('PRO', 'MULTIUNIT');
  elsif p_feature = 'hasAdvancedInventory' then
    return v_plano in ('PRO', 'MULTIUNIT');
  elsif p_feature = 'hasAI' then
    return v_plano in ('PRO', 'MULTIUNIT');
  elsif p_feature = 'hasMultiUnit' then
    return v_plano = 'MULTIUNIT';
  elsif p_feature = 'hasIntegrations' then
    return v_plano in ('PRO', 'MULTIUNIT');
  end if;

  return true;
end;
$$;


-- 6. RPC ATÔMICA REFORÇADA: PROVISIONAR NOVO TENANT SAAS
create or replace function provisionar_novo_tenant(
  p_nome_empresa text,
  p_nome_fantasia text default null,
  p_cnpj text default null,
  p_admin_nome text default null,
  p_admin_email text default null,
  p_nome_unidade text default 'Matriz',
  p_timezone text default 'America/Sao_Paulo',
  p_plano_id text default 'PRO'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empresa_id text;
  v_unidade_id text;
  v_perfil_admin_id text;
  v_uid uuid := auth.uid();
begin
  if p_nome_empresa is null or trim(p_nome_empresa) = '' then
    return jsonb_build_object('sucesso', false, 'erro', 'Nome da empresa é obrigatório.');
  end if;

  -- 1. Gerar IDs
  v_empresa_id := 'emp_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  v_unidade_id := 'unid_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);

  -- 2. Inserir Empresa com Plano e Status de Onboarding
  if to_regclass('public.empresas') is not null then
    insert into public.empresas (id, nome, cnpj, plano_id, status, onboarding_status, criado_em)
    values (v_empresa_id, trim(p_nome_empresa), p_cnpj, coalesce(p_plano_id, 'PRO'), 'ACTIVE', 'IN_PROGRESS', now())
    on conflict (id) do nothing;
  end if;

  -- 3. Inserir Primeira Unidade
  if to_regclass('public.unidades') is not null then
    insert into public.unidades (id, empresa_id, nome, ativa, criado_em)
    values (v_unidade_id, v_empresa_id, coalesce(trim(p_nome_unidade), 'Matriz'), true, now())
    on conflict (id) do nothing;
  end if;

  -- 4. Inserir Perfil Administrador Geral do Restaurante
  v_perfil_admin_id := 'perf_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  if to_regclass('public.perfis_acesso') is not null then
    insert into public.perfis_acesso (id, unidade_id, nome, nivel, permissoes, criado_em)
    values (
      v_perfil_admin_id,
      v_unidade_id,
      'Administrador Geral',
      'admin',
      array['*']::text[],
      now()
    );
  end if;

  -- 5. Vincular usuário atual (se autenticado) como Admin da nova unidade
  if v_uid is not null and to_regclass('public.usuarios_erp') is not null then
    insert into public.usuarios_erp (id, email, unidade_principal_id, perfil_id, ativo)
    values (v_uid, coalesce(p_admin_email, 'admin@restaurante.com'), v_unidade_id, v_perfil_admin_id, true)
    on conflict (id) do update
    set unidade_principal_id = excluded.unidade_principal_id,
        perfil_id = excluded.perfil_id;
  end if;

  -- 6. Log de Auditoria SaaS
  if v_uid is not null and to_regclass('public.saas_audit_logs') is not null then
    insert into public.saas_audit_logs (admin_user_id, empresa_id, acao, detalhes)
    values (v_uid, v_empresa_id, 'TENANT_CREATED', jsonb_build_object(
      'empresa', p_nome_empresa,
      'unidade_id', v_unidade_id,
      'plano', p_plano_id
    ));
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'empresa_id', v_empresa_id,
    'unidade_id', v_unidade_id,
    'perfil_id', v_perfil_admin_id,
    'mensagem', 'Tenant provisionado com sucesso em ambiente isolado.'
  );
exception when others then
  return jsonb_build_object('sucesso', false, 'erro', SQLERRM);
end;
$$;


-- 7. RPC DO CONTROL PLANE SAAS: OBTER DASHBOARD E LISTA DE TENANTS
create or replace function obter_resumo_control_plane_saas()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_platform_admin boolean := false;
  v_tenants jsonb := '[]'::jsonb;
  v_total_empresas int := 0;
  v_total_unidades int := 0;
  v_total_usuarios int := 0;
  v_logs jsonb := '[]'::jsonb;
begin
  -- Checagem de autorização server-side: Usuário deve estar registrado na tabela saas_plataforma_admins
  select true into v_is_platform_admin
  from public.saas_plataforma_admins
  where user_id = v_uid;

  if not coalesce(v_is_platform_admin, false) then
    return jsonb_build_object('sucesso', false, 'erro', 'Acesso negado: Requer privilégios de Administrador da Plataforma Héfisto');
  end if;

  -- 1. Métricas da Plataforma
  select count(*) into v_total_empresas from public.empresas;
  select count(*) into v_total_unidades from public.unidades;
  if to_regclass('public.usuarios_erp') is not null then
    select count(*) into v_total_usuarios from public.usuarios_erp;
  end if;

  -- 2. Lista de Tenants com Metadados Administrativos Apenas (ZERO dados comerciais privados)
  select coalesce(jsonb_agg(jsonb_build_object(
    'empresa_id', e.id,
    'nome', e.nome,
    'cnpj', e.cnpj,
    'plano_id', coalesce(e.plano_id, 'PRO'),
    'status', coalesce(e.status, 'ACTIVE'),
    'onboarding_status', coalesce(e.onboarding_status, 'COMPLETED'),
    'criado_em', e.criado_em,
    'total_unidades', (select count(*) from public.unidades u where u.empresa_id = e.id)
  )), '[]'::jsonb) into v_tenants
  from public.empresas e;

  -- 3. Últimos Logs da Plataforma
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'acao', l.acao,
    'empresa_id', l.empresa_id,
    'detalhes', l.detalhes,
    'criado_em', l.criado_em
  )), '[]'::jsonb) into v_logs
  from (
    select * from public.saas_audit_logs order by criado_em desc limit 10
  ) l;

  return jsonb_build_object(
    'sucesso', true,
    'versao_plataforma', '1.0.0-rc.1',
    'total_empresas', v_total_empresas,
    'total_unidades', v_total_unidades,
    'total_usuarios', v_total_usuarios,
    'tenants', v_tenants,
    'audit_logs', v_logs
  );
end;
$$;
