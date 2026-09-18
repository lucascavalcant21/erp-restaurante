-- ═══════════════════════════════════════════════════════════════
-- FASE 2C — ROLLBACK SCRIPT
-- rollback_01_agent_confirmations.sql
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.agent_write_audit_log CASCADE;
DROP TABLE IF EXISTS public.agent_confirmations CASCADE;
