-- Migration F9: Tabela de Automações Programadas do Héfisto
CREATE TABLE IF NOT EXISTS public.hefisto_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  routine_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  trigger_type VARCHAR(50) DEFAULT 'SCHEDULED',
  schedule_time VARCHAR(10) NOT NULL, -- "08:00"
  schedule_days INT[] NOT NULL, -- [1,2,3,4,5] (Seg-Sex)
  timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
  required_permissions TEXT[] DEFAULT '{}',
  execution_mode VARCHAR(50) DEFAULT 'READ_ONLY_AUTOMATION',
  max_runtime_ms INT DEFAULT 10000,
  owner_id VARCHAR(100) NOT NULL,
  owner_email VARCHAR(255),
  consecutive_failures INT DEFAULT 0,
  paused_reason TEXT,
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Histórico de Execuções e Idempotência
CREATE TABLE IF NOT EXISTS public.hefisto_automation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.hefisto_automations(id) ON DELETE CASCADE,
  tenant_id VARCHAR(100) NOT NULL,
  deduplication_key VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL, -- 'SCHEDULED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED', 'CANCELLED'
  duration_ms INT,
  summary_text TEXT,
  evidence_json JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Desempenho e Multitenant
CREATE INDEX IF NOT EXISTS idx_hefisto_automations_tenant ON public.hefisto_automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hefisto_automations_next ON public.hefisto_automations(next_execution_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_hefisto_auto_history_dedup ON public.hefisto_automation_history(deduplication_key);

-- RLS (Row Level Security)
ALTER TABLE public.hefisto_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hefisto_automation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso por Tenant em hefisto_automations"
  ON public.hefisto_automations FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true) OR current_user = 'postgres');
