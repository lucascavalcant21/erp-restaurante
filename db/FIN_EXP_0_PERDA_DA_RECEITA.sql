-- FIN-EXP-0 · Perda ajustada só na receita (decisão do dono DP-FIN-1, 27/11/2026)
-- ADITIVA. NÃO APLICADA. Aplicar só com aprovação explícita do dono.
--
-- A perda oficial fica no cadastro do ingrediente (insumos). Esta coluna
-- deixa a ficha tirar ou mudar a perda SÓ naquela receita:
--   NULL = usa a perda do cadastro (comportamento de hoje, nada muda);
--   0    = nesta receita, sem perda;
--   > 0  = perda própria desta receita (%).
-- O código (custo-rendimento.mjs/fatorCorrecaoDoItem e as telas) só passa a
-- ler a coluna na fase 3, depois de aplicada.

begin;

-- Preflight: aborta sem mudar nada se a tabela não estiver como esperado.
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fichas_ingredientes') then
    raise exception 'FIN-EXP-0: tabela fichas_ingredientes não existe';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fichas_ingredientes' and column_name = 'perda_receita_pct') then
    raise exception 'FIN-EXP-0: coluna perda_receita_pct já existe (nada a fazer)';
  end if;
end $$;

alter table public.fichas_ingredientes
  add column perda_receita_pct numeric(7,4) null
  check (perda_receita_pct is null or (perda_receita_pct >= 0 and perda_receita_pct < 100));

comment on column public.fichas_ingredientes.perda_receita_pct is
  'Perda só desta receita (%). NULL = usa a perda do cadastro do ingrediente. DP-FIN-1.';

-- Verificação pós-aplicação (impressão digital).
do $$
declare n int;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'fichas_ingredientes' and column_name = 'perda_receita_pct' and is_nullable = 'YES';
  if n <> 1 then raise exception 'FIN-EXP-0: verificação falhou'; end if;
  if exists (select 1 from public.fichas_ingredientes where perda_receita_pct is not null) then
    raise exception 'FIN-EXP-0: coluna nova deveria nascer vazia';
  end if;
end $$;

commit;

-- ROLLBACK (documentado; nunca rodar sem decisão do dono):
--   alter table public.fichas_ingredientes drop column perda_receita_pct;
