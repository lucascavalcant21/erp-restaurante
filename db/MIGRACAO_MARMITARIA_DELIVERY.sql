/* ═══════════════════════════════════════════════════════════════════════════════
   MIGRAÇÃO HÉFISTO ERP — OPERAÇÃO MARMITARIA & DELIVERY
   
   Adiciona centro de resultado, tabelas de apoio à operação de marmitas,
   fichas de montagem, embalagens vinculadas, precificação por canal,
   simulações de vendas, lotes de produção e alocações de RH.

   SEGURANÇA:
   - Totalmente não-destrutiva (apenas ADD COLUMN IF NOT EXISTS e CREATE TABLE IF NOT EXISTS)
   - Idempotente (pode ser executada múltiplas vezes sem erro)
   - RLS habilitado com políticas para usuários autenticados
   ═══════════════════════════════════════════════════════════════════════════════ */

BEGIN;

-- 1. CENTRO DE RESULTADO MARMITARIA & DELIVERY
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fin_centros_custo') THEN
    INSERT INTO public.fin_centros_custo (codigo, nome, ordem, ativo)
    VALUES ('marmitaria', 'Marmitaria & Delivery', 55, true)
    ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, ativo = true;
  END IF;
END $$;

-- 2. CAMPOS ADICIONAIS EM FICHAS TÉCNICAS (100% COMPATÍVEL)
ALTER TABLE IF EXISTS public.fichas_tecnicas
  ADD COLUMN IF NOT EXISTS tamanho_marmita text DEFAULT 'M',
  ADD COLUMN IF NOT EXISTS descricao_comercial text,
  ADD COLUMN IF NOT EXISTS montagem_sequencia jsonb DEFAULT '[]'::jsonb;

-- 3. EMBALAGENS VINCULADAS À FICHA DA MARMITA
CREATE TABLE IF NOT EXISTS public.marmitaria_fichas_embalagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  ficha_id uuid NOT NULL REFERENCES public.fichas_tecnicas(id) ON DELETE CASCADE,
  embalagem_insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  tipo_embalagem text NOT NULL DEFAULT 'marmita',
  quantidade numeric NOT NULL DEFAULT 1,
  custo_unitario numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marmitaria_fichas_emb_ficha
  ON public.marmitaria_fichas_embalagens(ficha_id);

-- 4. PRECIFICAÇÃO POR CANAL DE VENDA
CREATE TABLE IF NOT EXISTS public.marmitaria_precificacao_canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  ficha_id uuid NOT NULL REFERENCES public.fichas_tecnicas(id) ON DELETE CASCADE,
  canal text NOT NULL,
  preco_venda numeric NOT NULL DEFAULT 0,
  taxa_canal_pct numeric NOT NULL DEFAULT 0,
  taxa_pagamento_pct numeric NOT NULL DEFAULT 0,
  subsidio_entrega numeric NOT NULL DEFAULT 0,
  promocao_desconto numeric NOT NULL DEFAULT 0,
  tributos_pct numeric NOT NULL DEFAULT 0,
  margem_meta_pct numeric NOT NULL DEFAULT 20,
  preco_sugerido numeric NOT NULL DEFAULT 0,
  aprovado boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_marmitaria_precificacao UNIQUE(unidade_id, ficha_id, canal)
);

-- 5. SIMULAÇÕES DE VENDAS SALVAS
CREATE TABLE IF NOT EXISTS public.marmitaria_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  cenario_meta_diaria integer NOT NULL DEFAULT 100,
  dias_operacao_mes integer NOT NULL DEFAULT 26,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  resultado_consolidado jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- 6. PRODUÇÃO DE MARMITAS & RENDIMENTO REAL
CREATE TABLE IF NOT EXISTS public.marmitaria_producao_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  tipo_demanda text NOT NULL DEFAULT 'antecipada',
  status text NOT NULL DEFAULT 'planejado',
  ficha_id uuid REFERENCES public.fichas_tecnicas(id) ON DELETE SET NULL,
  quantidade_planejada numeric NOT NULL DEFAULT 0,
  quantidade_produzida numeric NOT NULL DEFAULT 0,
  quantidade_perdas numeric NOT NULL DEFAULT 0,
  motivo_perda text,
  rendimento_real_dados jsonb DEFAULT '{}'::jsonb,
  data_producao date NOT NULL DEFAULT current_date,
  responsavel_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  custo_total numeric NOT NULL DEFAULT 0,
  baixou_ingredientes boolean NOT NULL DEFAULT false,
  baixou_embalagens boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marmitaria_prod_data
  ON public.marmitaria_producao_lotes(unidade_id, data_producao);

-- 7. TRANSFERÊNCIAS ENTRE COZINHA PRINCIPAL E MARMITARIA
CREATE TABLE IF NOT EXISTS public.marmitaria_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  unidade_medida text NOT NULL,
  origem text NOT NULL DEFAULT 'cozinha_principal',
  destino text NOT NULL DEFAULT 'marmitaria',
  data date NOT NULL DEFAULT current_date,
  solicitado_por uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'concluido',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. ALOCAÇÃO DE RH E CMO DA MARMITARIA
CREATE TABLE IF NOT EXISTS public.marmitaria_rh_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo_alocacao text NOT NULL DEFAULT 'compartilhado',
  percentual_tempo numeric NOT NULL DEFAULT 100,
  horas_por_semana numeric DEFAULT 44,
  turno text DEFAULT 'Manhã',
  funcao_marmitaria text DEFAULT 'Preparo e Montagem',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_marmitaria_colaborador UNIQUE(unidade_id, colaborador_id)
);

-- 9. CONFIGURAÇÕES OPERACIONAIS DA MARMITARIA
CREATE TABLE IF NOT EXISTS public.marmitaria_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id text NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE UNIQUE,
  taxa_ifood_padrao_pct numeric DEFAULT 15.0,
  taxa_cartao_padrao_pct numeric DEFAULT 2.5,
  impostos_padrao_pct numeric DEFAULT 6.0,
  margem_lucro_alvo_pct numeric DEFAULT 20.0,
  capacidade_diaria_marmitas integer DEFAULT 150,
  horario_inicio time DEFAULT '09:00',
  horario_fim time DEFAULT '15:00',
  alocacao_custos_fixos_pct numeric DEFAULT 25.0,
  canais_ativos jsonb DEFAULT '["ifood", "whatsapp", "balcao"]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. SEGURANÇA E RLS
ALTER TABLE public.marmitaria_fichas_embalagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_precificacao_canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_producao_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_rh_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marmitaria_configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marmitaria_fichas_embalagens',
    'marmitaria_precificacao_canais',
    'marmitaria_simulacoes',
    'marmitaria_producao_lotes',
    'marmitaria_transferencias',
    'marmitaria_rh_alocacoes',
    'marmitaria_configuracoes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_auth_all ON public.%I', t);
    EXECUTE format('CREATE POLICY p_auth_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

COMMIT;
