/* ROLLBACK da COM-5 (mesas e cancelamento de item). SÓ RODAR COM DECISÃO DO DONO.

   Tira as quatro funções e as colunas novas de pedidos_itens. Recusa rodar se
   já houver item cancelado com motivo ou item transferido, para não perder o
   histórico. Comandas com status 'transferido' continuam assim. */

begin;

do $$
begin
  if exists (select 1 from public.pedidos_itens where motivo_cancelamento is not null or transferido_de is not null) then
    raise exception 'Há itens cancelados ou transferidos com histórico. Rollback recusado: nada foi alterado.';
  end if;
end $$;

drop function if exists public.comanda_cancelar_item(uuid, text);
drop function if exists public.comanda_transferir_itens(uuid[], uuid, text);
drop function if exists public.comanda_juntar(uuid, uuid);
drop function if exists public.comanda_trocar_mesa(uuid, uuid);
drop function if exists public._comanda_liberar_mesa(uuid);
alter table public.pedidos_itens
  drop column if exists transferido_de,
  drop column if exists motivo_cancelamento,
  drop column if exists cancelado_por,
  drop column if exists cancelado_em;

commit;
