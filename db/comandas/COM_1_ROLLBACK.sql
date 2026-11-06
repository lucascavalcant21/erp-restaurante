/* ROLLBACK de COM-1. Apaga pessoa e garçom: só com decisão do dono. */
begin;
alter table public.pedidos_itens drop column pessoa;
alter table public.pedidos drop column garcom_nome;
commit;
