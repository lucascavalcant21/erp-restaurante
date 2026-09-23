// ══════════════════════════════════════════════════════════════════════════════
// ENGINE PURA DE SINAIS OPERACIONAIS E DECISÃO INTELIGENTE
// HÉFISTO ERP — Gastronomia e Alta Performance Operacional
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Utilitário de arredondamento de moeda e quantidades.
 */
export function arredondar2(valor) {
  const num = Number(valor) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * 1. AVALIAÇÃO DE ESTOQUE E VALIDADE
 */
export function avaliarSinaisEstoque(estoqueInsumos = [], validadeLotes = []) {
  const sinais = [];

  for (const item of estoqueInsumos) {
    const qtd = Number(item.quantidade_atual || 0);
    const min = Number(item.estoque_minimo || item.quantidade_minima || 0);
    const insumoNome = item.nome || item.insumos?.nome || 'Insumo';

    if (min > 0 && qtd <= min) {
      const severidade = qtd <= 0 ? 'CRITICO' : 'ATENCAO';
      sinais.push({
        id: `stock-min-${item.insumo_id || item.id}`,
        tipo_sinal: 'STOCK_MINIMUM',
        severidade,
        titulo: `${insumoNome} abaixo do mínimo`,
        descricao: `Estoque atual: ${qtd} ${item.unidade_medida || 'un'} (Mínimo: ${min} ${item.unidade_medida || 'un'}).`,
        entidade_tipo: 'insumo',
        entidade_id: item.insumo_id || item.id,
        acao_rotulo: 'Comprar Insumo',
        acao_url: '/dashboard/operacao/compras',
        dados_json: { insumoNome, qtd, min, necessidade: min - qtd }
      });
    }
  }

  const agora = new Date();
  for (const lote of validadeLotes) {
    if (lote.data_validade) {
      const dtVal = new Date(lote.data_validade);
      const diffHoras = (dtVal - agora) / (1000 * 60 * 60);

      if (diffHoras <= 48 && diffHoras >= 0) {
        sinais.push({
          id: `expiring-${lote.id}`,
          tipo_sinal: 'EXPIRING_PRODUCT',
          severidade: diffHoras <= 24 ? 'CRITICO' : 'ATENCAO',
          titulo: `Validade próxima: ${lote.nome_produto || lote.insumo_nome}`,
          descricao: `Vence em ${Math.ceil(diffHoras)} horas (${lote.quantidade || 0} ${lote.unidade_medida || 'kg'}).`,
          entidade_tipo: 'produto',
          entidade_id: lote.id,
          acao_rotulo: 'Registrar Perda / Uso',
          acao_url: '/dashboard/operacao/validade',
          dados_json: { diffHoras, qtd: lote.quantidade }
        });
      }
    }
  }

  return sinais;
}

/**
 * 2. SUGESTÃO DE PRODUÇÃO DE PRÉ-PREPAROS (SUB-RECEITAS)
 */
export function avaliarProducaoSugerida(fichasBases = [], estoqueAtualMap = {}) {
  const sugestoes = [];

  for (const ficha of fichasBases) {
    if (ficha.tipo_base === 'pre' || ficha.eh_base) {
      const qtdEstoque = Number(estoqueAtualMap[ficha.id] || 0);
      const rendimento = Number(ficha.rendimento_porcoes) || 1;
      const minSugerido = rendimento * 2; // Ex: mínimo de 2 fornadas/lotes

      if (qtdEstoque < minSugerido) {
        const quantidadeProduzir = arredondar2(minSugerido - qtdEstoque);
        sugestoes.push({
          id: `prod-sug-${ficha.id}`,
          tipo_sinal: 'PRODUCTION_SUGGESTED',
          severidade: 'ATENCAO',
          titulo: `Produção sugerida: ${ficha.nome_receita}`,
          descricao: `Estoque atual: ${qtdEstoque} ${ficha.rendimento_unidade || 'porções'} (Mínimo recomendado: ${minSugerido}).`,
          entidade_tipo: 'ficha',
          entidade_id: ficha.id,
          acao_rotulo: 'Planejar Produção',
          acao_url: `/dashboard/operacao/producao?fichaId=${ficha.id}`,
          dados_json: {
            nomeReceita: ficha.nome_receita,
            qtdEstoque,
            sugerido: quantidadeProduzir
          }
        });
      }
    }
  }

  return sugestoes;
}

/**
 * 3. ANÁLISE DE IMPACTO EM CADEIA DE AUMENTO DE CUSTO DE INSUMOS
 */
export function analisarImpactoCustoInsumo({
  insumoId,
  insumoNome,
  precoAnterior,
  precoAtual,
  fichasTecnicas = []
}) {
  const valAnterior = Number(precoAnterior) || 0;
  const valAtual = Number(precoAtual) || 0;

  if (valAnterior <= 0 || valAtual <= valAnterior) {
    return null;
  }

  const percentualAumento = arredondar2(((valAtual - valAnterior) / valAnterior) * 100);
  const variacaoReais = arredondar2(valAtual - valAnterior);

  const fichasAfetadas = [];

  for (const ficha of fichasTecnicas) {
    const ingredientes = ficha.fichas_ingredientes || [];
    const ingMatch = ingredientes.find(i => (i.insumos?.id || i.insumo_id) === insumoId);

    if (ingMatch) {
      const qtdGasta = Number(ingMatch.quantidade) || 0;
      const aumentoNoPrato = arredondar2(qtdGasta * variacaoReais);

      fichasAfetadas.push({
        fichaId: ficha.id,
        nomeReceita: ficha.nome_receita,
        custoAnteriorPrato: Number(ficha.custo_total) || 0,
        novoCustoPrato: arredondar2((Number(ficha.custo_total) || 0) + aumentoNoPrato),
        aumentoNoPrato
      });
    }
  }

  return {
    insumoId,
    insumoNome,
    precoAnterior: valAnterior,
    precoAtual: valAtual,
    percentualAumento,
    variacaoReais,
    quantidadeFichasAfetadas: fichasAfetadas.length,
    fichasAfetadas
  };
}

/**
 * 4. SIMULADOR DE PREÇO DE VENDA PARA CMV ALVO
 */
export function simularPrecoVendaAlvo(custoPrato, cmvAlvoPercentual = 35.0) {
  const custo = Number(custoPrato) || 0;
  const alvo = Number(cmvAlvoPercentual) || 35.0;

  if (custo <= 0 || alvo <= 0) {
    return { precoSugerido: 0, cmvAlvoPercentual: alvo };
  }

  const precoSugerido = arredondar2(custo / (alvo / 100));

  return {
    custoPrato: custo,
    cmvAlvoPercentual: alvo,
    precoSugerido
  };
}

/**
 * 5. AVALIAÇÃO DE SINAIS FINANCEIROS E CONCILIAÇÃO
 */
export function avaliarSinaisFinanceiros(contasPagar = [], contasReceber = []) {
  const sinais = [];
  const hojeIso = new Date().toISOString().split('T')[0];

  let totalVencido = 0;
  let qtdVencidas = 0;

  for (const cp of contasPagar) {
    if (cp.status === 'PENDENTE' || cp.status === 'PARCIALMENTE PAGA') {
      const dtVenc = String(cp.data_vencimento || '').split('T')[0];
      if (dtVenc < hojeIso) {
        totalVencido += Number(cp.saldo || cp.valor || 0);
        qtdVencidas++;
      }
    }
  }

  if (qtdVencidas > 0) {
    sinais.push({
      id: 'fin-payable-overdue',
      tipo_sinal: 'PAYABLE_OVERDUE',
      severidade: 'CRITICO',
      titulo: `${qtdVencidas} contas a pagar atrasadas`,
      descricao: `Total acumulado em atraso: R$ ${arredondar2(totalVencido).toFixed(2)}.`,
      entidade_tipo: 'conta_pagar',
      acao_rotulo: 'Cuidar das Contas',
      acao_url: '/dashboard/financeiro/contas?status=VENCIDA',
      dados_json: { qtdVencidas, totalVencido: arredondar2(totalVencido) }
    });
  }

  let totalDivergente = 0;
  let qtdDivergentes = 0;

  for (const cr of contasReceber) {
    if (cr.status === 'DIVERGENTE') {
      totalDivergente += Number(cr.valor_liquido_esperado || 0);
      qtdDivergentes++;
    }
  }

  if (qtdDivergentes > 0) {
    sinais.push({
      id: 'fin-receivable-divergence',
      tipo_sinal: 'RECEIVABLE_DIVERGENCE',
      severidade: 'ATENCAO',
      titulo: `${qtdDivergentes} recebíveis com divergência`,
      descricao: `Total sob divergência de taxas/repasses: R$ ${arredondar2(totalDivergente).toFixed(2)}.`,
      entidade_tipo: 'conta_receber',
      acao_rotulo: 'Conciliar Repasses',
      acao_url: '/dashboard/financeiro/conciliacao',
      dados_json: { qtdDivergentes, totalDivergente: arredondar2(totalDivergente) }
    });
  }

  return sinais;
}
