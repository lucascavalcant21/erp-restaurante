-- Rollback F9: Remoção de Automações Programadas do Héfisto
DROP TABLE IF EXISTS public.hefisto_automation_history;
DROP TABLE IF EXISTS public.hefisto_automations;
