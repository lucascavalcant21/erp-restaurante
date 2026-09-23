-- ═══════════════════════════════════════════════════════════════
-- FASE 3A — WHATSAPP CHANNEL ADAPTER
-- 01_whatsapp_channel.sql
-- ═══════════════════════════════════════════════════════════════

-- Table: whatsapp_identities
CREATE TABLE IF NOT EXISTS public.whatsapp_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(50) UNIQUE NOT NULL, -- E.164 format ex: +5511987654321
    user_id VARCHAR(255) NOT NULL,
    empresa_id VARCHAR(255) NOT NULL,
    unidade_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ADMIN', -- ADMIN, FUNCIONARIO, CLIENTE
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_identities_phone 
ON public.whatsapp_identities (phone_number, active);

-- Table: whatsapp_processed_messages (Webhook Idempotency)
CREATE TABLE IF NOT EXISTS public.whatsapp_processed_messages (
    external_message_id VARCHAR(255) PRIMARY KEY,
    phone_number VARCHAR(50) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED'
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_proc_msg_date 
ON public.whatsapp_processed_messages (processed_at);
