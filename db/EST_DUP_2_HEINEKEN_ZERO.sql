/* ═══════════════════════════════════════════════════════════════════════════
   EST-DUP-2 · HEINEKEN ZERO: SÓ LONG NECK

   STATUS: APLICADO em 12/10/2026. O dono confirmou: "vendemos só long neck".

   O produto com estoque e histórico é "Heineken zero" (79a931da: 15.840 ml =
   48 unidades, 8 movimentos), cadastrado por engano como "lata". Ele fica, e
   a embalagem e o nome são corrigidos. Os dois cadastros "long neck" (un · 1,
   sem saldo e sem movimento) viram duplicados arquivados dele.

   FAZ (uma transação; nada é apagado, saldo e movimentos não mudam):
     0. backup_insumos_est_dup_2_20261012
     1. 79a931da: unidade_comercial 'lata' → 'long neck'; nome → 'Heineken Zero Long Neck 330 ml'
     2. f8877024 (Heineken - Long neck zero 330ml): arquivado, unido_a 79a931da
     3. 7d57e434 (já arquivado no EST-DUP-1, apontando para f8877024): unido_a → 79a931da
   ABORTA se 79a931da não for o "Heineken zero" lata 330 ou se f8877024 tiver saldo/movimento.

   ROLLBACK (não rodar sem decisão do dono):
     update public.insumos set nome = 'Heineken zero', unidade_comercial = 'lata' where id = '79a931da-20dc-4bb3-8037-c39e0d0efc14';
     update public.insumos set arquivado_em = null, arquivado_motivo = null, unido_a = null where id = 'f8877024-3790-4e9e-85f4-57f3968b517b';
     update public.insumos set unido_a = 'f8877024-3790-4e9e-85f4-57f3968b517b' where id = '7d57e434-e058-4064-87b6-74996ab847b3';
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if not exists (select 1 from public.insumos where id = '79a931da-20dc-4bb3-8037-c39e0d0efc14'
                 and nome = 'Heineken zero' and unidade_comercial = 'lata' and tamanho_embalagem = 330) then
    raise exception 'EST-DUP-2: Heineken zero não está como conferido. Nada foi alterado.';
  end if;
  if exists (select 1 from public.estoque_itens where insumo_id = 'f8877024-3790-4e9e-85f4-57f3968b517b' and coalesce(quantidade_atual, 0) <> 0)
     or exists (select 1 from public.estoque_movimentacoes_multi where insumo_id = 'f8877024-3790-4e9e-85f4-57f3968b517b') then
    raise exception 'EST-DUP-2: o long neck zero tem saldo ou movimento. Nada foi alterado.';
  end if;
end $$;

create table if not exists public.backup_insumos_est_dup_2_20261012 as table public.insumos;
alter table public.backup_insumos_est_dup_2_20261012 enable row level security;
revoke all on public.backup_insumos_est_dup_2_20261012 from anon, authenticated;

update public.insumos set unidade_comercial = 'long neck', nome = 'Heineken Zero Long Neck 330 ml'
 where id = '79a931da-20dc-4bb3-8037-c39e0d0efc14';

update public.insumos set arquivado_em = now(), unido_a = '79a931da-20dc-4bb3-8037-c39e0d0efc14',
       arquivado_motivo = 'Duplicado unido a "Heineken Zero Long Neck 330 ml" (EST-DUP-2; o dono vende só long neck, 2026-10-12)'
 where id = 'f8877024-3790-4e9e-85f4-57f3968b517b' and arquivado_em is null;

update public.insumos set unido_a = '79a931da-20dc-4bb3-8037-c39e0d0efc14',
       arquivado_motivo = 'Duplicado unido a "Heineken Zero Long Neck 330 ml" (EST-DUP-1/2, 2026-10-12)'
 where id = '7d57e434-e058-4064-87b6-74996ab847b3';

commit;
