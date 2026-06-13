-- ════════════════════════════════════════════════════════════════════════════
-- RLS POR UNIDADE — Cerebro ERP
-- ────────────────────────────────────────────────────────────────────────────
-- Isola os dados de cada restaurante por usuário logado.
--
-- COMO FUNCIONA:
--   Cada usuário no Supabase Auth tem `user_metadata` com:
--     { "papel": "gerente", "unidade": "seldeestrela" }
--
--   As policies leem esses valores diretamente do JWT em tempo de consulta.
--
-- REGRAS:
--   admin      → vê tudo (papel = "admin")
--   financeiro → vê tudo (papel = "financeiro")
--   demais     → só vê dados onde unidade_id = sua unidade
--   Central (unidade = "todas" ou null) → tratado como admin
--
-- ⚠️  RODE APÓS docs/vendas.sql já ter sido executado.
-- ⚠️  Antes de rodar, certifique-se que todos os usuários têm `unidade`
--     corretamente preenchido em Authentication → Users → user_metadata.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Funções auxiliares que leem o JWT ─────────────────────────────────────

-- Retorna o papel do usuário logado (ex: "admin", "gerente", "caixa")
CREATE OR REPLACE FUNCTION auth_papel()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'papel'),
    ''
  );
$$;

-- Retorna a unidade_id do usuário logado (ex: "seldeestrela", "burguer")
-- Retorna '' se for admin/financeiro/todas ou se não tiver unidade
CREATE OR REPLACE FUNCTION auth_unidade_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'unidade', 'todas'),
    ''
  );
$$;

-- Retorna TRUE se o usuário pode ver dados de TODAS as unidades
-- (admin, financeiro, ou sem unidade definida)
CREATE OR REPLACE FUNCTION pode_ver_todas()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth_papel() IN ('admin', 'financeiro')
    OR auth_unidade_id() = ''
    OR auth_unidade_id() IS NULL;
$$;

-- ── 2. Macro interna para aplicar a policy em uma tabela ──────────────────────
-- (executada via DO $$ abaixo)

-- ── 3. Aplicar RLS por unidade em todas as tabelas com unidade_id ─────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'estoque',
    'estoque_movimentacoes',
    'ingredientes',
    'cardapio',
    'fichas_tecnicas',
    'ficha_itens',
    'funcionarios',
    'registros_ponto',
    'holerites',
    'func_documentos',
    'avisos',
    'advertencias',
    'producoes',
    'cursos',
    'clientes',
    'avaliacoes_nps',
    'campanhas',
    'eventos',
    'fornecedores',
    'documentos',
    'lancamentos',
    'etiquetas',
    'vendas',
    'venda_itens'
  ]
  LOOP
    -- Só aplica se a tabela existir
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Garante RLS ligado
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

      -- Remove policies antigas
      EXECUTE format('DROP POLICY IF EXISTS "auth_full_access" ON public.%I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "auth_all" ON public.%I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "rls_unidade" ON public.%I;', t);

      -- Cria a nova policy por unidade
      EXECUTE format($$
        CREATE POLICY "rls_unidade" ON public.%I
          FOR ALL
          TO authenticated
          USING (
            pode_ver_todas()
            OR unidade_id = auth_unidade_id()
            OR unidade_id IS NULL
          )
          WITH CHECK (
            pode_ver_todas()
            OR unidade_id = auth_unidade_id()
            OR unidade_id IS NULL
          );
      $$, t);

      RAISE NOTICE 'RLS por unidade aplicado em: %', t;
    ELSE
      RAISE NOTICE 'Tabela não encontrada (pulada): %', t;
    END IF;
  END LOOP;
END $$;

-- ── 4. Tabela `unidades` — todos autenticados veem (necessário para o seletor) ─

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unidades FROM anon;
GRANT SELECT ON public.unidades TO authenticated;

DROP POLICY IF EXISTS "auth_full_access" ON public.unidades;
DROP POLICY IF EXISTS "rls_unidade" ON public.unidades;
CREATE POLICY "todos_authenticated_leem" ON public.unidades
  FOR SELECT TO authenticated
  USING (true);

-- ── 5. Tabela `etiquetas` — mantém leitura pública (QR sem login) ─────────────
-- A policy de unidade acima cobre authenticated.
-- Aqui garantimos que anon ainda pode LER (rastreio QR público).

ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_leitura_publica" ON public.etiquetas;
CREATE POLICY "anon_leitura_publica" ON public.etiquetas
  FOR SELECT TO anon
  USING (true);

-- ── 6. Tabela `ficha_itens` — sem unidade_id, usa a ficha_id como escopo ──────
-- ficha_itens não tem unidade_id direto; o acesso é filtrado pela ficha_tecnica.
-- Mantemos a policy de "qualquer autenticado" para esta tabela auxiliar.

DROP POLICY IF EXISTS "rls_unidade" ON public.ficha_itens;
CREATE POLICY "auth_full_access" ON public.ficha_itens
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── 7. Diagnóstico — verifique o resultado ────────────────────────────────────
-- Execute separadamente para confirmar:
--
-- SELECT tablename, policyname, roles, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
