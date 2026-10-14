/* SEC-FIN-3 · ROLLBACK — volta as 13 policies e as 5 RPCs EXATAMENTE como
   estavam em 14/10/2026 (texto do F2.1) e remove hefisto_tem_alguma.
   Não rodar sem decisão do dono: reabre o S-20. */

begin;

drop policy if exists contas_pagar_ler on public.contas_pagar;
drop policy if exists contas_pagar_incluir on public.contas_pagar;
drop policy if exists contas_pagar_alterar on public.contas_pagar;
drop policy if exists contas_pagar_excluir on public.contas_pagar;
create policy contas_pagar_unidade on public.contas_pagar for all to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()));

drop policy if exists fin_contas_financeiras_ler on public.fin_contas_financeiras;
drop policy if exists fin_contas_financeiras_incluir on public.fin_contas_financeiras;
drop policy if exists fin_contas_financeiras_alterar on public.fin_contas_financeiras;
drop policy if exists fin_contas_financeiras_excluir on public.fin_contas_financeiras;
create policy fin_contas_financeiras_unidade_f21 on public.fin_contas_financeiras for all to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()));

drop policy if exists fin_contas_receber_ler on public.fin_contas_receber;
drop policy if exists fin_contas_receber_incluir on public.fin_contas_receber;
drop policy if exists fin_contas_receber_alterar on public.fin_contas_receber;
drop policy if exists fin_contas_receber_excluir on public.fin_contas_receber;
create policy fin_contas_receber_unidade_f21 on public.fin_contas_receber for all to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()));

drop policy if exists fin_pagamentos_ler on public.fin_pagamentos;
drop policy if exists fin_pagamentos_incluir on public.fin_pagamentos;
drop policy if exists fin_pagamentos_alterar on public.fin_pagamentos;
drop policy if exists fin_pagamentos_excluir on public.fin_pagamentos;
create policy fin_pagamentos_unidade_f21 on public.fin_pagamentos for all to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()));

drop policy if exists fin_recebimentos_ler on public.fin_recebimentos;
drop policy if exists fin_recebimentos_incluir on public.fin_recebimentos;
drop policy if exists fin_recebimentos_alterar on public.fin_recebimentos;
drop policy if exists fin_recebimentos_excluir on public.fin_recebimentos;
create policy fin_recebimentos_unidade_f21 on public.fin_recebimentos for all to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()));

drop policy if exists fin_taxas_meio_pagamento_ler on public.fin_taxas_meio_pagamento;
drop policy if exists fin_taxas_meio_pagamento_incluir on public.fin_taxas_meio_pagamento;
drop policy if exists fin_taxas_meio_pagamento_alterar on public.fin_taxas_meio_pagamento;
drop policy if exists fin_taxas_meio_pagamento_excluir on public.fin_taxas_meio_pagamento;
create policy fin_taxas_meio_pagamento_unidade_f21 on public.fin_taxas_meio_pagamento for all to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()));

drop policy if exists fin_faturamento_diario_ler on public.fin_faturamento_diario;
drop policy if exists fin_faturamento_diario_incluir on public.fin_faturamento_diario;
drop policy if exists fin_faturamento_diario_alterar on public.fin_faturamento_diario;
drop policy if exists fin_faturamento_diario_excluir on public.fin_faturamento_diario;
create policy fin_faturamento_diario_unidade on public.fin_faturamento_diario for all to authenticated
  using (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()))
  with check (public.pode_ver_todas() or (unidade_id = public.auth_unidade_id()));

drop policy if exists gastos_administrativos_ler on public.gastos_administrativos;
drop policy if exists gastos_administrativos_incluir on public.gastos_administrativos;
drop policy if exists gastos_administrativos_alterar on public.gastos_administrativos;
drop policy if exists gastos_administrativos_excluir on public.gastos_administrativos;
create policy sec_unidade on public.gastos_administrativos for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists marmitaria_vendas_ler on public.marmitaria_vendas;
drop policy if exists marmitaria_vendas_incluir on public.marmitaria_vendas;
drop policy if exists marmitaria_vendas_alterar on public.marmitaria_vendas;
drop policy if exists marmitaria_vendas_excluir on public.marmitaria_vendas;
create policy sec_unidade on public.marmitaria_vendas for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists delivery_repasses_ler on public.delivery_repasses;
create policy sec_unidade_ler on public.delivery_repasses for select to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists extras_cadastros_ler on public.extras_cadastros;
drop policy if exists extras_cadastros_incluir on public.extras_cadastros;
drop policy if exists extras_cadastros_alterar on public.extras_cadastros;
drop policy if exists extras_cadastros_excluir on public.extras_cadastros;
create policy sec_unidade on public.extras_cadastros for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists rh_recibos_prestacao_ler on public.rh_recibos_prestacao;
drop policy if exists rh_recibos_prestacao_incluir on public.rh_recibos_prestacao;
drop policy if exists rh_recibos_prestacao_alterar on public.rh_recibos_prestacao;
drop policy if exists rh_recibos_prestacao_excluir on public.rh_recibos_prestacao;
create policy sec_unidade on public.rh_recibos_prestacao for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

drop policy if exists rh_consumo_funcionarios_ler on public.rh_consumo_funcionarios;
drop policy if exists rh_consumo_funcionarios_incluir on public.rh_consumo_funcionarios;
drop policy if exists rh_consumo_funcionarios_alterar on public.rh_consumo_funcionarios;
drop policy if exists rh_consumo_funcionarios_excluir on public.rh_consumo_funcionarios;
create policy sec_unidade on public.rh_consumo_funcionarios for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

create or replace function public.fin_registrar_pagamento(
  p_conta_pagar_id      uuid,
  p_pago_em             date,
  p_valor_principal     numeric,
  p_juros               numeric default 0,
  p_multa               numeric default 0,
  p_desconto            numeric default 0,
  p_forma_pagamento     text default null,
  p_conta_financeira_id uuid default null,
  p_observacao          text default null,
  p_chave_idempotencia  text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conta    public.contas_pagar%rowtype;
  v_existente public.fin_pagamentos%rowtype;
  v_qtd      integer;
  v_pago     numeric;
  v_saldo    numeric;
  v_id       uuid;
  v_status   text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.contas_pagar where id = p_conta_pagar_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a pagar não encontrada nesta unidade.';
  end if;

  if coalesce(btrim(p_chave_idempotencia), '') <> '' then
    select * into v_existente from public.fin_pagamentos
     where unidade_id = v_conta.unidade_id and chave_idempotencia = p_chave_idempotencia;
    if found then
      return jsonb_build_object('pagamento_id', v_existente.id, 'idempotente', true, 'status', v_conta.status);
    end if;
  end if;

  if v_conta.status = 'cancelado' then raise exception 'Conta cancelada não recebe pagamento.'; end if;
  select count(*), coalesce(sum(valor_principal), 0) into v_qtd, v_pago
    from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null;
  if v_qtd = 0 and lower(v_conta.status) in ('pago','paga') then
    raise exception 'Conta já consta como paga (registro anterior à F2.1).';
  end if;
  if p_pago_em is null then raise exception 'Informe a data real do pagamento.'; end if;
  if p_pago_em > public.fin_hoje() then raise exception 'A data do pagamento não pode ser futura.'; end if;
  if coalesce(p_valor_principal, 0) <= 0 then raise exception 'O valor pago precisa ser maior que zero.'; end if;
  if coalesce(p_juros,0) < 0 or coalesce(p_multa,0) < 0 or coalesce(p_desconto,0) < 0 then
    raise exception 'Juros, multa e desconto não podem ser negativos.';
  end if;
  v_saldo := v_conta.valor - v_pago;
  if p_valor_principal > v_saldo + 0.005 then
    raise exception 'Valor maior que o saldo da conta (saldo: %).', round(v_saldo, 2);
  end if;
  if p_conta_financeira_id is not null and not exists (
       select 1 from public.fin_contas_financeiras
        where id = p_conta_financeira_id and unidade_id = v_conta.unidade_id and ativa) then
    raise exception 'Conta financeira inválida para esta unidade.';
  end if;

  insert into public.fin_pagamentos (unidade_id, conta_pagar_id, pago_em, valor_principal, juros, multa, desconto,
                                     forma_pagamento, conta_financeira_id, observacao, chave_idempotencia, criado_por)
  values (v_conta.unidade_id, v_conta.id, p_pago_em, p_valor_principal, coalesce(p_juros,0), coalesce(p_multa,0),
          coalesce(p_desconto,0), p_forma_pagamento, p_conta_financeira_id, p_observacao,
          nullif(btrim(p_chave_idempotencia), ''), auth.uid())
  returning id into v_id;

  v_status := public.fin_conta_pagar_recalcular(v_conta.id);
  return jsonb_build_object('pagamento_id', v_id, 'idempotente', false, 'status', v_status,
                            'saldo', round(v_saldo - p_valor_principal, 2));
end $$;

create or replace function public.fin_registrar_recebimento(
  p_conta_receber_id       uuid,
  p_recebido_em            date,
  p_valor_liquido_recebido numeric,
  p_valor_bruto_baixado    numeric default null,   -- nulo = baixa o saldo bruto inteiro
  p_conta_financeira_id    uuid default null,
  p_conciliacao_referencia text default null,
  p_observacao             text default null,
  p_chave_idempotencia     text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conta public.fin_contas_receber%rowtype;
  v_existente public.fin_recebimentos%rowtype;
  v_baixado numeric;
  v_saldo numeric;
  v_bruto numeric;
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.fin_contas_receber where id = p_conta_receber_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a receber não encontrada nesta unidade.';
  end if;
  if coalesce(btrim(p_chave_idempotencia), '') <> '' then
    select * into v_existente from public.fin_recebimentos
     where unidade_id = v_conta.unidade_id and chave_idempotencia = p_chave_idempotencia;
    if found then
      return jsonb_build_object('recebimento_id', v_existente.id, 'idempotente', true, 'status', v_conta.status);
    end if;
  end if;
  if v_conta.status = 'cancelado' then raise exception 'Conta a receber cancelada.'; end if;
  if p_recebido_em is null then raise exception 'Informe a data real do recebimento.'; end if;
  if p_recebido_em > public.fin_hoje() then raise exception 'A data do recebimento não pode ser futura.'; end if;
  select coalesce(sum(valor_bruto_baixado), 0) into v_baixado
    from public.fin_recebimentos where conta_receber_id = v_conta.id and estornado_em is null;
  v_saldo := v_conta.valor_bruto - v_baixado;
  if v_saldo <= 0.005 then raise exception 'Conta a receber já está totalmente recebida.'; end if;
  v_bruto := coalesce(p_valor_bruto_baixado, v_saldo);
  if v_bruto <= 0 or v_bruto > v_saldo + 0.005 then
    raise exception 'Valor bruto baixado inválido (saldo bruto: %).', round(v_saldo, 2);
  end if;
  if p_valor_liquido_recebido is null or p_valor_liquido_recebido < 0 or p_valor_liquido_recebido > v_bruto then
    raise exception 'Valor líquido recebido inválido (precisa estar entre 0 e o bruto baixado).';
  end if;
  if p_conta_financeira_id is not null and not exists (
       select 1 from public.fin_contas_financeiras
        where id = p_conta_financeira_id and unidade_id = v_conta.unidade_id and ativa) then
    raise exception 'Conta financeira inválida para esta unidade.';
  end if;

  insert into public.fin_recebimentos (unidade_id, conta_receber_id, recebido_em, valor_bruto_baixado,
       valor_liquido_recebido, conta_financeira_id, conciliacao_referencia, observacao, chave_idempotencia, criado_por)
  values (v_conta.unidade_id, v_conta.id, p_recebido_em, v_bruto, p_valor_liquido_recebido, p_conta_financeira_id,
          p_conciliacao_referencia, p_observacao, nullif(btrim(p_chave_idempotencia), ''), auth.uid())
  returning id into v_id;
  v_status := public.fin_conta_receber_recalcular(v_conta.id);
  return jsonb_build_object('recebimento_id', v_id, 'idempotente', false, 'status', v_status,
                            'saldo_bruto', round(v_saldo - v_bruto, 2));
end $$;

create or replace function public.fin_cancelar_conta_pagar(p_conta_pagar_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_conta public.contas_pagar%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_conta from public.contas_pagar where id = p_conta_pagar_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_conta.unidade_id) then
    raise exception 'Conta a pagar não encontrada nesta unidade.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do cancelamento.'; end if;
  if v_conta.status = 'cancelado' then raise exception 'Conta já cancelada.'; end if;
  if lower(v_conta.status) in ('pago','paga','parcial')
     or exists (select 1 from public.fin_pagamentos where conta_pagar_id = v_conta.id and estornado_em is null) then
    raise exception 'Conta com pagamento não pode ser cancelada: estorne os pagamentos antes.';
  end if;
  update public.contas_pagar
     set status = 'cancelado', cancelado_em = now(), motivo_cancelamento = btrim(p_motivo)
   where id = v_conta.id;
  return jsonb_build_object('conta_pagar_id', v_conta.id, 'status', 'cancelado');
end $$;

create or replace function public.fin_estornar_pagamento(p_pagamento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pag public.fin_pagamentos%rowtype;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_pag from public.fin_pagamentos where id = p_pagamento_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_pag.unidade_id) then
    raise exception 'Pagamento não encontrado nesta unidade.';
  end if;
  if v_pag.estornado_em is not null then raise exception 'Pagamento já estornado.'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do estorno.'; end if;
  perform 1 from public.contas_pagar where id = v_pag.conta_pagar_id for update;
  update public.fin_pagamentos
     set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = btrim(p_motivo)
   where id = p_pagamento_id;
  v_status := public.fin_conta_pagar_recalcular(v_pag.conta_pagar_id);
  return jsonb_build_object('pagamento_id', p_pagamento_id, 'status', v_status);
end $$;

create or replace function public.fin_estornar_recebimento(p_recebimento_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rec public.fin_recebimentos%rowtype;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  select * into v_rec from public.fin_recebimentos where id = p_recebimento_id for update;
  if not found or not public.fin_pode_acessar_unidade(v_rec.unidade_id) then
    raise exception 'Recebimento não encontrado nesta unidade.';
  end if;
  if v_rec.estornado_em is not null then raise exception 'Recebimento já estornado.'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo do estorno.'; end if;
  perform 1 from public.fin_contas_receber where id = v_rec.conta_receber_id for update;
  update public.fin_recebimentos
     set estornado_em = now(), estornado_por = auth.uid(), motivo_estorno = btrim(p_motivo)
   where id = p_recebimento_id;
  v_status := public.fin_conta_receber_recalcular(v_rec.conta_receber_id);
  return jsonb_build_object('recebimento_id', p_recebimento_id, 'status', v_status);
end $$;

drop function if exists public.hefisto_tem_alguma(text[]);

commit;
