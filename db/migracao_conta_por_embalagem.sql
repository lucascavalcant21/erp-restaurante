-- ─────────────────────────────────────────────────────────────────────────────
-- COMO SE CONTA CADA ITEM (insumos.conta_por_embalagem)
--
-- Por que existe: o sistema adivinhava a unidade da contagem pelo SALDO. Item
-- com embalagem de 200 ml só era contado em potes depois que o saldo passasse
-- de 200 — então item recém-cadastrado, com saldo zero, pedia mililitro. Foi o
-- que aconteceu com o creme de leite.
--
-- Adivinhar existia por causa de cadastros antigos, em que uns saldos foram
-- salvos em ml e outros em unidades comerciais. O palpite continua valendo
-- para esses; o que muda é a ordem: o que o cadastro DIZ vem primeiro.
--
--   true  → conta em potes, garrafas, latas, caixas
--   false → conta na unidade de medida (ml, g, kg, L)
--   null  → deixa o sistema decidir (comportamento antigo)
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.insumos
  add column if not exists conta_por_embalagem boolean;

-- Tudo que vem em embalagem fechada passa a ser contado em embalagem. É o caso
-- normal do estoque: ninguém conta creme de leite em mililitro — conta pote.
-- Quem for exceção (granel pesado na balança) você marca como false depois.
update public.insumos
   set conta_por_embalagem = true
 where conta_por_embalagem is null
   and coalesce(tamanho_embalagem, 1) > 1;

notify pgrst, 'reload schema';

-- Confira o que ficou. A coluna "conta_em" mostra o que a pessoa vai digitar:
select nome,
       tamanho_embalagem,
       unidade_medida,
       unidade_comercial,
       conta_por_embalagem,
       case
         when conta_por_embalagem is true then coalesce(unidade_comercial, 'un.')
         when conta_por_embalagem is false then unidade_medida
         else 'automático'
       end as conta_em
  from public.insumos
 order by conta_por_embalagem nulls last, nome;
