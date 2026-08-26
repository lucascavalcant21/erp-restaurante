-- ═══════════════════════════════════════════════════════════════════════════
-- ZERAR O RECEITUÁRIO DA COZINHA E DO BAR
--
-- Apaga TODAS as fichas técnicas dos departamentos "cozinha" e "bar" desta
-- unidade, com os ingredientes e o histórico de custo delas.
--
-- NÃO TEM DESFAZER. Não existe lixeira: o que sair daqui sai para sempre.
--
-- Rode o PASSO 1 sozinho primeiro e leia o que aparece. Só depois o resto.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── PASSO 1: OLHE ANTES DE APAGAR ──────────────────────────────────────────
-- Troque 'SUA_UNIDADE' pelo id da sua unidade (ex.: 'seldeestrela').
-- Confira o total e a lista. Se vier ficha que você quer manter, pare aqui.
select
  f.departamento,
  f.nome_receita,
  f.categoria,
  f.eh_base,
  f.tipo_base,
  (select count(*) from public.fichas_ingredientes i where i.ficha_id = f.id) as ingredientes,
  (select count(*) from public.produtos p where p.ficha_id = f.id) as produtos_no_cardapio
from public.fichas_tecnicas f
where f.unidade_id = 'SUA_UNIDADE'
  and f.departamento in ('cozinha', 'bar')
order by f.departamento, ingredientes desc, f.nome_receita;

-- Quantas são, por setor. Confira contra o que a tela mostra antes de seguir.
select departamento, count(*) as fichas
  from public.fichas_tecnicas
 where unidade_id = 'SUA_UNIDADE'
   and departamento in ('cozinha', 'bar')
 group by departamento;


-- ── PASSO 2: APAGAR ────────────────────────────────────────────────────────
-- Tudo numa transação só: ou apaga tudo, ou não apaga nada. Se algo falhar no
-- meio, o banco volta sozinho ao estado anterior.
begin;

-- Solta o vínculo dos produtos do cardápio ANTES de apagar a ficha. Sem isto,
-- ou o delete é recusado, ou o produto some junto por cascata — e o cardápio
-- não deveria perder o item só porque a receita dele foi refeita.
update public.produtos p
   set ficha_id = null
 where p.ficha_id in (
   select f.id from public.fichas_tecnicas f
    where f.unidade_id = 'SUA_UNIDADE' and f.departamento in ('cozinha', 'bar')
 );

-- Ingredientes e histórico de custo. As duas têm "on delete cascade", mas
-- apagar explicitamente evita depender disso.
delete from public.fichas_ingredientes
 where ficha_id in (
   select f.id from public.fichas_tecnicas f
    where f.unidade_id = 'SUA_UNIDADE' and f.departamento in ('cozinha', 'bar')
 );

delete from public.fichas_custo_historico
 where ficha_id in (
   select f.id from public.fichas_tecnicas f
    where f.unidade_id = 'SUA_UNIDADE' and f.departamento in ('cozinha', 'bar')
 );

-- As fichas.
delete from public.fichas_tecnicas
 where unidade_id = 'SUA_UNIDADE'
   and departamento in ('cozinha', 'bar');

commit;


-- ── PASSO 3 (OPCIONAL): LIMPAR TAMBÉM O GUIA DE MONTAGEM ───────────────────
-- Fica comentado de propósito. Sem ele os cards de montagem continuam lá mesmo
-- sem ficha por trás — e a sincronização não os recria, porque ela só cria
-- para produto que TEM ficha.
--
-- Se quiser o guia limpo junto, tire os dois hífens das linhas abaixo:

-- delete from public.montagem
--  where unidade_id = 'SUA_UNIDADE' and departamento in ('cozinha', 'bar');


-- ── O QUE ISTO AFETA ───────────────────────────────────────────────────────
-- • CMV e engenharia de cardápio perdem a base de cálculo dos pratos apagados;
--   o histórico de vendas continua, mas sem receita para comparar o custo.
-- • Produtos do cardápio ficam SEM ficha (ficha_id nulo), não somem.
-- • Estoque de pré-preparo criado a partir de ficha mantém o saldo, mas o item
--   fica órfão da receita que o alimentava.
-- • Guia de montagem: ver PASSO 3.

notify pgrst, 'reload schema';
