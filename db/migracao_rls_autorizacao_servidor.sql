-- ══════════════════════════════════════════════════════════════════════════════
-- HOTFIX V4 — RLS FAIL-CLOSED, SCHEMA PRIVADO & TENANT-AWARE ADMINISTRATION
-- ERP HÉFISTO — Strict Preflight, auth.uid() Implicit Helpers & Zero Cross-Company Leaks
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE A — PREFLIGHT DE ESTRUTURA, TIPOS E AUDITORIA DE POLICIES ANTIGAS
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_unexpected_policies text;
BEGIN
  -- 1. Validar tabelas e tipos exatos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuarios_erp' AND column_name = 'auth_user_id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuarios_erp' AND column_name = 'status' AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuarios_erp' AND column_name = 'super_admin' AND data_type = 'boolean'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuarios_erp' AND column_name = 'unidade_principal_id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT TYPE FAILURE: Tabela public.usuarios_erp com tipos divergentes dos esperados.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuario_escopos' AND column_name = 'usuario_id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuario_escopos' AND column_name = 'empresa_id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuario_escopos' AND column_name = 'data_scope' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT TYPE FAILURE: Tabela public.usuario_escopos com tipos divergentes dos esperados.';
  END IF;

  -- 2. Validar existência das 3 tabelas restantes
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'perfis_acesso')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'perfil_permissoes')
     OR NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuario_permissoes') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILURE: Tabelas de perfis/permissoes ausentes no schema public.';
  END IF;

  -- 3. Validar existência das funções dependentes no banco
  IF to_regprocedure('public.hefisto_usuario_valido(uuid)') IS NULL
     OR to_regprocedure('public.hefisto_unidades_do_usuario(uuid)') IS NULL
     OR to_regprocedure('public.hefisto_user_has_permission(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FUNCTION FAILURE: Funções de autorização dependentes ausentes.';
  END IF;

  -- 4. Audit de políticas inesperadas
  SELECT string_agg(tablename || ':' || policyname, ', ') INTO v_unexpected_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('usuarios_erp', 'usuario_escopos', 'perfis_acesso', 'perfil_permissoes', 'usuario_permissoes')
    AND policyname NOT IN (
      'usuarios_erp_leitura', 'usuario_escopos_leitura', 'perfis_acesso_leitura', 'perfil_permissoes_leitura', 'usuario_permissoes_leitura',
      'usuarios_erp_select_policy', 'usuarios_erp_write_policy', 'usuario_escopos_select_policy', 'usuario_escopos_write_policy',
      'perfis_acesso_select_policy', 'perfis_acesso_write_policy', 'perfil_permissoes_select_policy', 'perfil_permissoes_write_policy',
      'usuario_permissoes_select_policy', 'usuario_permissoes_write_policy'
    );

  IF v_unexpected_policies IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT POLICY FAILURE: Políticas RLS não contempladas encontradas: %', v_unexpected_policies;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE B — SCHEMA PRIVADO & HELPERS ESTRITOS (USANDO auth.uid() IMPLÍCITO)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE SCHEMA IF NOT EXISTS hefisto_privado;

-- Isolar completamente o schema privado: USAGE apenas para authenticated/service_role (SEM CREATE)
REVOKE ALL ON SCHEMA hefisto_privado FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA hefisto_privado TO authenticated, service_role;

-- 1. HELPER ESTRITO DE UNIDADE DO USUÁRIO LOGADO (auth.uid() IMPLÍCITO)
CREATE OR REPLACE FUNCTION hefisto_privado.current_user_can_access_unit(
  p_unidade_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    -- REGRA ABSOLUTA 1: Se auth.uid() for nulo ou p_unidade_id for nulo -> FALHA FECHADO (false)
    WHEN auth.uid() IS NULL OR p_unidade_id IS NULL THEN false
    -- REGRA ABSOLUTA 2: Usuário precisa ser estritamente válido
    WHEN NOT public.hefisto_usuario_valido(auth.uid()) THEN false
    -- REGRA ABSOLUTA 3: Super admin ('*') ou pertencimento comprovado
    ELSE (
      '*' = ANY (public.hefisto_unidades_do_usuario(auth.uid()))
      OR p_unidade_id = ANY (public.hefisto_unidades_do_usuario(auth.uid()))
    )
  END;
$$;

-- 2. HELPER ESTRITO DE EMPRESA DO USUÁRIO LOGADO (auth.uid() IMPLÍCITO)
CREATE OR REPLACE FUNCTION hefisto_privado.current_user_can_access_company(
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user public.usuarios_erp%rowtype;
BEGIN
  IF v_uid IS NULL OR p_empresa_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_user FROM public.usuarios_erp WHERE auth_user_id = v_uid;
  IF NOT FOUND OR NOT public.hefisto_usuario_valido(v_uid) THEN
    RETURN false;
  END IF;

  -- Super admin / escopo global 'todos'
  IF v_user.super_admin OR EXISTS (
    SELECT 1 FROM public.usuario_escopos e WHERE e.usuario_id = v_user.id AND e.data_scope = 'todos'
  ) THEN
    RETURN true;
  END IF;

  -- ESCOPO EMPRESA EXPLÍCITO: Exige registro em usuario_escopos com data_scope = 'empresa' E empresa_id idêntico
  RETURN EXISTS (
    SELECT 1 FROM public.usuario_escopos e
    WHERE e.usuario_id = v_user.id
      AND e.data_scope = 'empresa'
      AND e.empresa_id = p_empresa_id
  );
END;
$$;

-- Revogar Execução Pública dos Helpers Privados e Conceder a Roles Autorizadas
REVOKE ALL ON FUNCTION hefisto_privado.current_user_can_access_unit(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION hefisto_privado.current_user_can_access_company(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION hefisto_privado.current_user_can_access_unit(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION hefisto_privado.current_user_can_access_company(uuid) TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE C — FUNÇÕES PÚBLICAS LEGADAS (LEGACY_COMPATIBILITY)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. AUTH_PAPEL() LEGACY_COMPATIBILITY — CONSULTA BANCO SEM FALLBACK ADMIN
CREATE OR REPLACE FUNCTION public.auth_papel()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE 
        WHEN p.codigo IN ('admin', 'administrador', 'administrador-geral') THEN 'admin'
        WHEN p.codigo IN ('gerente', 'gerente-geral') THEN 'gerente'
        ELSE p.codigo
      END
      FROM public.usuarios_erp u
      JOIN public.perfis_acesso p ON p.id = u.perfil_id AND p.ativo
      WHERE u.auth_user_id = auth.uid()
        AND u.status = 'ativo'
        AND public.hefisto_usuario_valido(u.auth_user_id)
      LIMIT 1
    ),
    'nao_autorizado'
  );
$$;

-- 2. AUTH_UNIDADE_ID() LEGACY_COMPATIBILITY
CREATE OR REPLACE FUNCTION public.auth_unidade_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.unidade_principal_id
  FROM public.usuarios_erp u
  WHERE u.auth_user_id = auth.uid()
    AND u.status = 'ativo'
  LIMIT 1;
$$;

-- 3. PODE_VER_TODAS() LEGACY_COMPATIBILITY — ESTRITO SUPER ADMIN / DATA_SCOPE TODOS
CREATE OR REPLACE FUNCTION public.pode_ver_todas()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN NOT public.hefisto_usuario_valido(auth.uid()) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.usuarios_erp u
      WHERE u.auth_user_id = auth.uid()
        AND u.status = 'ativo'
        AND (
          u.super_admin = true
          OR EXISTS (
            SELECT 1 FROM public.usuario_escopos e WHERE e.usuario_id = u.id AND e.data_scope = 'todos'
          )
        )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.auth_papel() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auth_unidade_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_ver_todas() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.auth_papel() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_unidade_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_ver_todas() TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE D — GRANTS ZERO-TRUST & POLÍTICAS RLS TENANT-AWARE NAS 5 TABELAS
-- ══════════════════════════════════════════════════════════════════════════════

-- Habilitar RLS nas 5 tabelas de autorização
ALTER TABLE public.usuarios_erp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_escopos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes ENABLE ROW LEVEL SECURITY;

-- 1. REVOGAR TOTALMENTE GRANTS PADRÃO DE PUBLIC E ANON
REVOKE ALL ON public.usuarios_erp FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.usuario_escopos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.perfis_acesso FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.perfil_permissoes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.usuario_permissoes FROM PUBLIC, anon, authenticated;

-- 2. CONCEDER APENAS LEITURA PARA AUTHENTICATED E ACESSO TOTAL PARA SERVICE_ROLE
-- Justificativa: perfis_acesso e perfil_permissoes necessitam de SELECT para renderização de catálogos do menu na UI.
GRANT SELECT ON public.usuarios_erp TO authenticated;
GRANT SELECT ON public.usuario_escopos TO authenticated;
GRANT SELECT ON public.perfis_acesso TO authenticated;
GRANT SELECT ON public.perfil_permissoes TO authenticated;
GRANT SELECT ON public.usuario_permissoes TO authenticated;

GRANT ALL ON public.usuarios_erp TO service_role;
GRANT ALL ON public.usuario_escopos TO service_role;
GRANT ALL ON public.perfis_acesso TO service_role;
GRANT ALL ON public.perfil_permissoes TO service_role;
GRANT ALL ON public.usuario_permissoes TO service_role;

-- 3. REMOVER POLÍTICAS ANTIGAS IDEMPOTENTEMENTE
DROP POLICY IF EXISTS usuarios_erp_leitura ON public.usuarios_erp;
DROP POLICY IF EXISTS usuario_escopos_leitura ON public.usuario_escopos;
DROP POLICY IF EXISTS perfis_acesso_leitura ON public.perfis_acesso;
DROP POLICY IF EXISTS perfil_permissoes_leitura ON public.perfil_permissoes;
DROP POLICY IF EXISTS usuario_permissoes_leitura ON public.usuario_permissoes;

DROP POLICY IF EXISTS usuarios_erp_select_policy ON public.usuarios_erp;
DROP POLICY IF EXISTS usuarios_erp_write_policy ON public.usuarios_erp;
DROP POLICY IF EXISTS usuario_escopos_select_policy ON public.usuario_escopos;
DROP POLICY IF EXISTS usuario_escopos_write_policy ON public.usuario_escopos;
DROP POLICY IF EXISTS perfis_acesso_select_policy ON public.perfis_acesso;
DROP POLICY IF EXISTS perfis_acesso_write_policy ON public.perfis_acesso;
DROP POLICY IF EXISTS perfil_permissoes_select_policy ON public.perfil_permissoes;
DROP POLICY IF EXISTS perfil_permissoes_write_policy ON public.perfil_permissoes;
DROP POLICY IF EXISTS usuario_permissoes_select_policy ON public.usuario_permissoes;
DROP POLICY IF EXISTS usuario_permissoes_write_policy ON public.usuario_permissoes;

-- RLS usuarios_erp (Leitura do próprio registro ou Admin da MESMA empresa, Escrita exclusiva service_role)
CREATE POLICY usuarios_erp_select_policy ON public.usuarios_erp
  FOR SELECT USING (
    auth.uid() = auth_user_id
    OR (
      public.hefisto_user_has_permission(auth.uid(), 'configuracoes.users.view')
      AND (
        public.pode_ver_todas()
        OR (unidade_principal_id IS NOT NULL AND hefisto_privado.current_user_can_access_unit(unidade_principal_id))
      )
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY usuarios_erp_write_policy ON public.usuarios_erp FOR ALL USING (auth.role() = 'service_role');

-- RLS usuario_escopos (Leitura do próprio escopo ou Admin da MESMA unidade/empresa, Escrita exclusiva service_role)
CREATE POLICY usuario_escopos_select_policy ON public.usuario_escopos
  FOR SELECT USING (
    usuario_id IN (SELECT id FROM public.usuarios_erp WHERE auth_user_id = auth.uid())
    OR (
      public.hefisto_user_has_permission(auth.uid(), 'configuracoes.users.view')
      AND (
        public.pode_ver_todas()
        OR (unidade_id IS NOT NULL AND hefisto_privado.current_user_can_access_unit(unidade_id))
        OR (empresa_id IS NOT NULL AND hefisto_privado.current_user_can_access_company(empresa_id))
      )
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY usuario_escopos_write_policy ON public.usuario_escopos FOR ALL USING (auth.role() = 'service_role');

-- RLS perfis_acesso (Leitura para authenticated, Escrita exclusiva service_role)
CREATE POLICY perfis_acesso_select_policy ON public.perfis_acesso FOR SELECT USING (true);
CREATE POLICY perfis_acesso_write_policy ON public.perfis_acesso FOR ALL USING (auth.role() = 'service_role');

-- RLS perfil_permissoes (Leitura para authenticated, Escrita exclusiva service_role)
CREATE POLICY perfil_permissoes_select_policy ON public.perfil_permissoes FOR SELECT USING (true);
CREATE POLICY perfil_permissoes_write_policy ON public.perfil_permissoes FOR ALL USING (auth.role() = 'service_role');

-- RLS usuario_permissoes (Leitura do próprio usuário ou Admin da MESMA unidade, Escrita exclusiva service_role)
CREATE POLICY usuario_permissoes_select_policy ON public.usuario_permissoes
  FOR SELECT USING (
    usuario_id IN (SELECT id FROM public.usuarios_erp WHERE auth_user_id = auth.uid())
    OR (
      public.hefisto_user_has_permission(auth.uid(), 'configuracoes.users.view')
      AND (
        public.pode_ver_todas()
        OR EXISTS (
          SELECT 1 FROM public.usuarios_erp u
          WHERE u.id = usuario_permissoes.usuario_id
            AND u.unidade_principal_id IS NOT NULL
            AND hefisto_privado.current_user_can_access_unit(u.unidade_principal_id)
        )
      )
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY usuario_permissoes_write_policy ON public.usuario_permissoes FOR ALL USING (auth.role() = 'service_role');

COMMIT;
