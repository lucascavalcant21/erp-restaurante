-- ═══════════════════════════════════════════════════════════════
-- ADICIONAR COLUNA DEPARTAMENTO às tabelas
-- ═══════════════════════════════════════════════════════════════
-- Cole no SQL Editor do Supabase. Isso garante que cardápio e
-- ingredientes sejam filtrados APENAS pelo departamento (bar/cozinha)

-- Cardápio já tem unidade_id, mas vamos usar como departamento_id
-- Se quiser adicionar uma coluna departamento explícita:
-- ALTER TABLE cardapio ADD COLUMN departamento text;
-- ALTER TABLE ingredientes ADD COLUMN departamento text;

-- Para agora, use unidade_id como departamento (bar, cozinha)
-- Dados inseridos com unidade_id="bar" aparecem APENAS no Cardápio Bar
-- Dados inseridos com unidade_id="cozinha" aparecem APENAS no Cardápio Cozinha

-- Se houver dados antigos, limpe-os:
-- DELETE FROM cardapio WHERE unidade_id IS NULL OR unidade_id NOT IN ('bar', 'cozinha', 'cervejas');
-- DELETE FROM ingredientes WHERE unidade_id IS NULL OR unidade_id NOT IN ('bar', 'cozinha');
