/* COM-2: cancela comandas e pedidos de teste (06/11/2026, aprovado pelo dono).

   Não apaga nada. Muda 13 comandas abertas para 'cancelada' e 4 pedidos de salão
   para 'cancelado', cancela os itens ainda na fila e libera as 5 mesas ocupadas.
   Reverter: voltar os ids abaixo para 'aberta'/'aberto' e as mesas para 'ocupada'.
   Pedidos: c9cc115b-0202-46f5-8d08-5f433cc4857b, 8a26a705-3364-4443-8adf-b05e5a13077d,
   c5fd4fce-5a75-41db-8b20-7bb24da838ef, fd7bbf36-4552-4397-ba7f-10dac298b403. */

do $$
declare v_ped constant uuid[] := array['c9cc115b-0202-46f5-8d08-5f433cc4857b','8a26a705-3364-4443-8adf-b05e5a13077d','c5fd4fce-5a75-41db-8b20-7bb24da838ef','fd7bbf36-4552-4397-ba7f-10dac298b403']::uuid[];
  v_n int;
begin
  update public.comandas set status = 'cancelada' where unidade_id = 'seldeestrela' and status = 'aberta';
  get diagnostics v_n = row_count;
  if v_n <> 13 then raise exception 'COM-2: esperava 13 comandas, achou %.', v_n; end if;

  update public.pedidos_itens set status_kds = 'cancelado', updated_at = now() where pedido_id = any(v_ped) and status_kds in ('pendente', 'preparando', 'pronto');

  update public.pedidos set status = 'cancelado', updated_at = now() where id = any(v_ped) and status = 'aberto' and tipo_pedido = 'salao';
  get diagnostics v_n = row_count;
  if v_n <> 4 then raise exception 'COM-2: esperava 4 pedidos, achou %.', v_n; end if;

  update public.mesas m set status = 'livre' where m.unidade_id = 'seldeestrela' and m.status = 'ocupada'
    and not exists (select 1 from public.pedidos p where p.mesa_id = m.id and p.status = 'aberto');
  get diagnostics v_n = row_count;
  if v_n <> 5 then raise exception 'COM-2: esperava 5 mesas, achou %.', v_n; end if;
end $$;
