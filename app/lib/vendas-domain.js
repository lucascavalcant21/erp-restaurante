// ══════════════════════════════════════════════════════════════════════════════
// MOTOR DE NEGÓCIO E DOMÍNIO PURA: VENDAS, RECEBÍVEIS E CONCILIAÇÃO FINANCEIRA (V2)
// HÉFISTO ERP — Gastronomia e Alta Performance Operacional
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Função utilitária para arredondar valores para 2 casas decimais exatas.
 */
export function arredondar2(valor) {
  const num = Number(valor) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Tabela de taxas de adquirentes e prazos padrão por forma de pagamento (Configuração padrão).
 */
export const CONFIGURACOES_ADQUIRENTES_PADRAO = [
  { adquirenteNome: 'STONE', formaPagamento: 'DEBITO', taxaPercentual: 1.8, diasRepasse: 1 },
  { adquirenteNome: 'STONE', formaPagamento: 'CREDITO_AVISTA', taxaPercentual: 2.8, diasRepasse: 30 },
  { adquirenteNome: 'STONE', formaPagamento: 'CREDITO_PARCELADO', taxaBasePercentual: 3.8, taxaPorParcela: 1.0, diasRepasse: 30 },
  { adquirenteNome: 'BANCO', formaPagamento: 'PIX', taxaPercentual: 0.9, diasRepasse: 0 },
  { adquirenteNome: 'CAIXA_PDV', formaPagamento: 'DINHEIRO', taxaPercentual: 0.0, diasRepasse: 0 },
  { adquirenteNome: 'IFOOD', formaPagamento: 'IFOOD_ONLINE', taxaPercentual: 15.0, diasRepasse: 7 },
  { adquirenteNome: 'SODEXO', formaPagamento: 'VOUCHER', taxaPercentual: 3.5, diasRepasse: 30 }
];

/**
 * DECOMPOSIÇÃO ECONÔMICA E DRE (Regime de Competência)
 * Separa explicitamente:
 * - Receita Bruta
 * - Deduções Comerciais (Descontos)
 * - Impostos sobre Vendas (DRE económica)
 * - Taxa de Serviço Cobrada (Equipe x Empresa)
 * - CMV Teórico (Ficha x Vendas)
 */
export function calcularDecomposicaoVenda({
  subtotal = 0,
  desconto = 0,
  percentualTaxaServicoEquipe = 80, // % da taxa que vai para garçons (passivo)
  taxaServicoPercentual = 0,
  comissaoMarketplacePercentual = 0,
  impostosVendaPercentual = 0,
  retencaoFiscalOrigem = 0 // Apenas imposto efetivamente retido na fonte reduz recebível bancário
}) {
  const valSubtotal = arredondar2(subtotal);
  const valDesconto = arredondar2(desconto);
  const subtotalLiquido = Math.max(0, valSubtotal - valDesconto);
  
  const valTaxaServicoCobrada = arredondar2(subtotalLiquido * (Number(taxaServicoPercentual) / 100));
  const valTaxaServicoEquipe = arredondar2(valTaxaServicoCobrada * (Number(percentualTaxaServicoEquipe) / 100));
  const valTaxaServicoEmpresa = arredondar2(valTaxaServicoCobrada - valTaxaServicoEquipe);
  
  const valorVendaBruta = arredondar2(subtotalLiquido + valTaxaServicoCobrada);
  
  const valComissaoMarketplace = arredondar2(valorVendaBruta * (Number(comissaoMarketplacePercentual) / 100));
  const valImpostosVenda = arredondar2(valorVendaBruta * (Number(impostosVendaPercentual) / 100));

  return {
    subtotal: valSubtotal,
    desconto: valDesconto,
    subtotalLiquido,
    taxaServicoCobrada: valTaxaServicoCobrada,
    taxaServicoDestinadaEquipe: valTaxaServicoEquipe,
    taxaServicoRetidaEmpresa: valTaxaServicoEmpresa,
    vendaBruta: valorVendaBruta,
    comissaoMarketplace: valComissaoMarketplace,
    impostosVenda: valImpostosVenda,
    impostosRetidosOrigem: arredondar2(retencaoFiscalOrigem)
  };
}

/**
 * RECEBÍVEL FINANCEIRO (Banco)
 * CORREÇÃO CONCEITUAL 1:
 * Valor Esperado no Banco = Valor Cobrado do Cliente - Taxas Retidas Adquirente - Comissões Plataforma - Retenções Fiscais Efetivas.
 * Impostos normais NÃO reduzem o recebível bancário se não forem retidos na fonte!
 */
export function calcularRecebivelFinanceiro({
  valorCobradoCliente,
  taxaAdquirenteValor = 0,
  comissaoPlataformaValor = 0,
  retencaoFiscalOrigem = 0,
  outrosAjustes = 0
}) {
  const vCliente = arredondar2(valorCobradoCliente);
  const vTaxa = arredondar2(taxaAdquirenteValor);
  const vComissao = arredondar2(comissaoPlataformaValor);
  const vRetencao = arredondar2(retencaoFiscalOrigem);
  const vAjustes = arredondar2(outrosAjustes);

  const valorLiquidoEsperadoBanco = Math.max(0, arredondar2(vCliente - vTaxa - vComissao - vRetencao + vAjustes));

  return {
    valorCobradoCliente: vCliente,
    taxaAdquirenteValor: vTaxa,
    comissaoPlataformaValor: vComissao,
    retencaoFiscalOrigem: vRetencao,
    outrosAjustes: vAjustes,
    valorLiquidoEsperadoBanco
  };
}

/**
 * Busca dinamica ou fallback das configurações de taxas e prazos de repasse D+N.
 */
export function calcularTaxaEDataRepasse(
  formaPagamento,
  adquirenteNome = null,
  dataVenda = new Date(),
  totalParcelas = 1,
  configuracoesPersonalizadas = []
) {
  const formaKey = String(formaPagamento).toUpperCase();
  const adqKey = String(adquirenteNome || '').toUpperCase();

  // 1. Procurar nas configurações personalizadas
  let match = configuracoesPersonalizadas.find(
    c => c.forma_pagamento?.toUpperCase() === formaKey && (adqKey ? c.adquirente_nome?.toUpperCase() === adqKey : true)
  );

  // 2. Fallback nas padrão
  if (!match) {
    match = CONFIGURACOES_ADQUIRENTES_PADRAO.find(
      c => c.formaPagamento === formaKey && (adqKey ? c.adquirenteNome === adqKey : true)
    ) || CONFIGURACOES_ADQUIRENTES_PADRAO.find(c => c.formaPagamento === formaKey) || {
      taxaPercentual: 0,
      diasRepasse: 0,
      adquirenteNome: 'DIRETO'
    };
  }

  let taxaPercentual = Number(match.taxaPercentual || match.taxa_debito || match.taxa_credito_avista || 0);
  if (formaKey === 'CREDITO_PARCELADO') {
    const base = Number(match.taxaBasePercentual || match.taxa_credito_parcelado_base || 3.8);
    const parc = Number(match.taxaPorParcela || match.taxa_parcela_adicional || 1.0);
    taxaPercentual = base + parc * Math.max(0, totalParcelas - 1);
  }

  const diasRepasse = Number(match.diasRepasse !== undefined ? match.diasRepasse : match.dias_repasse_credito || match.dias_repasse_debito || 0);
  const dtBase = dataVenda ? new Date(dataVenda) : new Date();
  const dataPrevistaRepasse = new Date(dtBase.getTime() + diasRepasse * 24 * 60 * 60 * 1000);

  return {
    formaPagamento: formaKey,
    adquirenteNome: adquirenteNome || match.adquirenteNome || match.adquirente_nome || 'DIRETO',
    taxaPercentual: arredondar2(taxaPercentual),
    diasRepasse,
    dataPrevistaRepasse: dataPrevistaRepasse.toISOString().split('T')[0]
  };
}

/**
 * Gera os títulos de Contas a Receber com suporte a Split (`venda_pagamentos`).
 */
export function gerarTitulosContasReceber({
  vendaId,
  codigoVenda,
  unidadeId,
  canalVenda = 'SALAO',
  dataVenda = new Date(),
  splitPagamentos = [],
  configuracoesAdquirentes = []
}) {
  if (!splitPagamentos || splitPagamentos.length === 0) return [];

  const titulos = [];
  const dtIso = dataVenda ? (typeof dataVenda === 'string' ? dataVenda : dataVenda.toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];

  for (let i = 0; i < splitPagamentos.length; i++) {
    const pag = splitPagamentos[i];
    const valorBruto = arredondar2(pag.valor);
    const parcelas = Number(pag.parcelas) || 1;
    
    const infoRepasse = calcularTaxaEDataRepasse(pag.formaPagamento, pag.adquirente, dtIso, parcelas, configuracoesAdquirentes);
    const taxaValor = arredondar2(valorBruto * (infoRepasse.taxaPercentual / 100));
    const comissaoMktValor = arredondar2(valorBruto * ((Number(pag.comissaoMarketplacePercentual) || 0) / 100));
    const retencaoFiscal = arredondar2(pag.retencaoFiscal || 0);
    
    // CORREÇÃO CONCEITUAL 1: Impostos normais NÃO reduzem o recebível a menos que seja retenção na origem
    const calcRec = calcularRecebivelFinanceiro({
      valorCobradoCliente: valorBruto,
      taxaAdquirenteValor: taxaValor,
      comissaoPlataformaValor: comissaoMktValor,
      retencaoFiscalOrigem: retencaoFiscal
    });

    const isImediato = infoRepasse.diasRepasse === 0 || infoRepasse.formaPagamento === 'DINHEIRO';
    
    for (let p = 1; p <= parcelas; p++) {
      const valorParcelaBruto = arredondar2(valorBruto / parcelas);
      const taxaParcelaValor = arredondar2(taxaValor / parcelas);
      const comissaoParcelaValor = arredondar2(comissaoMktValor / parcelas);
      const liquidoParcela = arredondar2(calcRec.valorLiquidoEsperadoBanco / parcelas);
      
      const dtParcela = new Date(new Date(infoRepasse.dataPrevistaRepasse).getTime() + (p - 1) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      titulos.push({
        unidade_id: unidadeId,
        venda_id: vendaId,
        venda_pagamento_id: pag.id || null,
        codigo_venda: codigoVenda,
        canal_venda: canalVenda,
        forma_pagamento: infoRepasse.formaPagamento,
        adquirente_nome: infoRepasse.adquirenteNome,
        nsu_autorizacao: pag.nsu || null,
        parcela_numero: p,
        total_parcelas: parcelas,
        valor_bruto: valorParcelaBruto,
        taxa_percentual: infoRepasse.taxaPercentual,
        taxa_valor: taxaParcelaValor,
        comissao_marketplace_valor: comissaoParcelaValor,
        retencao_fiscal: retencaoFiscal,
        valor_liquido_esperado: liquidoParcela,
        valor_recebido: isImediato ? liquidoParcela : 0,
        data_venda: dtIso,
        data_prevista_repasse: isImediato ? dtIso : dtParcela,
        data_real_repasse: isImediato ? dtIso : null,
        status: isImediato ? 'RECEBIDO' : 'PREVISTO',
        chave_idempotencia: `${codigoVenda || vendaId}_P${i + 1}_PARC${p}`
      });
    }
  }

  return titulos;
}

/**
 * CONCILIAÇÃO BANCÁRIA POR LOTE OU INDIVIDUAL COM TOLERÂNCIA E JUSTIFICATIVA
 */
export function verificarDivergenciaConciliacao(valorEsperado, valorDepositado, tolerancia = 0.01) {
  const vEsp = arredondar2(valorEsperado);
  const vDep = arredondar2(valorDepositado);
  const diferenca = arredondar2(vEsp - vDep);

  if (Math.abs(diferenca) <= tolerancia) {
    return {
      statusConciliacao: 'CONCILIADO_OK',
      statusRecebivel: 'RECEBIDO',
      diferenca: 0,
      mensagem: 'Conciliação exata dentro da tolerância.'
    };
  }

  return {
    statusConciliacao: 'CONCILIADO_COM_DIVERGENCIA',
    statusRecebivel: 'DIVERGENTE',
    diferenca,
    mensagem: diferenca > 0 
      ? `Divergência detectada: depósito a menor em R$ ${diferenca.toFixed(2)}.`
      : `Divergência detectada: depósito a maior em R$ ${Math.abs(diferenca).toFixed(2)}.`
  };
}

/**
 * CONCILIAÇÃO POR LOTE (1 Repasse Bancário -> N Recebíveis)
 */
export function calcularConciliacaoLote(recebiveis = [], valorDepositadoBanco = 0, tolerancia = 0.01) {
  const valorEsperadoTotal = arredondar2(recebiveis.reduce((acc, r) => acc + Number(r.valor_liquido_esperado || 0), 0));
  const evalRes = verificarDivergenciaConciliacao(valorEsperadoTotal, valorDepositadoBanco, tolerancia);

  return {
    quantidadeTitulos: recebiveis.length,
    valorEsperadoTotal,
    valorDepositadoBanco: arredondar2(valorDepositadoBanco),
    diferenca: evalRes.diferenca,
    statusConciliacao: evalRes.statusConciliacao,
    mensagem: evalRes.mensagem
  };
}
