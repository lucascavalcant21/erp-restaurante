/* Porcionamento por peça no cadastro de ingredientes.
   ═══════════════════════════════════════════════════════════════════════════

   O formulário de ingredientes edita "peso da peça (g)" e "peças por kg"
   desde 31/07/2026 (commit c40e167), mas as colunas nunca foram criadas em
   produção. Resultado: o salvar tirava os dois campos do envio em silêncio,
   mostrava "Ingrediente atualizado" e, ao reabrir, os campos vinham vazios.
   Confirmado em 29/09/2026: `insumos.peso_peca_g` e `insumos.pecas_por_kg`
   respondem 42703 (coluna inexistente).

   Aditivo e idempotente: só cria coluna, não altera nenhuma linha. Os valores
   digitados antes NÃO voltam — nunca chegaram ao banco; é preciso digitá-los
   de novo.
*/

alter table public.insumos add column if not exists peso_peca_g  numeric(12,3);
alter table public.insumos add column if not exists pecas_por_kg numeric(12,3);

comment on column public.insumos.peso_peca_g  is 'Peso médio de uma peça, em gramas (porcionamento por unidade).';
comment on column public.insumos.pecas_por_kg is 'Quantas peças compõem 1 kg (inverso de peso_peca_g).';

/* Conferência: as duas linhas devem aparecer. */
select column_name, data_type, numeric_precision, numeric_scale
  from information_schema.columns
 where table_schema = 'public' and table_name = 'insumos'
   and column_name in ('peso_peca_g', 'pecas_por_kg');

/* ROLLBACK (apaga os valores digitados depois da migração):
     alter table public.insumos drop column if exists peso_peca_g;
     alter table public.insumos drop column if exists pecas_por_kg; */
