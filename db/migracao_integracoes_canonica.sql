-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION REVISADA (FASEADA): CAMADA CANÔNICA DE INTEGRAÇÕES (IFOOD & SAIPOS)
-- ERP HÉFISTO — Phased Transaction: Preflight Estrutural -> DDL -> Backfill -> Preflight de Dados -> Grants/RLS
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE A — PREFLIGHT ESTRUTURAL & COMPATIBILIDADE DE TIPOS
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- 1. Validar existência de public.unidades e tipo TEXT em id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'unidades' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT STRUCTURAL FAILURE: Tabela public.unidades(id TEXT) não encontrada ou com tipo incorreto.';
  END IF;

  -- 2. Validar existência de public.produtos e tipo UUID em id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT STRUCTURAL FAILURE: Tabela public.produtos(id UUID) não encontrada ou com tipo incorreto.';
  END IF;

  -- 3. Validar tabela de membership public.usuario_unidades e tipos de colunas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuario_unidades' AND column_name = 'usuario_id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'usuario_unidades' AND column_name = 'unidade_id' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT STRUCTURAL FAILURE: Tabela public.usuario_unidades não possui colunas (usuario_id UUID, unidade_id TEXT) compatíveis com auth.uid() e unidades.id.';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE B — ADIÇÃO DE COLUNAS DE RASTREABILIDADE
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'NATIVA';
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS source_external_id text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS upstream_system text;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS upstream_external_id text;

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'NATIVA';
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS source_external_id text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS upstream_system text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS upstream_external_id text;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE C — BACKFILL E GARANTIA NOT NULL EM SOURCE_SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE public.vendas SET source_system = 'NATIVA' WHERE source_system IS NULL;
ALTER TABLE public.vendas ALTER COLUMN source_system SET NOT NULL;

UPDATE public.pedidos SET source_system = 'NATIVA' WHERE source_system IS NULL;
ALTER TABLE public.pedidos ALTER COLUMN source_system SET NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE D — PREFLIGHT DE DADOS & DETECÇÃO DE DUPLICIDADES
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_dup_source integer := 0;
  v_dup_upstream integer := 0;
BEGIN
  -- Checar duplicidades em public.vendas (source_system, source_external_id)
  SELECT COUNT(*) INTO v_dup_source FROM (
    SELECT unidade_id, source_system, source_external_id 
    FROM public.vendas 
    WHERE source_external_id IS NOT NULL 
    GROUP BY unidade_id, source_system, source_external_id 
    HAVING COUNT(*) > 1
  ) dups;

  IF v_dup_source > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT DATA FAILURE: Encontradas % duplicidades em public.vendas (source_external_id). Migration abortada.', v_dup_source;
  END IF;

  -- Checar duplicidades em public.vendas (upstream_system, upstream_external_id)
  SELECT COUNT(*) INTO v_dup_upstream FROM (
    SELECT unidade_id, upstream_system, upstream_external_id 
    FROM public.vendas 
    WHERE upstream_external_id IS NOT NULL 
    GROUP BY unidade_id, upstream_system, upstream_external_id 
    HAVING COUNT(*) > 1
  ) dups;

  IF v_dup_upstream > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT DATA FAILURE: Encontradas % duplicidades em public.vendas (upstream_external_id). Migration abortada.', v_dup_upstream;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FASE E — DDL TABELAS CANÔNICAS & ÍNDICES PARCIAIS UNIQUE
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. TABELA DE CONEXÕES DE INTEGRAÇÕES (public.integration_connections)
-- TENANT CANÔNICO: unidade_id (empresa_id removido para evitar consistência dupla / split-brain)
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id            text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  provider              text NOT NULL CHECK (provider IN ('IFOOD', 'SAIPOS', 'WHATSAPP', 'INSTAGRAM')),
  auth_flow             text DEFAULT 'DISTRIBUTED' CHECK (auth_flow IN ('DISTRIBUTED', 'CENTRALIZED')),
  external_account_id   text,
  external_merchant_id  text,
  status                text NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (status IN ('NOT_CONFIGURED', 'AUTHORIZATION_REQUIRED', 'PENDING_CREDENTIALS', 'CONFIGURED_UNVERIFIED', 'CONNECTED', 'DEGRADED', 'ERROR', 'AUTH_EXPIRED', 'DISABLED')),
  config_json           jsonb DEFAULT '{}'::jsonb,
  last_sync_at          timestamptz,
  last_error            text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT integration_connections_unidade_provider_key UNIQUE (unidade_id, provider)
);

-- 2. TABELA ISOLADA DE SEGREDOS E TOKENS OAUTH (public.integration_secrets)
-- TRANSPARÊNCIA: credentials_payload + security_state DO_NOT_STORE_PRODUCTION_SECRETS
CREATE TABLE IF NOT EXISTS public.integration_secrets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id            text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  provider              text NOT NULL,
  credentials_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  security_state        text DEFAULT 'DO_NOT_STORE_PRODUCTION_SECRETS',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT integration_secrets_unidade_provider_key UNIQUE (unidade_id, provider)
);

-- 3. TABELA DE INBOX DE EVENTOS IDEMPOTENTES (public.integration_events)
-- IDEMPOTÊNCIA GLOBAL SECURA: UNIQUE (provider, provider_event_id) INDEPENDENTE DE UNIDADE_ID NULL
CREATE TABLE IF NOT EXISTS public.integration_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id            text REFERENCES public.unidades(id) ON DELETE SET NULL,
  provider              text NOT NULL,
  provider_event_id     text NOT NULL,
  event_type            text NOT NULL,
  payload               jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                text NOT NULL DEFAULT 'RECEBIDO' CHECK (status IN ('RECEBIDO', 'PROCESSADO', 'ERRO_PROCESSAMENTO', 'FALHA', 'IGNORADO', 'IGNORADO_DUPLICIDADE_SAIPOS', 'IGNORADO_FONTE_OPERACIONAL_SAIPOS', 'QUARANTINED_INVALID_EVENT')),
  attempts              integer DEFAULT 0,
  last_error            text,
  received_at           timestamptz DEFAULT now(),
  processed_at          timestamptz,
  CONSTRAINT integration_events_provider_event_key UNIQUE (provider, provider_event_id)
);

-- 4. TABELA DE MAPEAMENTO DE CARDÁPIO / PRODUTOS EXTERNOS (public.integration_product_mappings)
CREATE TABLE IF NOT EXISTS public.integration_product_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id            text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  provider              text NOT NULL,
  external_product_id   text NOT NULL,
  external_option_id    text NOT NULL DEFAULT 'DEFAULT',
  hefisto_product_id    uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  hefisto_modifier_id   uuid,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT integration_product_mappings_unique_key UNIQUE (unidade_id, provider, external_product_id, external_option_id)
);

-- 5. ÍNDICES DE DESEMPENHO E PARCIAIS DE ANTI-DUPLICIDADE
CREATE INDEX IF NOT EXISTS idx_vendas_upstream_ref ON public.vendas (unidade_id, upstream_system, upstream_external_id);
CREATE INDEX IF NOT EXISTS idx_vendas_source_ref ON public.vendas (unidade_id, source_system, source_external_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_status ON public.integration_events (unidade_id, provider, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_source_ref_unique 
  ON public.vendas (unidade_id, source_system, source_external_id) 
  WHERE source_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_upstream_ref_unique 
  ON public.vendas (unidade_id, upstream_system, upstream_external_id) 
  WHERE upstream_external_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════════════════════════════
-- FASE F — PRIVILÉGIOS (GRANTS ZERO-TRUST) & POLÍTICAS RLS EXCLUSIVAS SERVICE-ROLE (BACKEND-ONLY)
-- ══════════════════════════════════════════════════════════════════════════════

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_product_mappings ENABLE ROW LEVEL SECURITY;

-- 1. REVOGAÇÃO COMPLETA DE PADRÃO (GRANTS ZERO-TRUST INICIAIS)
REVOKE ALL ON public.integration_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.integration_secrets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.integration_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.integration_product_mappings FROM PUBLIC, anon, authenticated;

-- 2. CONCESSÃO EXPLÍCITA DE MENOR PRIVILÉGIO (ACESSO EXCLUSIVO BACKEND SERVICE-ROLE)
-- A UI acessa os dados sanitizados exclusivamente via endpoints Server-Side autorizados (/api/integrations, /api/integrations/events)
GRANT ALL ON public.integration_connections TO service_role;
GRANT ALL ON public.integration_secrets TO service_role;
GRANT ALL ON public.integration_events TO service_role;
GRANT ALL ON public.integration_product_mappings TO service_role;

-- 3. POLÍTICAS RLS IDEMPOTENTES (DROP IF EXISTS + CREATE)
DROP POLICY IF EXISTS integration_connections_select_policy ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_write_policy ON public.integration_connections;
DROP POLICY IF EXISTS integration_connections_service_role_only ON public.integration_connections;

DROP POLICY IF EXISTS integration_secrets_service_role_only ON public.integration_secrets;

DROP POLICY IF EXISTS integration_events_service_role_only ON public.integration_events;

DROP POLICY IF EXISTS integration_product_mappings_select_policy ON public.integration_product_mappings;
DROP POLICY IF EXISTS integration_product_mappings_write_policy ON public.integration_product_mappings;
DROP POLICY IF EXISTS integration_product_mappings_service_role_only ON public.integration_product_mappings;

-- RLS: Acesso Exclusivo para service_role (Backend Héfisto)
CREATE POLICY integration_connections_service_role_only ON public.integration_connections
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY integration_secrets_service_role_only ON public.integration_secrets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY integration_events_service_role_only ON public.integration_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY integration_product_mappings_service_role_only ON public.integration_product_mappings
  FOR ALL USING (auth.role() = 'service_role');

COMMIT;

