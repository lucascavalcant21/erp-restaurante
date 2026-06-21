-- ==============================================================================
-- CEREBRO ERP — Sprint 1: RH Central
-- Criação de Atas de Reunião e Histórico de Vida do Colaborador
-- ==============================================================================

-- 1. TABELA: rh_atas (Atas de Reunião com upload de PDF/Arquivo)
CREATE TABLE IF NOT EXISTS public.rh_atas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  func_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  unidade_id TEXT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  assunto TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TABELA: rh_historico (Linha do tempo: promoções, contratos, salários)
CREATE TABLE IF NOT EXISTS public.rh_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  func_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  unidade_id TEXT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo_evento TEXT NOT NULL, -- Ex: 'contrato', 'cargo', 'salario', 'unidade'
  valor_antigo TEXT,
  valor_novo TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.rh_atas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_historico ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança (RLS Básico para todos autenticados)
CREATE POLICY "RLS rh_atas_all" ON public.rh_atas FOR ALL TO authenticated USING (true);
CREATE POLICY "RLS rh_historico_all" ON public.rh_historico FOR ALL TO authenticated USING (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_rh_atas_func ON public.rh_atas(func_id);
CREATE INDEX IF NOT EXISTS idx_rh_atas_unid ON public.rh_atas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_rh_historico_func ON public.rh_historico(func_id);
CREATE INDEX IF NOT EXISTS idx_rh_historico_unid ON public.rh_historico(unidade_id);
