-- ══════════════════════════════════════════════════════════════════════════════
-- QUERY DE AUDITORIA REAL DE BANCO DE DADOS — ESTRUTURA E AUTORIZAÇÃO (READ-ONLY)
-- ERP HÉFISTO — Inspeção direta do catálogo PostgreSQL (pg_catalog / information_schema)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. ESTRUTURA DAS TABELAS DE AUTORIZAÇÃO E NÚCLEO (Colunas, Tipos, Defaults, Nullability)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('usuarios_erp', 'usuario_escopos', 'perfis_acesso', 'perfil_permissoes', 'usuario_permissoes', 'empresas', 'unidades')
ORDER BY table_name, ordinal_position;

-- 2. CONSTRAINTS (Primary Keys, Foreign Keys, Unique e Check Constraints)
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('usuarios_erp', 'usuario_escopos', 'perfis_acesso', 'perfil_permissoes', 'usuario_permissoes', 'empresas', 'unidades')
ORDER BY tc.table_name, tc.constraint_name;

-- 3. STATUS RLS E FORCE RLS DAS TABELAS ALVO
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('usuarios_erp', 'usuario_escopos', 'perfis_acesso', 'perfil_permissoes', 'usuario_permissoes', 'empresas', 'unidades');

-- 4. POLÍTICAS RLS EXISTENTES NAS TABELAS ALVO
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('usuarios_erp', 'usuario_escopos', 'perfis_acesso', 'perfil_permissoes', 'usuario_permissoes', 'empresas', 'unidades')
ORDER BY tablename, policyname;

-- 5. GRANTS DE TABELA (anon, authenticated, service_role, PUBLIC)
SELECT 
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('usuarios_erp', 'usuario_escopos', 'perfis_acesso', 'perfil_permissoes', 'usuario_permissoes', 'empresas', 'unidades')
ORDER BY table_name, grantee, privilege_type;

-- 6. INSPEÇÃO COMPLETA DAS FUNÇÕES DE AUTORIZAÇÃO DO HÉFISTO
SELECT 
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_config,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  p.prosrc AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'hefisto_usuario_valido',
    'hefisto_unidades_do_usuario',
    'hefisto_user_has_permission',
    'hefisto_session_context',
    'hefisto_user_in_unit',
    'auth_papel',
    'auth_unidade_id',
    'pode_ver_todas'
  )
ORDER BY p.proname;

-- 7. GRANTS DE EXECUÇÃO NAS FUNÇÕES DE AUTORIZAÇÃO (EXECUTE Grants)
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'hefisto_usuario_valido',
    'hefisto_unidades_do_usuario',
    'hefisto_user_has_permission',
    'hefisto_session_context',
    'hefisto_user_in_unit',
    'auth_papel',
    'auth_unidade_id',
    'pode_ver_todas'
  )
ORDER BY routine_name, grantee;
