-- ==============================================================================
-- CEREBRO ERP — Script de Expansão de RH
-- Criação de Bonificações e Fluxograma de Hierarquia
-- ==============================================================================

-- 1. ADICIONAR SUPERVISOR À TABELA FUNCIONARIOS
-- Permite desenhar o organograma sabendo quem responde a quem
ALTER TABLE public.funcionarios 
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL;

-- 2. TABELA: rh_tipos_bonificacao (Regras globais da loja)
CREATE TABLE IF NOT EXISTS public.rh_tipos_bonificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  regras TEXT,
  unidade_id TEXT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA: rh_bonificacoes (Lançamentos p/ os funcionários)
CREATE TABLE IF NOT EXISTS public.rh_bonificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  func_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_id UUID NOT NULL REFERENCES public.rh_tipos_bonificacao(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  obs TEXT,
  unidade_id TEXT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.rh_tipos_bonificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_bonificacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (RLS Básico para todos autenticados)
-- (Pode ser refinado pelo script rls-por-unidade.sql depois)
CREATE POLICY "RLS rh_tipos_bonificacao_all" ON public.rh_tipos_bonificacao FOR ALL TO authenticated USING (true);
CREATE POLICY "RLS rh_bonificacoes_all" ON public.rh_bonificacoes FOR ALL TO authenticated USING (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_rh_tipos_boni_unid ON public.rh_tipos_bonificacao(unidade_id);
CREATE INDEX IF NOT EXISTS idx_rh_boni_func ON public.rh_bonificacoes(func_id);
CREATE INDEX IF NOT EXISTS idx_rh_boni_unid ON public.rh_bonificacoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_func_supervisor ON public.funcionarios(supervisor_id);
