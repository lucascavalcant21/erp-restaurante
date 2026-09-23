-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: TENANT PROVISIONING (SAAS BOOTSTRAP INTEGRAL)
-- HÉFISTO ERP — Provisionamento de Empresas, Unidades e Permissões Isoladas
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function provisionar_novo_tenant(
  p_nome_empresa text,
  p_nome_unidade text default 'Matriz',
  p_cnpj text default null,
  p_admin_email text default null
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
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('sucesso', false, 'erro', 'Usuário não autenticado');
  end if;

  if p_nome_empresa is null or trim(p_nome_empresa) = '' then
    return jsonb_build_object('sucesso', false, 'erro', 'Nome da empresa é obrigatório');
  end if;

  -- 1. Gerar IDs determinísticos/UUID
  v_empresa_id := 'emp_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  v_unidade_id := 'unid_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12);

  -- 2. Inserir Empresa (se a tabela existir)
  if to_regclass('public.empresas') is not null then
    insert into public.empresas (id, nome, cnpj, criado_em)
    values (v_empresa_id, trim(p_nome_empresa), p_cnpj, now())
    on conflict (id) do nothing;
  end if;

  -- 3. Inserir Unidade
  if to_regclass('public.unidades') is not null then
    insert into public.unidades (id, empresa_id, nome, ativa, criado_em)
    values (v_unidade_id, v_empresa_id, coalesce(trim(p_nome_unidade), 'Matriz'), true, now())
    on conflict (id) do nothing;
  end if;

  -- 4. Inserir Perfil Administrador da Unidade
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

  -- 5. Vincular usuário atual como Admin da nova unidade
  if to_regclass('public.usuarios_erp') is not null then
    insert into public.usuarios_erp (id, email, unidade_principal_id, perfil_id, ativo)
    values (v_uid, coalesce(p_admin_email, 'admin@hefisto.com'), v_unidade_id, v_perfil_admin_id, true)
    on conflict (id) do update
    set unidade_principal_id = excluded.unidade_principal_id,
        perfil_id = excluded.perfil_id;
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
