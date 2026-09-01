-- ============================================================================
-- INSUMOS ESCONDIDOS DO CATÁLOGO — cozinha e bar
--
-- O catálogo de ingredientes (fetchInsumos) não lista duas classes de linha:
--   • ficha_tecnica_id preenchido  → insumo espelho de um pré-preparo, criado
--     automaticamente para dar saldo físico à ficha. Na ficha ele entra como
--     subficha, nunca como ingrediente cru.
--   • pre_preparo_legado = true    → sobra de migração antiga.
--
-- Elas existem na tabela e são legítimas. O problema era a trava de duplicidade
-- do cadastro enxergar essas linhas: o nome era recusado por um registro que
-- ninguém acha na busca nem consegue editar. Isso foi corrigido no código; este
-- arquivo serve para ver quais são e decidir o que fazer com elas.
--
-- Rode no SQL Editor do Supabase. Só faz SELECT — não altera nada.
-- ============================================================================


-- 1) TODOS os insumos escondidos, dos dois setores ---------------------------
select
  departamento,
  nome,
  case
    when ficha_tecnica_id is not null then 'espelho de pré-preparo'
    else 'legado de migração'
  end                                   as motivo,
  unidade_medida,
  custo_unitario,
  unidade_id,
  ficha_tecnica_id,
  id,
  created_at
from insumos
where ficha_tecnica_id is not null
   or pre_preparo_legado is true
order by departamento, nome;


-- 2) Quantos são, por setor e motivo ------------------------------------------
select
  departamento,
  case
    when ficha_tecnica_id is not null then 'espelho de pré-preparo'
    else 'legado de migração'
  end        as motivo,
  count(*)   as quantidade
from insumos
where ficha_tecnica_id is not null
   or pre_preparo_legado is true
group by 1, 2
order by 1, 2;


-- 3) OS QUE BLOQUEAVAM O CADASTRO ---------------------------------------------
-- Nomes que existem SÓ como linha escondida: era exatamente aqui que o cadastro
-- travava — o nome parecia livre na busca, mas a trava o via.
-- Comparação por nome em minúsculas e sem espaços nas pontas; acentos contam,
-- então "Açúcar" e "Acucar" aparecem como nomes diferentes.
with escondidos as (
  select * from insumos
  where ficha_tecnica_id is not null or pre_preparo_legado is true
),
visiveis as (
  select * from insumos
  where ficha_tecnica_id is null
    and (pre_preparo_legado is null or pre_preparo_legado = false)
)
select
  e.departamento,
  e.nome,
  case
    when e.ficha_tecnica_id is not null then 'espelho de pré-preparo'
    else 'legado de migração'
  end            as motivo,
  e.unidade_id,
  e.ficha_tecnica_id,
  e.id
from escondidos e
where not exists (
  select 1
  from visiveis v
  where v.unidade_id     is not distinct from e.unidade_id
    and v.departamento   is not distinct from e.departamento
    and lower(btrim(v.nome)) = lower(btrim(e.nome))
)
order by e.departamento, e.nome;


-- 4) Caso específico: procurar um nome que o cadastro recusou -----------------
-- Troque 'tambaqui' pelo trecho do nome que você está tentando cadastrar.
select
  nome,
  departamento,
  unidade_id,
  ficha_tecnica_id,
  pre_preparo_legado,
  case
    when ficha_tecnica_id is not null then 'escondido — espelho de pré-preparo'
    when pre_preparo_legado is true   then 'escondido — legado de migração'
    else 'visível no catálogo'
  end as situacao,
  id
from insumos
where lower(nome) like '%' || lower('tambaqui') || '%'
order by departamento, nome;


-- 5) Ligação com a ficha de origem (só para os espelhos) ----------------------
-- Mostra de qual pré-preparo cada espelho veio. Útil para confirmar que a linha
-- escondida tem dono antes de pensar em mexer nela.
select
  i.departamento,
  i.nome              as insumo_espelho,
  f.nome_receita      as ficha_de_origem,
  f.eh_base,
  f.tipo_base,
  i.unidade_id,
  i.id                as insumo_id,
  f.id                as ficha_id
from insumos i
left join fichas_tecnicas f on f.id = i.ficha_tecnica_id
where i.ficha_tecnica_id is not null
order by i.departamento, i.nome;
