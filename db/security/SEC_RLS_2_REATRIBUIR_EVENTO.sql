/* SEC-RLS-2 · REATRIBUIÇÃO COM EVIDÊNCIA FORTE (aprovação própria, depois da SEC-RLS-2)
   Único registro inconsistente com evidência forte da unidade certa:
     eventos 503556ac-ed46-466c-a657-17bfe7bc1b39 "Dia dos namorados" (12/06/2026),
     sem unidade_id, com tag = 'Seldeestrela'.
   Muda SÓ esse registro, só se ainda estiver sem unidade e com a mesma tag.
   Os outros (burguer, ticotico, todas, montagem sem unidade) NÃO têm evidência: ficam.
   Rollback: update public.eventos set unidade_id = null where id = '503556ac-ed46-466c-a657-17bfe7bc1b39';
             update public.sec_dados_legados set classificacao = 'AMBIGUO' where tabela = 'eventos' and registro_id = '503556ac-ed46-466c-a657-17bfe7bc1b39';
*/
begin;
do $$
declare n int;
begin
  update public.eventos set unidade_id = 'seldeestrela'
   where id = '503556ac-ed46-466c-a657-17bfe7bc1b39' and unidade_id is null and tag ilike 'seldeestrela%'
     and exists (select 1 from public.unidades where id = 'seldeestrela');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'reatribuição: esperado 1 evento, encontrado %. Nada foi alterado.', n; end if;
  update public.sec_dados_legados set classificacao = 'VALIDO', acao_sugerida = 'reatribuído para seldeestrela (tag = Seldeestrela)'
   where tabela = 'eventos' and registro_id = '503556ac-ed46-466c-a657-17bfe7bc1b39';
end $$;
commit;
