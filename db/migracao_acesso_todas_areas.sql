-- ─────────────────────────────────────────────────────────────────────────────
-- ACESSO A TODAS AS ÁREAS (colaboradores.acesso_todas_areas)
--
-- Por que existe: no ponto e no estoque, cada área mostra só a sua equipe. Mas
-- algumas pessoas cobrem qualquer setor E têm setor próprio no cargo — a chefia
-- de salão, por exemplo. A regra de liderança sozinha não alcança essas
-- pessoas, porque "Chef de Garçom" pertence ao salão.
--
-- Por que uma coluna e não uma lista de nomes no código: nome muda. Já
-- aconteceu aqui — "UHL" virou "UHE" e a comparação por nome quebrou. Marca no
-- cadastro sobrevive a correção de nome e o RH altera sozinho.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores
  add column if not exists acesso_todas_areas boolean not null default false;

-- Sarah, Lucas e Larissa circulam por todas as áreas.
update public.colaboradores
   set acesso_todas_areas = true
 where unidade_id = 'seldeestrela'
   and (upper(nome) like 'SARAH%'
     or upper(nome) like 'LUCAS%'
     or upper(nome) like 'LARISSA%');

notify pgrst, 'reload schema';

-- Confira quem ficou marcado:
select nome, cargo, acesso_todas_areas
  from public.colaboradores
 where unidade_id = 'seldeestrela'
 order by acesso_todas_areas desc, nome;
