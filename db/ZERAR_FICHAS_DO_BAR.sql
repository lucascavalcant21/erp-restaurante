-- ═══════════════════════════════════════════════════════════════════════════
-- ZERAR O RECEITUÁRIO DO BAR
--
-- Apaga TODAS as fichas técnicas do departamento "bar" desta unidade, com os
-- ingredientes e o histórico de custo delas. NÃO TEM DESFAZER.
--
-- Rode o PASSO 1 sozinho primeiro e leia o que aparece. Só depois rode o resto.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── PASSO 1: OLHE ANTES DE APAGAR ──────────────────────────────────────────
-- Troque 'SUA_UNIDADE' pelo id da sua unidade nos dois lugares da consulta.
-- Confira o total e o que está na lista. Se vier ficha que você quer manter,
-- pare aqui e me avise.
select
  f.nome_receita,
  f.categoria,
  f.eh_base,
  f.tipo_base,
  (select count(*) from public.fichas_ingredientes i where i.ficha_id = f.id) as ingredientes
from public.fichas_tecnicas f
where f.unidade_id = 'SUA_UNIDADE'
  and f.departamento = 'bar'
order by ingredientes desc, f.nome_receita;


-- ── PASSO 2: APAGAR ────────────────────────────────────────────────────────
-- Roda tudo junto, dentro de uma transação: ou apaga tudo, ou não apaga nada.
-- Se algo der errado no meio, o banco volta sozinho ao estado anterior.
begin;

-- Solta o vínculo dos produtos do cardápio antes de apagar a ficha. Sem isto,
-- ou o delete é recusado, ou o produto some junto por cascata — e o cardápio
-- não deveria perder o item só porque a receita dele foi refeita.
update public.produtos p
   set ficha_id = null
 where p.ficha_id in (
   select f.id from public.fichas_tecnicas f
    where f.unidade_id = 'SUA_UNIDADE' and f.departamento = 'bar'
 );

-- Ingredientes e histórico de custo. As duas têm "on delete cascade" na maioria
-- dos bancos, mas apagar explicitamente evita depender disso.
delete from public.fichas_ingredientes
 where ficha_id in (
   select f.id from public.fichas_tecnicas f
    where f.unidade_id = 'SUA_UNIDADE' and f.departamento = 'bar'
 );

delete from public.fichas_custo_historico
 where ficha_id in (
   select f.id from public.fichas_tecnicas f
    where f.unidade_id = 'SUA_UNIDADE' and f.departamento = 'bar'
 );

-- As fichas.
delete from public.fichas_tecnicas
 where unidade_id = 'SUA_UNIDADE'
   and departamento = 'bar';

commit;


-- ── PASSO 3 (OPCIONAL): LIMPAR TAMBÉM O GUIA DE MONTAGEM DO BAR ────────────
-- Você NÃO pediu isto, então deixei comentado. Sem ele, os 38 cards de
-- montagem continuam lá mesmo sem ficha por trás — e a sincronia não os recria,
-- porque ela só cria para produto que TEM ficha.
--
-- Se quiser o guia limpo também, tire os dois hífens das duas linhas abaixo:

-- delete from public.montagem
--  where unidade_id = 'SUA_UNIDADE' and departamento = 'bar';


-- ── DEPOIS ─────────────────────────────────────────────────────────────────
-- Cadastre os drinks de novo pela ficha técnica do bar. Cada drink novo cai
-- sozinho no cardápio e no guia de montagem, como já era.
notify pgrst, 'reload schema';
