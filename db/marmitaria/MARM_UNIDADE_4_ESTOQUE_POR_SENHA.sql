/* MARM-UNIDADE-4: quem entrou com a senha vê o estoque da marmitaria (05/11/2026,
   autorizado pelo dono). ADITIVA: policies novas só de leitura, só para
   unidade_id = 'marmitaria'. A escrita continua pelas RPCs.
   ROLLBACK: db/marmitaria/MARM_UNIDADE_4_ROLLBACK.sql (só com decisão do dono). */
begin;
do $$
declare t text;
begin
  if to_regprocedure('public._marmitaria_tem_escopo()') is null then
    raise exception 'MARM-UNIDADE-4: aplique a MARM-UNIDADE-3 antes. Nada foi alterado.';
  end if;
  foreach t in array array['estoque_itens', 'estoque_lotes', 'estoque_custos', 'estoque_contagens', 'estoque_contagens_itens', 'estoque_movimentacoes_multi', 'fin_pagamentos'] loop
    execute format('create policy marmitaria_escopo_ler on public.%I for select to authenticated using (unidade_id = ''marmitaria'' and (select public._marmitaria_tem_escopo()))', t);
  end loop;
  if (select count(*) from pg_policies where policyname = 'marmitaria_escopo_ler') <> 7 then raise exception 'MARM-UNIDADE-4: policies não criadas.'; end if;
end $$;
commit;
