/* Desfaz a MARM-PROD-1. Só com decisão do dono. Aborta se os novos locais
   já tiverem movimento: nesse caso, saldo e histórico precisam de decisão própria. */
begin;
do $$
begin
  if exists (select 1 from public.estoque_movimentacoes_multi m join public.estoques e on e.id = m.estoque_id where e.slug in ('producao-marmitaria', 'limpeza-marmitaria')) then
    raise exception 'MARM-PROD-1: os novos estoques já têm movimento. Nada foi alterado.';
  end if;
end $$;
drop function if exists public.marmitaria_produzir_preparo(jsonb);
delete from public.estoque_itens where estoque_id in (select id from public.estoques where slug in ('producao-marmitaria', 'limpeza-marmitaria'));
delete from public.estoques where slug in ('producao-marmitaria', 'limpeza-marmitaria');
commit;
