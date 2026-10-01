/* ═══════════════════════════════════════════════════════════════════════════
   ROLLBACK da F2.1 — USO EXCEPCIONAL, só com aprovação do dono.

   Desfaz SOMENTE o que db/F2_1_FUNDACAO_FINANCEIRA.sql criou. Os 11 campos
   originais de contas_pagar e os seus dados não são tocados.

   Proteção: aborta se qualquer estrutura nova JÁ TIVER DADO gravado pelo uso
   (pagamentos, recebimentos, compras, contagens, contas financeiras, taxas,
   custos, ou qualquer coluna nova de contas_pagar preenchida). Nesse caso o
   rollback deixa de ser "desfazer" e vira "apagar dado": exige outra decisão.
   As tabelas de referência (categorias, centros de custo) não contam como uso.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
declare t text; n bigint;
begin
  foreach t in array array['fin_pagamentos','fin_recebimentos','fin_contas_receber','fin_contas_financeiras',
      'fin_taxas_meio_pagamento','compras','compras_itens','estoque_custos','estoque_contagens','estoque_contagens_itens'] loop
    if to_regclass('public.'||t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then raise exception 'ROLLBACK F2.1 abortado: public.% tem % linha(s) gravada(s).', t, n; end if;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='contas_pagar' and column_name='categoria_codigo') then
    execute $q$select count(*) from public.contas_pagar
      where coalesce(fornecedor_id::text, categoria_codigo, centro_custo_codigo, competencia::text, documento_numero,
                     anexo_url, observacao, origem_tipo, origem_id::text, recorrencia_origem_id::text,
                     grupo_parcelas_id::text, parcela_numero::text, parcelas_total::text, chave_idempotencia,
                     cancelado_em::text, motivo_cancelamento) is not null$q$ into n;
    if n > 0 then raise exception 'ROLLBACK F2.1 abortado: % conta(s) a pagar já usam colunas novas.', n; end if;
  end if;
end $$;

drop view if exists public.vw_fin_fluxo_caixa;
drop view if exists public.vw_fin_saldo_contas_financeiras;
drop view if exists public.vw_fin_contas_receber;
drop view if exists public.vw_fin_contas_pagar;
drop view if exists public.vw_compras;

drop function if exists public.fin_registrar_pagamento(uuid,date,numeric,numeric,numeric,numeric,text,uuid,text,text);
drop function if exists public.fin_estornar_pagamento(uuid,text);
drop function if exists public.fin_cancelar_conta_pagar(uuid,text);
drop function if exists public.fin_registrar_recebimento(uuid,date,numeric,numeric,uuid,text,text,text);
drop function if exists public.fin_estornar_recebimento(uuid,text);
drop function if exists public.fin_conta_pagar_recalcular(uuid);
drop function if exists public.fin_conta_receber_recalcular(uuid);

drop trigger if exists contas_pagar_auditoria_f21 on public.contas_pagar;

drop table if exists public.estoque_contagens_itens;
drop table if exists public.estoque_contagens;
drop table if exists public.estoque_custos;
drop table if exists public.compras_itens;
drop table if exists public.compras;
drop table if exists public.fin_recebimentos;
drop table if exists public.fin_contas_receber;
drop table if exists public.fin_taxas_meio_pagamento;
drop table if exists public.fin_pagamentos;
drop table if exists public.fin_contas_financeiras;

alter table public.contas_pagar drop constraint if exists contas_pagar_status_f21;
alter table public.contas_pagar drop constraint if exists contas_pagar_valor_f21;
alter table public.contas_pagar drop constraint if exists contas_pagar_competencia_f21;
alter table public.contas_pagar drop constraint if exists contas_pagar_origem_f21;
alter table public.contas_pagar drop constraint if exists contas_pagar_parcela_f21;
alter table public.contas_pagar drop constraint if exists contas_pagar_cancelamento_f21;
drop index if exists public.contas_pagar_idem_f21;
drop index if exists public.contas_pagar_recorrencia_f21;
drop index if exists public.contas_pagar_origem_f21;
drop index if exists public.contas_pagar_unid_venc_f21;
drop index if exists public.contas_pagar_unid_comp_f21;
alter table public.contas_pagar
  drop column if exists fornecedor_id, drop column if exists categoria_codigo, drop column if exists centro_custo_codigo,
  drop column if exists competencia, drop column if exists documento_numero, drop column if exists anexo_url,
  drop column if exists observacao, drop column if exists origem_tipo, drop column if exists origem_id,
  drop column if exists recorrencia_origem_id, drop column if exists grupo_parcelas_id, drop column if exists parcela_numero,
  drop column if exists parcelas_total, drop column if exists chave_idempotencia, drop column if exists cancelado_em,
  drop column if exists motivo_cancelamento, drop column if exists criado_por, drop column if exists atualizado_por;

drop table if exists public.fin_categorias_legado;
drop table if exists public.fin_categorias;
drop table if exists public.fin_centros_custo;

drop function if exists public.fin_item_cabecalho_trg();
drop function if exists public.fin_movimento_imutavel_trg();
drop function if exists public.estoque_contagem_status_trg();
drop function if exists public.compras_status_trg();
drop function if exists public.fin_auditoria_trg();
drop function if exists public.fin_pode_acessar_unidade(text);
drop function if exists public.estoque_custo_medio_novo(numeric,numeric,numeric,numeric);
drop function if exists public.fin_hoje();

commit;
