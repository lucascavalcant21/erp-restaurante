/* ═══════════════════════════════════════════════════════════════════════════════
   MIGRAÇÃO HÉFISTO ERP — MARMITARIA: INTELIGÊNCIA OPERACIONAL & QUALIDADE
   
   Adiciona:
   - Planos operacionais diários e semanais 360º (marmitaria_planos_operacionais)
   - Planos de assinaturas e vendas recorrentes (marmitaria_assinaturas)
   - Controle de qualidade, ocorrências e avaliações (marmitaria_qualidade_ocorrencias)
   - Rastreabilidade sanitária e controle térmico ANVISA RDC 216 em lotes
   
   Idempotente e seguro com RLS ativo.
   ═══════════════════════════════════════════════════════════════════════════════ */

BEGIN;

-- 1. CAMPOS DE RASTREABILIDADE SANITÁRIA EM LOTES DE PRODUÇÃO
ALTER TABLE IF EXISTS public.marmitaria_producao_lotes
  ADD COLUMN IF NOT EXISTS temperatura_coccao_c numeric,
  ADD COLUMN IF NOT EXISTS temperatura_expedicao_c numeric,
  ADD COLUMN IF NOT EXISTS data_validade date,
  ADD COLUMN IF NOT EXISTS lote_sanitario text,
  ADD COLUMN IF NOT EXISTS conformidade_sanitaria boolean DEFAULT true;

-- 2. CENTRAL DE PLANEJAMENTO OPERACIONAL 360º
CREATE TABLE IF NOT EXISTS public.marmitaria_planos_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  data_planejada date NOT NULL DEFAULT current_date,
  periodo_tipo text NOT NULL DEFAULT 'amanha', -- 'amanha', 'semana', 'personalizado'
  meta_total_marmitas integer NOT NULL DEFAULT 100,
  faturamento_previsto numeric NOT NULL DEFAULT 0,
  cmv_previsto numeric NOT NULL DEFAULT 0,
  margem_prevista numeric NOT NULL DEFAULT 0,
  pessoas_necessarias integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'rascunho', -- 'rascunho', 'aprovado', 'em_execucao', 'concluido'
  dados_completos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marmitaria_planos_data
  ON public.marmitaria_planos_operacionais(unidade_id, data_planejada);

-- 3. ASSINATURAS E PLANOS RECORRENTES DE MARMITAS
CREATE TABLE IF NOT EXISTS public.marmitaria_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  cliente_nome text NOT NULL,
  cliente_telefone text,
  plano_tipo text NOT NULL DEFAULT 'semanal', -- 'semanal_5dias', 'semanal_7dias', 'mensal_20marmitas', 'mensal_30marmitas'
  quantidade_marmitas_periodo integer NOT NULL DEFAULT 5,
  dias_entrega jsonb NOT NULL DEFAULT '["seg", "ter", "qua", "qui", "sex"]'::jsonb,
  valor_recorrente numeric NOT NULL DEFAULT 120.0,
  forma_cobranca text NOT NULL DEFAULT 'pix_semanal',
  status text NOT NULL DEFAULT 'ativo', -- 'ativo', 'pausado', 'cancelado'
  data_inicio date NOT NULL DEFAULT current_date,
  preferencias_cardapio text,
  endereco_entrega text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. GESTÃO DE QUALIDADE, OCORRÊNCIAS & LGPD
CREATE TABLE IF NOT EXISTS public.marmitaria_qualidade_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'erro_montagem', 'atraso_entrega', 'temperatura_inadequada', 'item_faltante', 'embalagem_violada', 'elogio'
  pedido_codigo text,
  produto_id uuid REFERENCES public.fichas_tecnicas(id) ON DELETE SET NULL,
  gravidade text NOT NULL DEFAULT 'baixa', -- 'baixa', 'media', 'alta'
  nota_avaliacao integer, -- 1 a 5 estrelas
  custo_reembolso numeric DEFAULT 0,
  descricao text NOT NULL,
  acao_corretiva text,
  responsavel_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. SEGURANÇA E RLS
ALTER TABLE public.marmitaria_planos_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_qualidade_ocorrencias ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marmitaria_planos_operacionais',
    'marmitaria_assinaturas',
    'marmitaria_qualidade_ocorrencias'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_auth_all ON public.%I', t);
    EXECUTE format('CREATE POLICY p_auth_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

COMMIT;
