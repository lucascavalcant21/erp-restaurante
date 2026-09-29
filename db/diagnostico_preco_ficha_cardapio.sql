/* Preço de venda: ficha técnica x produto do Cardápio — somente leitura.
   ═══════════════════════════════════════════════════════════════════════════

   A tela de fichas mostra o preço do PRODUTO do Cardápio quando ele existe.
   Até a correção de 29/09/2026, salvar a ficha pelo modal da lista gravava o
   preço na ficha mas o UPDATE do produto falhava (colunas taxa_cartao e
   aliquota_imposto não existem em `produtos`) e o erro era ignorado. Por isso
   o preço digitado "não salvava": ficava na ficha e a tela exibia o antigo.

   Em 29/09/2026 eram 18 pratos com os dois preços diferentes. Esta consulta
   lista quais, para decidir caso a caso — não há como saber pelo banco qual
   dos dois é o certo (produtos não tem data de alteração).

   Para corrigir um prato: abra a ficha, confira o preço e salve de novo — com
   a correção, o preço vai para o Cardápio. */
select f.nome_receita                        as prato,
       f.departamento,
       f.preco_venda                         as preco_na_ficha,
       p.preco_venda                         as preco_no_cardapio_mostrado_na_tela,
       f.atualizado_em                       as ficha_editada_em,
       p.created_at                          as produto_criado_em
  from public.fichas_tecnicas f
  join public.produtos p on p.ficha_id = f.id
 where coalesce(f.eh_base, false) = false
   and coalesce(f.preco_venda, 0) > 0
   and coalesce(p.preco_venda, 0) > 0
   and abs(f.preco_venda - p.preco_venda) >= 0.005
 order by f.departamento, f.nome_receita;

/* Pratos com preço na ficha e SEM produto no Cardápio (o vínculo automático
   falhava ao criar o produto por causa da coluna `observacoes`). */
select f.nome_receita as prato, f.departamento, f.preco_venda as preco_na_ficha
  from public.fichas_tecnicas f
 where coalesce(f.eh_base, false) = false
   and coalesce(f.preco_venda, 0) > 0
   and not exists (select 1 from public.produtos p where p.ficha_id = f.id)
 order by f.departamento, f.nome_receita;
