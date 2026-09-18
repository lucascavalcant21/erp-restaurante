-- ═══════════════════════════════════════════════════════════════
-- FASE 3A — ROLLBACK SCRIPT
-- rollback_01_whatsapp_channel.sql
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.whatsapp_processed_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_identities CASCADE;
