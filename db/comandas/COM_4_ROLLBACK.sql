/* ROLLBACK da COM-4 (cancelar venda da comanda). SÓ RODAR COM DECISÃO DO DONO.

   Tira a função venda_cancelar e as colunas de cancelamento de vendas.
   ATENÇÃO: se alguma venda já foi cancelada, as colunas guardam quem, quando e
   por quê. Este rollback recusa rodar nesse caso, para não perder o histórico.
   As vendas canceladas continuam com status 'cancelada' (não são reabertas). */

begin;

do $$
begin
  if exists (select 1 from public.vendas where cancelada_em is not null) then
    raise exception 'Há vendas canceladas com histórico. Rollback recusado: nada foi alterado.';
  end if;
end $$;

drop function if exists public.venda_cancelar(uuid, text);
alter table public.vendas
  drop column if exists motivo_cancelamento,
  drop column if exists cancelada_por,
  drop column if exists cancelada_em;

commit;
