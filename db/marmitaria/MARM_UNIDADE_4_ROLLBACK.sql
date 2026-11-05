/* Desfaz a MARM-UNIDADE-4. Só com decisão do dono. */
begin;
do $$
declare t text;
begin
  foreach t in array array['estoque_itens', 'estoque_lotes', 'estoque_custos', 'estoque_contagens', 'estoque_contagens_itens', 'estoque_movimentacoes_multi', 'fin_pagamentos'] loop
    execute format('drop policy if exists marmitaria_escopo_ler on public.%I', t);
  end loop;
end $$;
commit;
