/* COM-1: comanda por mesa, dividindo por pessoa (06/11/2026, decisões do dono).

   ADITIVA: só acrescenta colunas que começam vazias.
   - pedidos_itens.pessoa: de quem é o item. Vazio é da mesa.
   - pedidos.garcom_nome: quem atende a mesa.
   O pedido de conta usa o status 'fechando' da mesa, que o caixa já mostra.
   ROLLBACK: db/comandas/COM_1_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regclass('public.pedidos') is null or to_regclass('public.pedidos_itens') is null then
    raise exception 'COM-1: tabelas ausentes. Nada foi alterado.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_itens' and column_name = 'pessoa') then
    raise exception 'COM-1: já aplicada. Nada foi alterado.';
  end if;
end $$;

alter table public.pedidos_itens add column pessoa text check (pessoa is null or char_length(pessoa) between 1 and 40);
alter table public.pedidos add column garcom_nome text check (garcom_nome is null or char_length(garcom_nome) <= 120);

do $$
begin
  if (select count(*) from information_schema.columns where table_schema = 'public'
      and ((table_name = 'pedidos_itens' and column_name = 'pessoa') or (table_name = 'pedidos' and column_name = 'garcom_nome'))) <> 2 then
    raise exception 'COM-1: colunas não criadas.';
  end if;
end $$;

commit;
