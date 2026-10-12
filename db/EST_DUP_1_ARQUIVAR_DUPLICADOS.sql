/* ═══════════════════════════════════════════════════════════════════════════
   EST-DUP-1 · JUNÇÃO DOS PRODUTOS DUPLICADOS (Heineken / Corona)

   STATUS: APROVADO PELO DONO em 12/10/2026 ("aprovo a junção dos duplicados").
   Tabela de correspondência: docs/brain/02_ARQUITETURA/ESTOQUE_DUPLICADOS.md

   Unir = ARQUIVAR o duplicado e apontar para o produto que fica. Nada é
   apagado: histórico de preço, saldo zerado e movimentos continuam ligados ao
   id antigo. Só entram aqui duplicados SEM saldo e SEM movimento.

   FAZ (uma transação; aditiva):
     0. backup_insumos_est_dup_1_20261012 (cópia de insumos; RLS ligado, sem grant)
     1. insumos.arquivado_em, insumos.arquivado_motivo, insumos.unido_a (→ insumos.id)
     2. arquiva:
          Heineken - 600ml (47ca891c)                → Heineken (d48708f1)
          Corona Long Neck (79220b02)                → Corona (9d75bef9)
          Heineken zero - Long neck 330ml (7d57e434) → Heineken - Long neck zero 330ml (f8877024)
     3. renomeia "Heineken " (dda5ada5, 330 ml) → "Heineken Long Neck 330 ml"
   NÃO FAZ (dependem do dono):
     - "Coroa zero" (1ce6cc2d, 24 un): falta saber se a entrada de 08/10 foi teste;
     - f8877024 (long neck zero) × 79a931da (Heineken zero lata): o dono diz se vende os dois.
   ABORTA sem mudar nada se algum duplicado tiver saldo ou movimento, ou se
   algum id não existir.

   ROLLBACK (não rodar sem decisão do dono):
     update public.insumos set arquivado_em = null, arquivado_motivo = null, unido_a = null
      where id in ('47ca891c-4503-492e-adc7-ddf5d90afe53','79220b02-d974-4f03-aa19-12b9eed85480','7d57e434-e058-4064-87b6-74996ab847b3');
     update public.insumos set nome = 'Heineken ' where id = 'dda5ada5-f856-431a-acdd-b623c0a240f4';
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
declare
  dup uuid[] := array['47ca891c-4503-492e-adc7-ddf5d90afe53','79220b02-d974-4f03-aa19-12b9eed85480','7d57e434-e058-4064-87b6-74996ab847b3']::uuid[];
  alvo uuid[] := array['d48708f1-5ece-4b63-a933-7abe58be4806','9d75bef9-1559-4228-b419-977ee68a683a','f8877024-3790-4e9e-85f4-57f3968b517b','dda5ada5-f856-431a-acdd-b623c0a240f4']::uuid[];
begin
  if (select count(*) from public.insumos where id = any(dup)) <> 3 or (select count(*) from public.insumos where id = any(alvo)) <> 4 then
    raise exception 'EST-DUP-1: produto da lista não encontrado. Nada foi alterado.';
  end if;
  if exists (select 1 from public.estoque_itens where insumo_id = any(dup) and coalesce(quantidade_atual, 0) <> 0)
     or exists (select 1 from public.estoque_movimentacoes_multi where insumo_id = any(dup)) then
    raise exception 'EST-DUP-1: duplicado com saldo ou movimento. Nada foi alterado.';
  end if;
end $$;

create table if not exists public.backup_insumos_est_dup_1_20261012 as table public.insumos;
alter table public.backup_insumos_est_dup_1_20261012 enable row level security;
revoke all on public.backup_insumos_est_dup_1_20261012 from anon, authenticated;

alter table public.insumos add column if not exists arquivado_em timestamptz;
alter table public.insumos add column if not exists arquivado_motivo text;
alter table public.insumos add column if not exists unido_a uuid references public.insumos(id);
comment on column public.insumos.arquivado_em is 'Produto fora de uso: some das listas de escolha; histórico preservado. EST-DUP-1.';
comment on column public.insumos.unido_a is 'Duplicado unido a este produto (o que fica). EST-DUP-1.';

update public.insumos d set arquivado_em = now(), unido_a = v.alvo,
       arquivado_motivo = 'Duplicado unido a "' || (select nome from public.insumos where id = v.alvo) || '" (EST-DUP-1, aprovado pelo dono em 2026-10-12)'
  from (values ('47ca891c-4503-492e-adc7-ddf5d90afe53'::uuid, 'd48708f1-5ece-4b63-a933-7abe58be4806'::uuid),
               ('79220b02-d974-4f03-aa19-12b9eed85480'::uuid, '9d75bef9-1559-4228-b419-977ee68a683a'::uuid),
               ('7d57e434-e058-4064-87b6-74996ab847b3'::uuid, 'f8877024-3790-4e9e-85f4-57f3968b517b'::uuid)) v(dup, alvo)
 where d.id = v.dup and d.arquivado_em is null;

update public.insumos set nome = 'Heineken Long Neck 330 ml'
 where id = 'dda5ada5-f856-431a-acdd-b623c0a240f4' and nome = 'Heineken ';

commit;

select left(id::text, 8) id, nome, arquivado_em is not null arquivado, left(unido_a::text, 8) unido_a
  from public.insumos
 where id in ('47ca891c-4503-492e-adc7-ddf5d90afe53','79220b02-d974-4f03-aa19-12b9eed85480','7d57e434-e058-4064-87b6-74996ab847b3','dda5ada5-f856-431a-acdd-b623c0a240f4')
 order by nome;
