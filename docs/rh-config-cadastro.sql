-- ==============================================================================
-- CEREBRO ERP — Evolução do Módulo RH
-- Cargos e Turnos Dinâmicos, Foto 3x4 e Contratos
-- ==============================================================================

-- 1. NOVAS COLUNAS NA TABELA FUNCIONARIOS
ALTER TABLE public.funcionarios
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS funcoes_exercidas TEXT,
ADD COLUMN IF NOT EXISTS tipo_contrato TEXT,
ADD COLUMN IF NOT EXISTS fim_experiencia DATE;

-- 2. TABELA: rh_cargos (Cargos dinâmicos)
CREATE TABLE IF NOT EXISTS public.rh_cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA: rh_turnos (Turnos dinâmicos)
CREATE TABLE IF NOT EXISTS public.rh_turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  unidade_id TEXT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.rh_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_turnos ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (RLS Básico para todos autenticados)
CREATE POLICY "RLS rh_cargos_all" ON public.rh_cargos FOR ALL TO authenticated USING (true);
CREATE POLICY "RLS rh_turnos_all" ON public.rh_turnos FOR ALL TO authenticated USING (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_rh_cargos_unid ON public.rh_cargos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_rh_turnos_unid ON public.rh_turnos(unidade_id);

-- Carga inicial opcional de cargos e turnos padrões para não quebrar o que já existe
-- Inserir para todas as unidades os valores antigos
-- (Removido: O usuário criará manualmente pela interface de configurações)
