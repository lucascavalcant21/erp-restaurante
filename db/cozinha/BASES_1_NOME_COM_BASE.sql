-- BASES_1 — nome das bases termina com "(base)" (pedido do dono, 23/11/2026).
-- "Arroz branco" (base) passa a se chamar "Arroz branco (base)"; o prato "Arroz
-- branco" não muda. O sistema já grava assim daqui em diante (app/lib/nome-base.mjs).
--
-- Só renomeia (UPDATE de nome_receita em fichas_tecnicas com eh_base = true).
-- ATENÇÃO: algumas fichas estão marcadas como base mas parecem pratos/combos
-- (ex.: "Combo Seldeestrela", "Executivo de Carne de sol"). Confira a lista do
-- preflight com o dono antes de aplicar; tire da lista o que não for base.
-- Aplicar em produção SÓ com o OK do dono.

-- 1) PREFLIGHT (só leitura): o que vai mudar
select id, departamento, categoria, nome_receita as antes,
       regexp_replace(btrim(nome_receita), '\s*\(?\s*(base|pr[eé][ -]?preparo)\s*\)?\s*$', '', 'i') || ' (base)' as depois
from fichas_tecnicas
where eh_base = true and coalesce(ativo, true) and btrim(nome_receita) !~* '\(base\)\s*$'
order by departamento, categoria, nome_receita;

-- 2) APLICAR (transação, com cópia dos nomes antigos)
begin;
create table if not exists public.backup_bases_1_nomes as
  select id, nome_receita, now() as copiado_em from fichas_tecnicas where false;
alter table public.backup_bases_1_nomes enable row level security;
revoke all on public.backup_bases_1_nomes from anon, authenticated;
insert into public.backup_bases_1_nomes (id, nome_receita, copiado_em)
  select id, nome_receita, now() from fichas_tecnicas
  where eh_base = true and coalesce(ativo, true) and btrim(nome_receita) !~* '\(base\)\s*$';
update fichas_tecnicas f
   set nome_receita = regexp_replace(btrim(f.nome_receita), '\s*\(?\s*(base|pr[eé][ -]?preparo)\s*\)?\s*$', '', 'i') || ' (base)'
 where f.id in (select id from public.backup_bases_1_nomes);
-- 3) VERIFICAÇÃO: nenhuma base ativa sem "(base)" e a contagem bate com a cópia
select (select count(*) from fichas_tecnicas where eh_base and coalesce(ativo, true) and btrim(nome_receita) !~* '\(base\)\s*$') as faltando,
       (select count(*) from public.backup_bases_1_nomes) as renomeadas;
commit;

-- ROLLBACK (não rodar sem o dono):
-- update fichas_tecnicas f set nome_receita = b.nome_receita from public.backup_bases_1_nomes b where b.id = f.id;
