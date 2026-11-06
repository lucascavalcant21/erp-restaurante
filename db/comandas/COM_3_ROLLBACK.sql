/* ROLLBACK de COM-3: só com decisão do dono e sem vendas fechadas por ela.
   Remover venda_pagamentos apaga as formas de pagamento dessas vendas. */
begin;
drop function public.comanda_fechar(uuid, uuid, jsonb, numeric, numeric, numeric, text);
drop table public.venda_pagamentos;
drop index public.vendas_pedido_unico;
alter table public.vendas drop column pedido_id;
commit;
