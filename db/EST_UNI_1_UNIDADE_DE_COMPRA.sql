/* ═══════════════════════════════════════════════════════════════════════════
   EST-UNI-1 · UNIDADE DE COMPRA DO PRODUTO (caixa com 12 garrafas)

   STATUS: PROPOSTA (HDEV-EST-001). Rodar só com aprovação do dono.

   Hoje o cadastro tem a unidade do saldo (unidade_medida: ml) e o conteúdo da
   embalagem (tamanho_embalagem: 330 ml numa garrafa), mas não sabe quantas
   garrafas vêm numa caixa. O app (estoque-unidades.mjs) converte
   "2 caixas" → 24 garrafas → 7.920 ml quando estes dois campos existem.

   FAZ (uma transação; aditiva):
     1. insumos.unidade_compra text  (ex.: 'caixa', 'fardo')
     2. insumos.fator_compra numeric (unidades operacionais por unidade de compra; > 0)
   NÃO FAZ: não altera saldo, movimento, lote, custo nem nenhuma linha existente
   (as colunas nascem nulas). O app funciona sem elas (a opção "caixa" só
   aparece quando o cadastro tem o fator).

   VERIFICAÇÃO: o select do fim deve listar as duas colunas.
   ROLLBACK (não rodar sem decisão do dono):
     alter table public.insumos drop column if exists fator_compra, drop column if exists unidade_compra;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.insumos') is null then
    raise exception 'EST-UNI-1: tabela insumos não existe. Nada foi alterado.';
  end if;
end $$;

alter table public.insumos add column if not exists unidade_compra text;
alter table public.insumos add column if not exists fator_compra numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'insumos_fator_compra_positivo') then
    alter table public.insumos add constraint insumos_fator_compra_positivo
      check (fator_compra is null or fator_compra > 0) not valid;
  end if;
end $$;

comment on column public.insumos.unidade_compra is 'Unidade em que o fornecedor entrega (caixa, fardo). EST-UNI-1.';
comment on column public.insumos.fator_compra is 'Quantas unidades operacionais (garrafas, pacotes) vêm em 1 unidade de compra. EST-UNI-1.';

commit;

select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'insumos' and column_name in ('unidade_compra', 'fator_compra')
 order by column_name;
