-- ---------------------------------------------------------------------------
-- Põe cada produto na prateleira do setor dele.
--
-- POR QUE ISSO EXISTE
-- O vínculo automático do cadastro ("produto do bar nasce no estoque do bar")
-- estava quebrado: o código chamava .catch() em cima da resposta do Supabase,
-- que não tem .catch(), e o erro era engolido antes de a gravação sair. Quem
-- cadastrou produto nesse período ficou com ele no catálogo e fora do estoque.
--
-- O app já conserta sozinho ao abrir cada estoque. Este script é o atalho para
-- consertar todas as unidades e setores de uma vez, sem precisar abrir tela por
-- tela. É OPCIONAL, e rodar de novo não duplica nada.
--
-- Onde rodar: SQL Editor do Supabase.
-- ---------------------------------------------------------------------------

-- Mesma regra do app (setorAutomaticoDoEstoque): qual setor este estoque recebe
-- sozinho. Pré-preparo vem da produção; depósito e materiais são gerais; por
-- isso os três ficam de fora e devolvem vazio.
with estoque_do_setor as (
  select
    e.id,
    e.unidade_id,
    e.nome,
    case
      when texto like '%pre-preparo%' or texto like '%pre preparo%' then ''
      when texto like '%deposito%' or texto like '%materiais%'      then ''
      when texto like '%embalage%'                                  then 'embalagens'
      when texto like '%limpeza%'                                   then 'limpeza'
      when texto like '%bar%' or texto like '%bebida%'              then 'bar'
      when texto like '%cozinha%'                                   then 'cozinha'
      else ''
    end as setor,
    length(texto) as tamanho
  from estoques e
  cross join lateral (
    select lower(translate(
      coalesce(e.slug, '') || ' ' || coalesce(e.nome, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )) as texto
  ) t
  where coalesce(e.status, 'ativo') = 'ativo'
),
-- Um setor pode ter mais de um estoque com o mesmo nome-base ("Bar" e "Bar do
-- Terraço"). A casa do setor é o de nome mais curto — mesmo critério do app.
casa_do_setor as (
  select distinct on (unidade_id, setor) id as estoque_id, unidade_id, setor, nome
  from estoque_do_setor
  where setor <> ''
  order by unidade_id, setor, tamanho, nome
)
insert into estoque_itens (unidade_id, estoque_id, insumo_id, quantidade_atual, updated_at)
select c.unidade_id, c.estoque_id, i.id, 0, now()
from casa_do_setor c
join insumos i
  on i.unidade_id = c.unidade_id
 and lower(coalesce(i.departamento, '')) = c.setor
-- Pré-preparo não sobe para a prateleira principal: o que a ficha técnica
-- produz já mora no "Pré-preparos do Bar/Cozinha". Sem este filtro o mesmo
-- saldo seria contado em dois estoques.
where not exists (
  select 1
  from estoque_itens ja
  join estoque_do_setor pre on pre.id = ja.estoque_id and pre.setor = ''
  where ja.insumo_id = i.id
    and lower(translate(coalesce(pre.nome, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) like '%pre-prepar%'
)
on conflict (estoque_id, insumo_id) do nothing;

-- Confere o resultado: quantos produtos cada estoque passou a ter.
select e.unidade_id, e.nome as estoque, count(ei.id) as produtos
from estoques e
left join estoque_itens ei on ei.estoque_id = e.id
group by e.unidade_id, e.nome
order by e.unidade_id, e.nome;

notify pgrst, 'reload schema';
