// ══════════════════════════════════════════════════════════════════════════════
// CAMADA DE SERVIÇOS SUPABASE: RECEBÍVEIS E CONCILIAÇÃO FINANCEIRA (V2)
// HÉFISTO ERP — Gastronomia e Alta Performance Operacional
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase.js';
import { arredondar2, gerarTitulosContasReceber, verificarDivergenciaConciliacao, calcularConciliacaoLote } from './vendas-domain.js';

/**
 * Busca a lista de Contas a Receber com filtros flexíveis.
 */
export async function fetchContasReceber(unidadeId, filtros = {}) {
  if (!unidadeId) return [];

  try {
    let query = supabase
      .from('contas_receber')
      .select('*')
      .eq('unidade_id', unidadeId)
      .order('data_prevista_repasse', { ascending: true });

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    if (filtros.canalVenda) {
      query = query.eq('canal_venda', filtros.canalVenda);
    }
    if (filtros.adquirente) {
      query = query.eq('adquirente_nome', filtros.adquirente);
    }
    if (filtros.formaPagamento) {
      query = query.eq('forma_pagamento', filtros.formaPagamento);
    }
    if (filtros.dataInicio) {
      query = query.gte('data_prevista_repasse', filtros.dataInicio);
    }
    if (filtros.dataFim) {
      query = query.lte('data_prevista_repasse', filtros.dataFim);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  } catch (err) {
    console.error('Erro ao buscar contas a receber:', err);
    return [];
  }
}

/**
 * Salva a lista de títulos em contas_receber gerados a partir do split de vendas.
 */
export async function salvarTitulosContasReceber(titulos = []) {
  if (!titulos || titulos.length === 0) return { sucesso: true, titulos: [] };

  try {
    const { data, error } = await supabase
      .from('contas_receber')
      .upsert(titulos, { onConflict: 'chave_idempotencia' })
      .select();

    if (error) throw error;
    return { sucesso: true, titulos: data };
  } catch (err) {
    console.error('Erro ao salvar títulos em contas_receber:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Executa a conciliação atômica de um recebível individual contra a conta financeira/banco.
 */
export async function conciliarRecebivel({
  contaReceberId,
  unidadeId,
  valorDepositado,
  contaFinanceiraId,
  usuarioId = null,
  usuarioNome = null,
  observacao = null,
  chaveIdempotencia = null
}) {
  if (!contaReceberId || !unidadeId || valorDepositado === undefined) {
    return { sucesso: false, erro: 'Parâmetros obrigatórios incompletos' };
  }

  try {
    const { data, error } = await supabase.rpc('conciliar_recebivel_banco', {
      p_conta_receber_id: contaReceberId,
      p_unidade_id: unidadeId,
      p_valor_depositado: Number(valorDepositado),
      p_conta_financeira_id: contaFinanceiraId || null,
      p_usuario_id: usuarioId || null,
      p_usuario_nome: usuarioNome || null,
      p_observacao: observacao || null,
      p_chave_idempotencia: chaveIdempotencia || null
    });

    if (!error && data) {
      return data;
    }

    // Fallback JS
    const { data: rec, error: fetchErr } = await supabase
      .from('contas_receber')
      .select('*')
      .eq('id', contaReceberId)
      .single();

    if (fetchErr || !rec) throw new Error('Recebível não encontrado');

    const evalRes = verificarDivergenciaConciliacao(rec.valor_liquido_esperado, valorDepositado);

    await supabase
      .from('contas_receber')
      .update({
        valor_recebido: Number(valorDepositado),
        data_real_repasse: new Date().toISOString().split('T')[0],
        conta_financeira_id: contaFinanceiraId || null,
        status: evalRes.statusRecebivel,
        updated_at: new Date().toISOString()
      })
      .eq('id', contaReceberId);

    if (contaFinanceiraId) {
      const { data: cf } = await supabase
        .from('contas_financeiras')
        .select('saldo_atual')
        .eq('id', contaFinanceiraId)
        .single();
      
      const novoSaldo = arredondar2((cf?.saldo_atual || 0) + Number(valorDepositado));
      await supabase.from('contas_financeiras').update({ saldo_atual: novoSaldo }).eq('id', contaFinanceiraId);
    }

    await supabase.from('conciliacao_financeira').insert([{
      unidade_id: unidadeId,
      conta_receber_id: contaReceberId,
      conta_financeira_id: contaFinanceiraId || null,
      valor_esperado: rec.valor_liquido_esperado,
      valor_depositado: Number(valorDepositado),
      diferenca_taxa: evalRes.diferenca,
      status_conciliacao: evalRes.statusConciliacao,
      usuario_id: usuarioId || null,
      usuario_nome: usuarioNome || null,
      justificativa: observacao || null
    }]);

    return {
      sucesso: true,
      mensagem: 'Conciliação efetuada com sucesso (fallback)',
      status_conciliacao: evalRes.statusConciliacao,
      diferenca: evalRes.diferenca
    };
  } catch (err) {
    console.error('Erro na conciliação:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * CONCILIAÇÃO POR LOTE N:1 (1 Depósito Bancário -> N Recebíveis)
 */
export async function conciliarLoteRecebiveis({
  unidadeId,
  adquirenteNome,
  recebiveisIds = [],
  valorDepositadoBanco,
  contaFinanceiraId,
  usuarioId = null,
  usuarioNome = null,
  observacao = null
}) {
  if (!unidadeId || !recebiveisIds.length || valorDepositadoBanco === undefined) {
    return { sucesso: false, erro: 'Parâmetros de lote incompletos' };
  }

  try {
    // 1. Buscar recebíveis
    const { data: recebiveis, error: fetchErr } = await supabase
      .from('contas_receber')
      .select('*')
      .in('id', recebiveisIds);

    if (fetchErr || !recebiveis) throw new Error('Falha ao buscar recebíveis do lote');

    const evalLote = calcularConciliacaoLote(recebiveis, valorDepositadoBanco);

    // 2. Criar lote de repasse
    const { data: loteCreated, error: loteErr } = await supabase
      .from('lotes_repasses')
      .insert([{
        unidade_id: unidadeId,
        adquirente_nome: adquirenteNome || 'STONE',
        codigo_lote: `LOTE-${Date.now().toString(36).toUpperCase()}`,
        data_repasse: new Date().toISOString().split('T')[0],
        quantidade_titulos: recebiveis.length,
        valor_bruto_total: recebiveis.reduce((a, r) => a + Number(r.valor_bruto || 0), 0),
        taxas_totais: recebiveis.reduce((a, r) => a + Number(r.taxa_valor || 0), 0),
        valor_liquido_total: evalLote.valorEsperadoTotal,
        valor_depositado_banco: Number(valorDepositadoBanco),
        diferenca: evalLote.diferenca,
        conta_financeira_id: contaFinanceiraId || null,
        status: evalLote.statusConciliacao === 'CONCILIADO_OK' ? 'CONCILIADO' : 'DIVERGENTE'
      }])
      .select()
      .single();

    if (loteErr) throw loteErr;

    // 3. Tentar chamar RPC conciliar_lote_repasses
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('conciliar_lote_repasses', {
      p_lote_id: loteCreated.id,
      p_unidade_id: unidadeId,
      p_valor_depositado: Number(valorDepositadoBanco),
      p_conta_financeira_id: contaFinanceiraId || null,
      p_usuario_id: usuarioId || null,
      p_usuario_nome: usuarioNome || null,
      p_observacao: observacao || null
    });

    if (!rpcErr && rpcRes) {
      return rpcRes;
    }

    // Fallback manual JS para lote
    const novoStatus = evalLote.statusConciliacao === 'CONCILIADO_OK' ? 'RECEBIDO' : 'DIVERGENTE';
    
    await supabase
      .from('contas_receber')
      .update({
        lote_repasse_id: loteCreated.id,
        valor_recebido: evalLote.valorEsperadoTotal / recebiveis.length,
        data_real_repasse: new Date().toISOString().split('T')[0],
        conta_financeira_id: contaFinanceiraId || null,
        status: novoStatus,
        updated_at: new Date().toISOString()
      })
      .in('id', recebiveisIds);

    if (contaFinanceiraId) {
      const { data: cf } = await supabase
        .from('contas_financeiras')
        .select('saldo_atual')
        .eq('id', contaFinanceiraId)
        .single();
      
      const novoSaldo = arredondar2((cf?.saldo_atual || 0) + Number(valorDepositadoBanco));
      await supabase.from('contas_financeiras').update({ saldo_atual: novoSaldo }).eq('id', contaFinanceiraId);
    }

    return {
      sucesso: true,
      mensagem: `Lote de ${recebiveis.length} recebíveis conciliado com sucesso`,
      loteId: loteCreated.id,
      status_conciliacao: evalLote.statusConciliacao,
      diferenca: evalLote.diferenca
    };
  } catch (err) {
    console.error('Erro na conciliação por lote:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Justifica a divergência encontrada na conciliação.
 */
export async function justificarDivergencia({
  contaReceberId,
  motivo, // 'TAXA_DIFERENTE', 'CHARGEBACK', 'AJUSTE_ADQUIRENTE', 'ANTECIPACAO', 'ERRO_IMPORTACAO', 'OUTRO'
  justificativa,
  usuarioId = null
}) {
  try {
    const { error } = await supabase
      .from('contas_receber')
      .update({
        motivo_divergencia: motivo,
        justificativa_divergencia: justificativa,
        usuario_justificativa_id: usuarioId,
        updated_at: new Date().toISOString()
      })
      .eq('id', contaReceberId);

    if (error) throw error;
    return { sucesso: true, mensagem: 'Divergência justificada com sucesso' };
  } catch (err) {
    console.error('Erro ao justificar divergência:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Busca configurações personalizadas de adquirentes.
 */
export async function fetchAdquirentesConfig(unidadeId) {
  if (!unidadeId) return [];
  try {
    const { data, error } = await supabase
      .from('configuracoes_adquirentes')
      .select('*')
      .eq('unidade_id', unidadeId)
      .eq('ativo', true);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar configurações de adquirentes:', err);
    return [];
  }
}

/**
 * Retorna o resumo consolidado de recebíveis para exibição no dashboard.
 */
export async function fetchResumoRecebiveis(unidadeId) {
  if (!unidadeId) return null;

  try {
    const contas = await fetchContasReceber(unidadeId);
    
    let totalBruto = 0;
    let totalTaxas = 0;
    let totalEsperado = 0;
    let totalRecebido = 0;
    let totalPrevisto = 0;
    let totalDivergente = 0;
    
    const porCanal = {};
    const porAdquirente = {};

    for (const c of contas) {
      if (c.status !== 'CANCELADO') {
        totalBruto += Number(c.valor_bruto || 0);
        totalTaxas += Number(c.taxa_valor || 0) + Number(c.comissao_marketplace_valor || 0);
        totalEsperado += Number(c.valor_liquido_esperado || 0);

        if (c.status === 'RECEBIDO') {
          totalRecebido += Number(c.valor_recebido || c.valor_liquido_esperado || 0);
        } else if (c.status === 'PREVISTO') {
          totalPrevisto += Number(c.valor_liquido_esperado || 0);
        } else if (c.status === 'DIVERGENTE') {
          totalDivergente += Number(c.valor_liquido_esperado || 0);
        }

        const canal = c.canal_venda || 'SALAO';
        porCanal[canal] = arredondar2((porCanal[canal] || 0) + Number(c.valor_bruto || 0));

        const adq = c.adquirente_nome || 'DIRETO';
        porAdquirente[adq] = arredondar2((porAdquirente[adq] || 0) + Number(c.valor_bruto || 0));
      }
    }

    return {
      totalBruto: arredondar2(totalBruto),
      totalTaxas: arredondar2(totalTaxas),
      totalEsperado: arredondar2(totalEsperado),
      totalRecebido: arredondar2(totalRecebido),
      totalPrevisto: arredondar2(totalPrevisto),
      totalDivergente: arredondar2(totalDivergente),
      porCanal,
      porAdquirente,
      quantidadeTitulos: contas.length
    };
  } catch (err) {
    console.error('Erro ao gerar resumo de recebíveis:', err);
    return null;
  }
}
