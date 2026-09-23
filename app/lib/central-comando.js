// ══════════════════════════════════════════════════════════════════════════════
// CAMADA DE AGREGADO E SERVIÇOS: CENTRAL DE COMANDO INTELIGENTE
// HÉFISTO ERP — Fonte Única da Verdade para Decisão Operacional
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase.js';
import { 
  arredondar2, 
  avaliarSinaisEstoque, 
  avaliarProducaoSugerida, 
  avaliarSinaisFinanceiros,
  analisarImpactoCustoInsumo,
  simularPrecoVendaAlvo
} from './sinais-domain.js';

/**
 * Busca o resumo completo e estruturado da Central de Comando com isolamento de perfil.
 */
export async function fetchCentralDeComandoResumo(unidadeId, podeVerFinanceiro = true) {
  if (!unidadeId) return null;

  try {
    // 1. Tentar chamar RPC consolidada obter_resumo_central_comando (autorização financeira resolvida no banco via auth.uid())
    const { data: rpcData, error: rpcErr } = await supabase.rpc('obter_resumo_central_comando', {
      p_unidade_id: unidadeId
    });

    if (!rpcErr && rpcData && rpcData.sucesso) {
      return rpcData;
    }

    // 2. Fallback JS Aggregator se RPC não estiver aplicada ainda
    const hojeIso = new Date().toISOString().split('T')[0];
    const mesAnoAtual = hojeIso.substring(0, 7);

    const [
      { data: estoque },
      { data: producao },
      { data: compras },
      { data: contasPagar },
      { data: contasReceber },
      { data: vendas }
    ] = await Promise.all([
      supabase.from('estoque_atual').select('*, insumos(*)').eq('unidade_id', unidadeId),
      supabase.from('producao_dia').select('*').eq('unidade_id', unidadeId).eq('data_producao', hojeIso),
      supabase.from('compras_pedidos').select('*').eq('unidade_id', unidadeId).eq('status', 'pendente'),
      podeVerFinanceiro ? supabase.from('contas_pagar').select('*').eq('unidade_id', unidadeId) : Promise.resolve({ data: [] }),
      podeVerFinanceiro ? supabase.from('contas_receber').select('*').eq('unidade_id', unidadeId) : Promise.resolve({ data: [] }),
      supabase.from('vendas').select('*').eq('unidade_id', unidadeId).eq('data_venda', hojeIso)
    ]);

    // Gerar Sinais Operacionais via Domain Engine
    const sinaisEstoque = avaliarSinaisEstoque(estoque || []);
    const sinaisFinanceiros = podeVerFinanceiro ? avaliarSinaisFinanceiros(contasPagar || [], contasReceber || []) : [];

    const todosSinais = [...sinaisFinanceiros, ...sinaisEstoque];

    // Resumo Operacional
    const operacao = {
      estoque_abaixo_minimo: (estoque || []).filter(e => (Number(e.quantidade_atual) <= Number(e.estoque_minimo || e.insumos?.estoque_minimo || 0)) && Number(e.estoque_minimo || e.insumos?.estoque_minimo || 0) > 0).length,
      estoque_sem_saldo: (estoque || []).filter(e => Number(e.quantidade_atual) <= 0).length,
      producoes_concluidas_hoje: (producao || []).filter(p => p.status === 'concluido').length,
      producoes_pendentes_hoje: (producao || []).filter(p => p.status === 'pendente').length,
      compras_pendentes: (compras || []).length
    };

    // Resumo Financeiro
    let financeiro = { restrito: true };
    if (podeVerFinanceiro) {
      const contasVencidas = (contasPagar || []).filter(cp => (cp.status === 'PENDENTE' || cp.status === 'PARCIALMENTE PAGA') && String(cp.data_vencimento || '').split('T')[0] < hojeIso);
      const contasHoje = (contasPagar || []).filter(cp => (cp.status === 'PENDENTE' || cp.status === 'PARCIALMENTE PAGA') && String(cp.data_vencimento || '').split('T')[0] === hojeIso);
      const recebiveisHoje = (contasReceber || []).filter(cr => cr.status === 'PREVISTO' && String(cr.data_prevista_repasse || '').split('T')[0] === hojeIso);
      const recebiveisDiv = (contasReceber || []).filter(cr => cr.status === 'DIVERGENTE');
      const vendasHoje = (vendas || []).filter(v => v.status !== 'ESTORNADA');

      financeiro = {
        restrito: false,
        contas_vencidas_valor: arredondar2(contasVencidas.reduce((a, c) => a + Number(c.saldo || c.valor || 0), 0)),
        contas_vencem_hoje_valor: arredondar2(contasHoje.reduce((a, c) => a + Number(c.saldo || c.valor || 0), 0)),
        recebiveis_previstos_hoje: arredondar2(recebiveisHoje.reduce((a, r) => a + Number(r.valor_liquido_esperado || 0), 0)),
        recebiveis_divergentes_valor: arredondar2(recebiveisDiv.reduce((a, r) => a + Number(r.valor_liquido_esperado || 0), 0)),
        vendas_hoje_bruto: arredondar2(vendasHoje.reduce((a, v) => a + Number(v.total || v.valor_bruto || 0), 0)),
        vendas_hoje_qtd: vendasHoje.length
      };
    }

    return {
      sucesso: true,
      unidade_id: unidadeId,
      data_consulta: hojeIso,
      operacional: operacao,
      financeiro,
      sinais_ativos: todosSinais
    };
  } catch (err) {
    console.error('Erro ao buscar resumo da Central de Comando:', err);
    return null;
  }
}
