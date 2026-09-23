-- ══════════════════════════════════════════════════════════════════════════════
-- SCRIPT DE PREFLIGHT AUDIT: CAMADA CANÔNICA DE INTEGRAÇÕES (HÉFISTO ERP)
-- Execute este script no SQL Editor do Supabase ANTES de aplicar a Migration.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. VERIFICAÇÃO DE TIPOS E EXISTÊNCIA DE TABELAS CRÍTICAS
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (
    (table_name = 'unidades' AND column_name = 'id')
    OR (table_name = 'produtos' AND column_name = 'id')
    OR (table_name = 'usuario_unidades' AND column_name IN ('usuario_id', 'unidade_id'))
    OR (table_name = 'vendas' AND column_name IN ('id', 'unidade_id'))
  );

-- 2. AUDITORIA DE DUPLICIDADES EXISTENTES EM VENDAS (SOURCE REF)
SELECT 
  unidade_id, 
  source_system, 
  source_external_id, 
  COUNT(*) as total_duplicatas
FROM public.vendas
WHERE source_external_id IS NOT NULL
GROUP BY unidade_id, source_system, source_external_id
HAVING COUNT(*) > 1;

-- 3. AUDITORIA DE DUPLICIDADES EXISTENTES EM VENDAS (UPSTREAM REF)
SELECT 
  unidade_id, 
  upstream_system, 
  upstream_external_id, 
  COUNT(*) as total_duplicatas
FROM public.vendas
WHERE upstream_external_id IS NOT NULL
GROUP BY unidade_id, upstream_system, upstream_external_id
HAVING COUNT(*) > 1;

-- 4. VERIFICAÇÃO DE USUÁRIOS SEM VÍNCULO DE UNIDADE (MEMBERSHIP CHECK)
SELECT 
  count(*) as total_usuarios_sem_unidade 
FROM auth.users u
LEFT JOIN public.usuario_unidades uu ON u.id = uu.usuario_id
WHERE uu.unidade_id IS NULL;
