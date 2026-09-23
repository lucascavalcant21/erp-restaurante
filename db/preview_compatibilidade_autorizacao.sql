-- ══════════════════════════════════════════════════════════════════════════════
-- PREVIEW DE COMPATIBILIDADE SOMENTE LEITURA — HOTFIX V4 (ERP HÉFISTO)
-- Executar ANTES da aplicação do Hotfix V4 para auditar usuários e unidades
-- ══════════════════════════════════════════════════════════════════════════════

SELECT 
  u.id AS usuario_erp_id,
  u.auth_user_id,
  u.login,
  u.status,
  p.codigo AS perfil_atual_codigo,
  p.ativo AS perfil_atual_ativo,
  u.unidade_principal_id,
  COUNT(DISTINCT e.unidade_id) FILTER (WHERE e.unidade_id IS NOT NULL) AS qtd_escopos_unidade,
  ARRAY_AGG(DISTINCT e.empresa_id) FILTER (WHERE e.empresa_id IS NOT NULL) AS empresas_dos_escopos,
  COALESCE(BOOL_OR(e.data_scope = 'empresa'), false) AS possui_data_scope_empresa,
  COALESCE(BOOL_OR(e.data_scope = 'todos'), false) AS possui_data_scope_todos,
  -- Novo auth_papel() simulado
  COALESCE(
    (
      SELECT CASE 
        WHEN p_sub.codigo IN ('admin', 'administrador', 'administrador-geral') THEN 'admin'
        WHEN p_sub.codigo IN ('gerente', 'gerente-geral') THEN 'gerente'
        ELSE p_sub.codigo
      END
      FROM public.perfis_acesso p_sub 
      WHERE p_sub.id = u.perfil_id AND p_sub.ativo AND u.status = 'ativo'
    ),
    'nao_autorizado'
  ) AS novo_auth_papel,
  -- Novo auth_unidade_id()
  u.unidade_principal_id AS novo_auth_unidade_id,
  -- Verificação de perda de acesso
  CASE 
    WHEN u.status <> 'ativo' THEN 'SIM (USUÁRIO INATIVO)'
    WHEN p.id IS NULL OR NOT p.ativo THEN 'SIM (PERFIL INATIVO OU AUSENTE)'
    WHEN u.unidade_principal_id IS NULL AND COUNT(DISTINCT e.unidade_id) FILTER (WHERE e.unidade_id IS NOT NULL) = 0 AND NOT u.super_admin THEN 'SIM (SEM UNIDADE PRINCIPAL E SEM ESCOPOS)'
    ELSE 'NÃO'
  END AS perderia_acesso,
  CASE 
    WHEN u.unidade_principal_id IS NULL AND COUNT(DISTINCT e.unidade_id) FILTER (WHERE e.unidade_id IS NOT NULL) = 0 THEN 'SIM'
    ELSE 'NÃO'
  END AS ficaria_sem_unidade
FROM public.usuarios_erp u
LEFT JOIN public.perfis_acesso p ON p.id = u.perfil_id
LEFT JOIN public.usuario_escopos e ON e.usuario_id = u.id
GROUP BY u.id, u.auth_user_id, u.login, u.status, p.id, p.codigo, p.ativo, u.unidade_principal_id, u.super_admin;
