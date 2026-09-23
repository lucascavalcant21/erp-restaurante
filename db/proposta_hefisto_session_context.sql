-- ══════════════════════════════════════════════════════════════════════════════
-- PROPOSTA DE MIGRAÇÃO: hefisto_session_context ENFORCE FAIL-CLOSED
-- HÉFISTO ERP — Reutilização estrita de hefisto_usuario_valido(auth.uid())
-- ══════════════════════════════════════════════════════════════════════════════
-- STATUS: PROPOSED (NÃO EXECUTAR EM BANCO)

CREATE OR REPLACE FUNCTION public.hefisto_session_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user public.usuarios_erp%rowtype;
  v_permissions jsonb;
  v_scopes jsonb;
  v_profile_name text;
  v_profile_active boolean;
BEGIN
  -- REGRA 1: Se auth.uid() for nulo -> NENHUM CONTEXTO PRIVILEGIADO
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- REGRA 2: Validação central do usuário via public.hefisto_usuario_valido(auth.uid())
  -- Valida: existência, status = 'ativo', locked_until expirado, valid_from/valid_until, etc.
  IF NOT public.hefisto_usuario_valido(v_uid) THEN
    RETURN NULL;
  END IF;

  -- Buscar dados do usuário
  SELECT * INTO v_user FROM public.usuarios_erp WHERE auth_user_id = v_uid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- REGRA 3: Validar se o perfil associado está ativo (para não-super_admin)
  IF v_user.perfil_id IS NOT NULL THEN
    SELECT ativo, nome INTO v_profile_active, v_profile_name 
    FROM public.perfis_acesso 
    WHERE id = v_user.perfil_id;

    IF NOT v_user.super_admin AND (v_profile_active IS NOT TRUE) THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Construir permissões ativas
  IF v_user.super_admin THEN
    v_permissions := '"*"'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_agg(DISTINCT permission_key), '[]'::jsonb)
    INTO v_permissions
    FROM (
      SELECT pp.permission_key
      FROM public.perfil_permissoes pp
      WHERE pp.perfil_id = v_user.perfil_id
        AND NOT EXISTS (
          SELECT 1 FROM public.usuario_permissoes d
          WHERE d.usuario_id = v_user.id 
            AND d.effect = 'deny'
            AND public.hefisto_permission_match(d.permission_key, pp.permission_key)
        )
      UNION
      SELECT up.permission_key 
      FROM public.usuario_permissoes up
      WHERE up.usuario_id = v_user.id 
        AND up.effect = 'allow'
    ) p;
  END IF;

  -- Construir escopos ativos
  SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
  INTO v_scopes 
  FROM public.usuario_escopos e 
  WHERE e.usuario_id = v_user.id;

  RETURN jsonb_build_object(
    'erp_user_id', v_user.id,
    'nome', v_user.nome,
    'login', v_user.login,
    'email', v_user.email,
    'papel', CASE WHEN v_user.super_admin THEN 'admin' ELSE v_user.tipo_acesso END,
    'tipo_acesso', v_user.tipo_acesso,
    'status', v_user.status,
    'super_admin', v_user.super_admin,
    'perfil_id', v_user.perfil_id,
    'perfil', v_profile_name,
    'unidade', v_user.unidade_principal_id,
    'setor_id', v_user.setor_principal_id,
    'home', v_user.pagina_inicial,
    'must_change_password', v_user.exigir_troca_senha,
    'terminate_previous_sessions', v_user.encerrar_sessoes_anteriores,
    'permissions', v_permissions,
    'scopes', v_scopes
  );
END $$;

REVOKE ALL ON FUNCTION public.hefisto_session_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hefisto_session_context() TO authenticated, service_role;
