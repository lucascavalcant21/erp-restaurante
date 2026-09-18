-- ═══════════════════════════════════════════════════════════════
-- FASE 2C — AGENT CORE WRITE CONTROLADO
-- 01_agent_confirmations.sql
-- ═══════════════════════════════════════════════════════════════

-- Table: agent_confirmations
CREATE TABLE IF NOT EXISTS public.agent_confirmations (
    confirmation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(255) NOT NULL,
    agent_run_id VARCHAR(255) NOT NULL,
    tool_call_id VARCHAR(255) NOT NULL,
    tool VARCHAR(100) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    empresa_id VARCHAR(255) NOT NULL,
    unidade_id VARCHAR(255) NOT NULL,
    risk_level VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    input_sanitizado JSONB NOT NULL DEFAULT '{}'::jsonb,
    preview JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, CONFIRMED, CANCELLED, EXPIRED, EXECUTED, FAILED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
    confirmed_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL
);

-- Index for fast lookup by conversation and status
CREATE INDEX IF NOT EXISTS idx_agent_confirmations_conv_status 
ON public.agent_confirmations (conversation_id, user_id, unidade_id, status);

-- Index for cleanup of expired confirmations
CREATE INDEX IF NOT EXISTS idx_agent_confirmations_expires 
ON public.agent_confirmations (expires_at) WHERE status = 'PENDING';

-- Table: agent_write_audit_log
CREATE TABLE IF NOT EXISTS public.agent_write_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confirmation_id UUID REFERENCES public.agent_confirmations(confirmation_id),
    conversation_id VARCHAR(255) NOT NULL,
    agent_run_id VARCHAR(255) NOT NULL,
    tool_call_id VARCHAR(255) NOT NULL,
    tool VARCHAR(100) NOT NULL,
    user_prompt TEXT,
    input_payload JSONB NOT NULL,
    preview_snapshot JSONB NOT NULL,
    risk_level VARCHAR(50) NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    confirmed_by VARCHAR(255) NOT NULL,
    empresa_id VARCHAR(255) NOT NULL,
    unidade_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key VARCHAR(255) NOT NULL,
    generated_record_id VARCHAR(255),
    execution_result JSONB NOT NULL,
    error_detail TEXT,
    reversal_strategy VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_write_audit_user_unidade 
ON public.agent_write_audit_log (requested_by, unidade_id, created_at DESC);
