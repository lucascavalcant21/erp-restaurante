-- ════════════════════════════════════════════════════════════════════════════
-- TABELA: producoes — Registro de produção do dia (Bar e Cozinha)
-- ════════════════════════════════════════════════════════════════════════════
-- Armazena quem produziu, o quê, quantos, ingredientes usados,
-- se houve alteração na receita e o motivo, custo e receita potencial.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS producoes (
  id                  uuid primary key default gen_random_uuid(),
  unidade_id          text,
  setor               text not null,           -- 'bar' | 'cozinha'
  prato_id            uuid references cardapio(id),
  prato_nome          text not null,
  prato_preco         numeric not null default 0,
  quantidade          numeric not null default 1,
  unidade_medida      text,
  custo_total         numeric not null default 0,
  receita_potencial   numeric not null default 0,
  funcionario_id      uuid,
  funcionario_nome    text,
  teve_alteracao      boolean default false,
  motivo_alteracao    text,
  ingredientes_usados jsonb default '[]',
  sobras              text,
  created_at          timestamptz default now()
);

-- RLS
ALTER TABLE producoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON producoes;
DROP POLICY IF EXISTS "rls_unidade" ON producoes;
CREATE POLICY "rls_unidade" ON producoes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
