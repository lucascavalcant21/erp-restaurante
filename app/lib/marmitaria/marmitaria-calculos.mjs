// ══════════════════════════════════════════════════════════════════════════════
// MOTOR DE NEGÓCIO E DOMÍNIO: MARMITARIA & DELIVERY (HÉFISTO ERP)
// Funções puras e determinísticas para fichas técnicas, precificação inteligente,
// simulador de vendas, lista de compras, rendimento real, RH (CMO) e DRE.
// ══════════════════════════════════════════════════════════════════════════════

import { arredondar2 } from '../vendas-domain.js';

export const CANAIS_VENDA = [
  { id: 'ifood', nome: 'iFood', taxaPadraoPct: 15.0, taxaPagtoPadraoPct: 0.0, cor: '#ea1d2c' },
  { id: 'whatsapp', nome: 'WhatsApp', taxaPadraoPct: 0.0, taxaPagtoPadraoPct: 1.5, cor: '#25d366' },
  { id: 'balcao', nome: 'Balcão', taxaPadraoPct: 0.0, taxaPagtoPadraoPct: 1.9, cor: '#64748b' },
  { id: 'site', nome: 'Site / Cardápio Digital', taxaPadraoPct: 0.0, taxaPagtoPadraoPct: 2.5, cor: '#3b82f6' },
  { id: 'entrega_propria', nome: 'Entrega Própria', taxaPadraoPct: 0.0, taxaPagtoPadraoPct: 1.5, cor: '#8b5cf6' },
];

export const TAMANHOS_MARMITA = [
  { id: 'PP', nome: 'Tamanho PP (250g - 300g)', pesoMedioG: 280 },
  { id: 'P', nome: 'Tamanho P (350g - 400g)', pesoMedioG: 380 },
  { id: 'M', nome: 'Tamanho M (500g - 600g)', pesoMedioG: 550 },
  { id: 'G', nome: 'Tamanho G (700g - 800g)', pesoMedioG: 750 },
  { id: 'personalizado', nome: 'Personalizado', pesoMedioG: 500 },
];

export const CATEGORIAS_ESTOQUE_MARMITARIA = [
  'Proteínas',
  'Grãos e secos',
  'Hortifruti',
  'Temperos',
  'Óleos e líquidos',
  'Molhos',
  'Pré-preparos',
  'Embalagens',
  'Materiais de trabalho',
  'Marmitas prontas',
];

export const SEQUENCIA_MONTAGEM_PADRAO = [
  { passo: 1, etapa: 'Tipo de embalagem', instrucao: 'Separar recipiente higienizado e etiquetado' },
  { passo: 2, etapa: 'Quantidade de arroz', instrucao: 'Porcionar arroz solto na base' },
  { passo: 3, etapa: 'Quantidade de feijão', instrucao: 'Adicionar concha de feijão na lateral' },
  { passo: 4, etapa: 'Proteína', instrucao: 'Dispor a proteína grelhada/cozida no centro' },
  { passo: 5, etapa: 'Guarnição', instrucao: 'Acomodar purê, legumes ou farofa' },
  { passo: 6, etapa: 'Molho', instrucao: 'Regar ou acondicionar em pote separado se solicitado' },
  { passo: 7, etapa: 'Complementos', instrucao: 'Adicionar cheiro-verde, batata-palha ou salada' },
  { passo: 8, etapa: 'Fechamento', instrucao: 'Lacrar tampa com vedação térmica/pressão' },
  { passo: 9, etapa: 'Etiquetagem', instrucao: 'Colar etiqueta com data, peso, lote e validade' },
  { passo: 10, etapa: 'Expedição', instrucao: 'Embalar na sacola com talheres e guardanapos' },
];

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const pos = (v) => Math.max(0, num(v));

// ─── 1. FICHAS TÉCNICAS E CUSTO TÉCNICO ───────────────────────────────────────

/**
 * Calcula o custo técnico detalhado de uma marmita.
 * 
 * Custo técnico = Custo ingredientes diretos
 *               + Custo pré-preparos utilizados
 *               + Perdas previstas
 *               + Embalagens e descartáveis
 */
export function calcularCustoTecnicoMarmita({
  ingredientes = [],
  preparacoes = [],
  embalagens = [],
  percentualPerdaAdicional = 0,
}) {
  // 1. Ingredientes diretos
  let custoIngredientes = 0;
  let pesoTotalIngredientesG = 0;

  const itensIngredientes = ingredientes.map((item) => {
    const qtd = pos(item.quantidade);
    const custoUnit = pos(item.custo_unitario);
    const fc = pos(item.fator_correcao) || 1;
    const perdaPct = pos(item.perda_pct);

    // Peso líquido e bruto
    const pesoLiquidoG = item.unidade_medida === 'kg' ? qtd * 1000 : qtd;
    const pesoBrutoG = pesoLiquidoG * fc;

    // Se fator_correcao foi informado, o peso bruto é qtd * fc
    // Custo real absorve a perda
    const qtdEfetiva = qtd * fc * (1 + perdaPct / 100);
    const custoItem = arredondar2(qtdEfetiva * custoUnit);

    custoIngredientes += custoItem;
    pesoTotalIngredientesG += pesoLiquidoG;

    return {
      ...item,
      pesoLiquidoG,
      pesoBrutoG,
      fatorCorrecao: fc,
      perdaPct,
      custoTotal: custoItem,
    };
  });

  // 2. Preparações (Fichas de pré-preparo reutilizadas)
  let custoPreparacoes = 0;
  let pesoTotalPreparacoesG = 0;

  const itensPreparacoes = preparacoes.map((prep) => {
    const qtdConsumida = pos(prep.quantidade);
    const custoPorPorcaoOuKg = pos(prep.custo_unitario);
    const rendimentoBase = pos(prep.rendimento_base) || 1;

    // Custo por porção/quantidade proporcional
    const custoPrep = arredondar2(qtdConsumida * custoPorPorcaoOuKg);
    custoPreparacoes += custoPrep;

    const pesoPrepG = prep.unidade_medida === 'kg' ? qtdConsumida * 1000 : qtdConsumida;
    pesoTotalPreparacoesG += pesoPrepG;

    return {
      ...prep,
      custoTotal: custoPrep,
      pesoG: pesoPrepG,
    };
  });

  // 3. Embalagens e descartáveis
  let custoEmbalagens = 0;

  const itensEmbalagens = embalagens.map((emb) => {
    const qtd = pos(emb.quantidade) || 1;
    const custoUnit = pos(emb.custo_unitario);
    const custoItem = arredondar2(qtd * custoUnit);
    custoEmbalagens += custoItem;

    return {
      ...emb,
      custoTotal: custoItem,
    };
  });

  const subtotalAlimentos = arredondar2(custoIngredientes + custoPreparacoes);
  const valorPerdaAdicional = arredondar2(subtotalAlimentos * (pos(percentualPerdaAdicional) / 100));
  const custoTotalAlimentos = arredondar2(subtotalAlimentos + valorPerdaAdicional);
  const custoTecnicoTotal = arredondar2(custoTotalAlimentos + custoEmbalagens);
  const pesoEstimadoFinalG = arredondar2(pesoTotalIngredientesG + pesoTotalPreparacoesG);

  return {
    custoIngredientes: arredondar2(custoIngredientes),
    custoPreparacoes: arredondar2(custoPreparacoes),
    custoTotalAlimentos,
    valorPerdaAdicional,
    custoEmbalagens: arredondar2(custoEmbalagens),
    custoTecnicoTotal,
    pesoEstimadoFinalG,
    itensIngredientes,
    itensPreparacoes,
    itensEmbalagens,
  };
}

// ─── 2. PRECIFICAÇÃO INTELIGENTE POR CANAL ────────────────────────────────────

/**
 * Calcula a precificação por canal considerando taxas reais de contrato,
 * tributos, embalagens, subsídios e metas de margem.
 */
export function calcularPrecificacaoCanal({
  custoTecnicoTotal = 0,
  custoAlimentos = 0,
  custoEmbalagens = 0,
  precoVenda = 0,
  taxaCanalPct = 0, // Ex: 15% no iFood
  taxaPagamentoPct = 0, // Ex: 2% cartão
  tributosPct = 0, // Ex: 6% Simples Nacional
  subsidioEntrega = 0, // Ex: R$ 3,00 entrega grátis bancada pela loja
  promocaoDesconto = 0, // Desconto aplicado na venda
  margemMetaPct = 20, // Meta de margem de contribuição (ex: 20%)
}) {
  const preco = pos(precoVenda);
  const custo = pos(custoTecnicoTotal);

  const valTaxaCanal = arredondar2(preco * (pos(taxaCanalPct) / 100));
  const valTaxaPagamento = arredondar2(preco * (pos(taxaPagamentoPct) / 100));
  const valTributos = arredondar2(preco * (pos(taxaTributos(tributosPct)) / 100));
  const valSubsidio = pos(subsidioEntrega);
  const valDesconto = pos(promocaoDesconto);

  // Preço líquido recebido
  const receitaLiquida = arredondar2(preco - valTaxaCanal - valTaxaPagamento - valTributos - valSubsidio - valDesconto);

  // Margem de contribuição em R$ e %
  const margemContribuicaoR$ = arredondar2(receitaLiquida - custo);
  const margemContribuicaoPct = preco > 0 ? arredondar2((margemContribuicaoR$ / preco) * 100) : 0;

  // CMV técnico percentual
  const cmvPct = preco > 0 ? arredondar2((custo / preco) * 100) : 0;
  const cmvAlimentosPct = preco > 0 ? arredondar2((pos(custoAlimentos) / preco) * 100) : 0;
  const cmvEmbalagensPct = preco > 0 ? arredondar2((pos(custoEmbalagens) / preco) * 100) : 0;

  // Cálculo do Preço Sugerido para atingir a margem desejada:
  // Preco = (Custo + Subsidio + Desconto) / (1 - (TaxaCanal + TaxaPagamento + Tributos + MargemMeta) / 100)
  const somaTaxasPct = pos(taxaCanalPct) + pos(taxaPagamentoPct) + pos(tributosPct) + pos(margemMetaPct);
  let precoSugerido = 0;
  if (somaTaxasPct < 100) {
    const divisor = (100 - somaTaxasPct) / 100;
    precoSugerido = arredondar2((custo + valSubsidio + valDesconto) / divisor);
  }

  const margemAbaixoMeta = margemContribuicaoPct < pos(margemMetaPct);

  return {
    precoVenda: preco,
    custoTecnicoTotal: custo,
    custoAlimentos: pos(custoAlimentos),
    custoEmbalagens: pos(custoEmbalagens),
    cmvPct,
    cmvAlimentosPct,
    cmvEmbalagensPct,
    valTaxaCanal,
    valTaxaPagamento,
    valTributos,
    valSubsidio,
    valDesconto,
    receitaLiquida,
    margemContribuicaoR$,
    margemContribuicaoPct,
    precoSugerido,
    margemMetaPct: pos(margemMetaPct),
    margemAbaixoMeta,
  };
}

function taxaTributos(t) {
  return pos(t);
}

// ─── 3. SIMULADOR DE VENDAS INTERATIVO ────────────────────────────────────────

/**
 * Simula a operação de marmitaria para múltiplos produtos e metas de venda.
 * Calcula volumes diários, semanais e mensais, receitas, custos, CMO rateado,
 * custos fixos, margem de contribuição, resultado operacional e ponto de equilíbrio.
 */
export function simularOperacaoMarmitaria({
  marmitas = [], // [{ id, nome, precoVenda, custoAlimentos, custoEmbalagens, quantidadeDia, taxaCanalPct, taxaPagtoPct, tributosPct }]
  diasOperacaoMes = 26,
  cmoAlocadoMes = 0,
  custosFixosAlocadosMes = 0,
  metaLucroMes = 0,
}) {
  const dias = Math.max(1, pos(diasOperacaoMes));
  const cmoMes = pos(cmoAlocadoMes);
  const fixosMes = pos(custosFixosAlocadosMes);

  let totalQtdDia = 0;
  let totalFaturamentoDia = 0;
  let totalCustoAlimentosDia = 0;
  let totalCustoEmbalagensDia = 0;
  let totalTaxasDia = 0;
  let totalTributosDia = 0;

  const itensDetalhados = marmitas.map((m) => {
    const qtdDia = pos(m.quantidadeDia);
    const preco = pos(m.precoVenda);
    const custoAlim = pos(m.custoAlimentos);
    const custoEmb = pos(m.custoEmbalagens);
    const custoTotalItem = arredondar2(custoAlim + custoEmb);

    const faturamentoItemDia = arredondar2(preco * qtdDia);
    const custoAlimItemDia = arredondar2(custoAlim * qtdDia);
    const custoEmbItemDia = arredondar2(custoEmb * qtdDia);

    const taxasPct = pos(m.taxaCanalPct) + pos(m.taxaPagtoPct);
    const taxasItemDia = arredondar2(faturamentoItemDia * (taxasPct / 100));
    const tributosItemDia = arredondar2(faturamentoItemDia * (pos(m.tributosPct) / 100));

    const margemContribuicaoItemDia = arredondar2(
      faturamentoItemDia - custoAlimItemDia - custoEmbItemDia - taxasItemDia - tributosItemDia
    );

    totalQtdDia += qtdDia;
    totalFaturamentoDia += faturamentoItemDia;
    totalCustoAlimentosDia += custoAlimItemDia;
    totalCustoEmbalagensDia += custoEmbItemDia;
    totalTaxasDia += taxasItemDia;
    totalTributosDia += tributosItemDia;

    return {
      ...m,
      custoTotalItem,
      qtdDia,
      qtdSemana: qtdDia * 6,
      qtdMes: qtdDia * dias,
      faturamentoDia: faturamentoItemDia,
      faturamentoMes: arredondar2(faturamentoItemDia * dias),
      custoAlimentosMes: arredondar2(custoAlimItemDia * dias),
      custoEmbalagensMes: arredondar2(custoEmbItemDia * dias),
      custoTecnicoMes: arredondar2((custoAlimItemDia + custoEmbItemDia) * dias),
      taxasMes: arredondar2(taxasItemDia * dias),
      tributosMes: arredondar2(tributosItemDia * dias),
      margemContribuicaoDia: margemContribuicaoItemDia,
      margemContribuicaoMes: arredondar2(margemContribuicaoItemDia * dias),
      margemContribuicaoPct: faturamentoItemDia > 0 ? arredondar2((margemContribuicaoItemDia / faturamentoItemDia) * 100) : 0,
    };
  });

  // Totais diários, semanais e mensais
  const faturamentoMes = arredondar2(totalFaturamentoDia * dias);
  const faturamentoSemana = arredondar2(totalFaturamentoDia * 6);

  const custoAlimentosMes = arredondar2(totalCustoAlimentosDia * dias);
  const custoEmbalagensMes = arredondar2(totalCustoEmbalagensDia * dias);
  const cmvTotalMes = arredondar2(custoAlimentosMes + custoEmbalagensMes);

  const taxasVendaMes = arredondar2(totalTaxasDia * dias);
  const tributosMes = arredondar2(totalTributosDia * dias);

  const margemContribuicaoMes = arredondar2(faturamentoMes - cmvTotalMes - taxasVendaMes - tributosMes);
  const margemContribuicaoPct = faturamentoMes > 0 ? arredondar2((margemContribuicaoMes / faturamentoMes) * 100) : 0;

  // Custos estruturais
  const custosEstruturaisMes = arredondar2(cmoMes + fixosMes);
  const resultadoOperacionalMes = arredondar2(margemContribuicaoMes - custosEstruturaisMes);
  const margemLiquidaPct = faturamentoMes > 0 ? arredondar2((resultadoOperacionalMes / faturamentoMes) * 100) : 0;

  // Ticket médio e margem de contribuição média por unidade
  const totalQtdMes = totalQtdDia * dias;
  const ticketMedio = totalQtdMes > 0 ? arredondar2(faturamentoMes / totalQtdMes) : 0;
  const margemContribuicaoUnitMedio = totalQtdMes > 0 ? arredondar2(margemContribuicaoMes / totalQtdMes) : 0;

  // Ponto de Equilíbrio (Breakeven):
  // Breakeven Qtd = Custos Estruturais / Margem de Contribuição Média Unitária
  const pontoEquilibrioQtdMes = margemContribuicaoUnitMedio > 0
    ? Math.ceil(custosEstruturaisMes / margemContribuicaoUnitMedio)
    : 0;
  const pontoEquilibrioQtdDia = Math.ceil(pontoEquilibrioQtdMes / dias);
  const pontoEquilibrioFaturamentoMes = arredondar2(pontoEquilibrioQtdMes * ticketMedio);

  // Quantidade necessária para meta de lucro
  const metaLucro = pos(metaLucroMes);
  const qtdParaMetaLucroMes = margemContribuicaoUnitMedio > 0
    ? Math.ceil((custosEstruturaisMes + metaLucro) / margemContribuicaoUnitMedio)
    : 0;
  const qtdParaMetaLucroDia = Math.ceil(qtdParaMetaLucroMes / dias);

  return {
    diasOperacaoMes: dias,
    quantidadeDiaria: totalQtdDia,
    quantidadeSemanal: totalQtdDia * 6,
    quantidadeMensal: totalQtdMes,
    faturamentoDiario: arredondar2(totalFaturamentoDia),
    faturamentoSemanal: faturamentoSemana,
    faturamentoMensal: faturamentoMes,
    custoIngredientesMensal: custoAlimentosMes,
    custoEmbalagensMensal: custoEmbalagensMes,
    cmvTotalMensal: cmvTotalMes,
    cmvPct: faturamentoMes > 0 ? arredondar2((cmvTotalMes / faturamentoMes) * 100) : 0,
    taxasVendaMensal: taxasVendaMes,
    tributosMensal: tributosMes,
    cmoAlocadoMensal: cmoMes,
    custosFixosAlocadosMensal: fixosMes,
    margemContribuicaoMensal: margemContribuicaoMes,
    margemContribuicaoPct,
    resultadoOperacionalMensal: resultadoOperacionalMes,
    lucroEstimadoMensal: resultadoOperacionalMes,
    margemLiquidaPct,
    ticketMedio,
    pontoEquilibrioQtdDia,
    pontoEquilibrioQtdMes,
    pontoEquilibrioFaturamentoMes,
    qtdParaMetaLucroDia,
    qtdParaMetaLucroMes,
    itensDetalhados,
  };
}

/**
 * Gera comparações entre os cenários padrão (20, 30, 50, 100, 150, 200 marmitas/dia).
 */
export function compararCenariosEscala({
  marmitas = [],
  diasOperacaoMes = 26,
  cmoAlocadoMes = 0,
  custosFixosAlocadosMes = 0,
}) {
  const escalasPadrao = [20, 30, 50, 100, 150, 200];
  const somaQtdOriginal = marmitas.reduce((t, m) => t + pos(m.quantidadeDia), 0) || 1;

  return escalasPadrao.map((escala) => {
    // Escala proporcional da distribuição de marmitas
    const marmitasEscaladas = marmitas.map((m) => {
      const proporcao = pos(m.quantidadeDia) / somaQtdOriginal;
      const qtdEscala = Math.round(escala * (proporcao > 0 ? proporcao : 1 / (marmitas.length || 1)));
      return { ...m, quantidadeDia: qtdEscala };
    });

    const sim = simularOperacaoMarmitaria({
      marmitas: marmitasEscaladas,
      diasOperacaoMes,
      cmoAlocadoMes,
      custosFixosAlocadosMes,
    });

    return {
      cenarioMarmitasDia: escala,
      faturamentoMes: sim.faturamentoMensal,
      cmvTotalMes: sim.cmvTotalMensal,
      cmvPct: sim.cmvPct,
      margemContribuicaoMes: sim.margemContribuicaoMensal,
      resultadoOperacionalMes: sim.resultadoOperacionalMensal,
      atingeEquilibrio: sim.quantidadeMensal >= sim.pontoEquilibrioQtdMes,
    };
  });
}

// ─── 4. LISTA DE COMPRAS INTELIGENTE ──────────────────────────────────────────

/**
 * Conecta diretamente a simulação de vendas e as fichas técnicas à lista de compras.
 * Multiplica o consumo pelos fatores de correção, perdas, desconta estoque existente
 * e respeita estoque reservado e quantidades mínimas de embalagem/compra.
 */
export function calcularNecessidadeComprasMarmitaria({
  planoVendas = [], // [{ ficha, quantidadePlanejada }]
  estoquesAtuais = [], // [{ insumo_id, quantidade_atual, quantidade_reservada }]
  fornecedoresInsumos = {}, // { insumo_id: { fornecedor_nome, ultimo_preco, qtd_minima_compra, embalagem_compra } }
}) {
  const mapaConsumo = new Map();

  for (const itemPlano of planoVendas) {
    const ficha = itemPlano.ficha;
    const qtdMarmitas = pos(itemPlano.quantidadePlanejada);
    if (!ficha || qtdMarmitas <= 0) continue;

    // Ingredientes diretos da ficha
    for (const ing of ficha.fichas_ingredientes || ficha.ingredientes || []) {
      const insumoId = ing.insumo_id || ing.insumos?.id;
      if (!insumoId) continue;

      const qtdBase = pos(ing.quantidade);
      const fc = pos(ing.fator_correcao) || 1;
      const perdaPct = pos(ing.perda_pct);
      const qtdNecessariaUnit = qtdBase * fc * (1 + perdaPct / 100);
      const consumoTotal = qtdNecessariaUnit * qtdMarmitas;

      const atual = mapaConsumo.get(insumoId) || {
        insumoId,
        nome: ing.insumos?.nome || ing.nome || 'Insumo',
        unidade: ing.unidade_medida || ing.insumos?.unidade_medida || 'un',
        categoria: ing.insumos?.categoria || 'Geral',
        quantidadeConsumir: 0,
        custoUnitario: pos(ing.insumos?.custo_unitario ?? ing.custo_unitario),
      };

      atual.quantidadeConsumir += consumoTotal;
      mapaConsumo.set(insumoId, atual);
    }

    // Embalagens vinculadas à ficha
    for (const emb of ficha.embalagens || []) {
      const insumoId = emb.embalagem_insumo_id || emb.insumo_id || emb.id;
      if (!insumoId) continue;

      const qtdEmbUnit = pos(emb.quantidade) || 1;
      const consumoTotal = qtdEmbUnit * qtdMarmitas;

      const atual = mapaConsumo.get(insumoId) || {
        insumoId,
        nome: emb.nome || 'Embalagem',
        unidade: 'un',
        categoria: 'Embalagens',
        quantidadeConsumir: 0,
        custoUnitario: pos(emb.custo_unitario),
      };

      atual.quantidadeConsumir += consumoTotal;
      mapaConsumo.set(insumoId, atual);
    }
  }

  // Mapeia estoques e necessidades líquidas
  const mapaEstoque = new Map();
  for (const est of estoquesAtuais) {
    mapaEstoque.set(est.insumo_id, {
      atual: pos(est.quantidade_atual),
      reservado: pos(est.quantidade_reservada),
      disponivelUtilizavel: Math.max(0, pos(est.quantidade_atual) - pos(est.quantidade_reservada)),
    });
  }

  const itensCompra = [];
  let custoTotalPrevisto = 0;

  for (const [insumoId, item] of mapaConsumo.entries()) {
    const est = mapaEstoque.get(insumoId) || { atual: 0, reservado: 0, disponivelUtilizavel: 0 };
    const forn = fornecedoresInsumos[insumoId] || {};

    const qtdNecessaria = arredondar2(item.quantidadeConsumir);
    const estoqueDisponivel = arredondar2(est.disponivelUtilizavel);
    let qtdFaltante = Math.max(0, arredondar2(qtdNecessaria - estoqueDisponivel));

    // Ajuste por quantidade mínima de compra
    const qtdMinima = pos(forn.qtd_minima_compra);
    let qtdComprar = qtdFaltante;
    if (qtdFaltante > 0 && qtdMinima > 0 && qtdFaltante < qtdMinima) {
      qtdComprar = qtdMinima;
    }

    const precoEstimado = pos(forn.ultimo_preco) || pos(item.custoUnitario);
    const subtotal = arredondar2(qtdComprar * precoEstimado);
    custoTotalPrevisto += subtotal;

    itensCompra.push({
      insumoId,
      produto: item.nome,
      categoria: item.categoria,
      unidade: item.unidade,
      quantidadeNecessaria: qtdNecessaria,
      estoqueDisponivel,
      estoqueReservado: est.reservado,
      quantidadeComprar: qtdComprar,
      fornecedor: forn.fornecedor_nome || 'A definir',
      ultimoPreco: precoEstimado,
      subtotal,
    });
  }

  return {
    itensCompra: itensCompra.sort((a, b) => b.subtotal - a.subtotal),
    custoTotalPrevisto: arredondar2(custoTotalPrevisto),
    totalItensNecessarios: itensCompra.length,
    itensComFaltaEstoque: itensCompra.filter((i) => i.quantidadeComprar > 0).length,
  };
}

// ─── 5. CONTROLE DE RENDIMENTO REAL DAS PREPARAÇÕES ───────────────────────────

/**
 * Calcula o rendimento real na cozinha (limpeza, cocção e porcionamento).
 * Exemplo: 10 kg de frango comprado -> 8,5 kg após limpeza -> 6,8 kg após cocção -> 45 porções -> custo real/porção.
 */
export function calcularRendimentoReal({
  pesoCompradoBrutoKg = 0,
  custoTotalComprado = 0,
  pesoAposLimpezaKg = 0,
  pesoAposCoccaoKg = 0,
  porcoesProduzidas = 0,
}) {
  const pBruto = pos(pesoCompradoBrutoKg);
  const custoTotal = pos(custoTotalComprado);
  const pLimpo = pos(pesoAposLimpezaKg);
  const pCozido = pos(pesoAposCoccaoKg);
  const porcoes = pos(porcoesProduzidas);

  const perdaLimpezaPct = pBruto > 0 ? arredondar2(((pBruto - pLimpo) / pBruto) * 100) : 0;
  const fatorCorrecaoReal = pLimpo > 0 ? arredondar2(pBruto / pLimpo) : 1;

  const perdaCoccaoPct = pLimpo > 0 ? arredondar2(((pLimpo - pCozido) / pLimpo) * 100) : 0;
  const fatorCoccaoReal = pCozido > 0 ? arredondar2(pLimpo / pCozido) : 1;

  const rendimentoTotalPct = pBruto > 0 ? arredondar2((pCozido / pBruto) * 100) : 0;
  const custoRealPorKgCozido = pCozido > 0 ? arredondar2(custoTotal / pCozido) : 0;
  const custoFinalPorPorcao = porcoes > 0 ? arredondar2(custoTotal / porcoes) : 0;
  const pesoMedioPorcaoG = porcoes > 0 ? arredondar2((pCozido * 1000) / porcoes) : 0;

  return {
    pesoCompradoBrutoKg: pBruto,
    custoTotalComprado: custoTotal,
    pesoAposLimpezaKg: pLimpo,
    pesoAposCoccaoKg: pCozido,
    porcoesProduzidas: porcoes,
    perdaLimpezaPct,
    fatorCorrecaoReal,
    perdaCoccaoPct,
    fatorCoccaoReal,
    rendimentoTotalPct,
    custoRealPorKgCozido,
    custoFinalPorPorcao,
    pesoMedioPorcaoG,
  };
}

// ─── 6. ALOCAÇÃO DE RH & CMO DA MARMITARIA ────────────────────────────────────

/**
 * Aloca custos de colaboradores (exclusivos, compartilhados e extras)
 * à operação de marmitaria para cálculo fiel do CMO sem duplicar a folha do ERP.
 */
export function calcularCmoAlocadoMarmitaria(colaboradoresAlocados = []) {
  let cmoTotal = 0;
  let cmoExclusivos = 0;
  let cmoCompartilhados = 0;
  let cmoExtras = 0;

  const detalhe = colaboradoresAlocados.map((colab) => {
    const salarioBase = pos(colab.salario_base || colab.remuneracao);
    const encargos = pos(colab.encargos_provisoes);
    const beneficios = pos(colab.beneficios);
    const remuneracaoTotal = salarioBase + encargos + beneficios;

    const tipo = colab.tipo_alocacao || 'compartilhado'; // 'exclusivo', 'compartilhado', 'extra'
    const pctDedicacao = tipo === 'exclusivo' ? 100 : pos(colab.percentual_tempo || colab.pct_dedicacao);
    const cmoItem = arredondar2(remuneracaoTotal * (pctDedicacao / 100));

    cmoTotal += cmoItem;
    if (tipo === 'exclusivo') cmoExclusivos += cmoItem;
    else if (tipo === 'extra') cmoExtras += cmoItem;
    else cmoCompartilhados += cmoItem;

    return {
      ...colab,
      remuneracaoTotal: arredondar2(remuneracaoTotal),
      pctDedicacao,
      cmoAlocado: cmoItem,
    };
  });

  return {
    cmoTotal: arredondar2(cmoTotal),
    cmoExclusivos: arredondar2(cmoExclusivos),
    cmoCompartilhados: arredondar2(cmoCompartilhados),
    cmoExtras: arredondar2(cmoExtras),
    colaboradores: detalhe,
  };
}

// ─── 7. DRE GERENCIAL DA MARMITARIA ───────────────────────────────────────────

/**
 * Estrutura a DRE Gerencial exclusiva da Marmitaria & Delivery:
 * 
 *   Receita bruta
 *   (-) Deduções e tributos sobre vendas
 *   = Receita líquida
 *   (-) Custo dos produtos vendidos (CMV Alimentos + Embalagens)
 *   = Lucro bruto
 *   (-) Despesas variáveis de comercialização (Taxas iFood, Maquininhas, Entregas)
 *   = Margem de contribuição gerencial
 *   (-) CMO e despesas operacionais da marmitaria
 *   = Resultado operacional
 *   (+/-) Demais resultados
 *   = Resultado final
 */
export function calcularDreGerencialMarmitaria({
  vendasCanais = {}, // { ifood: 0, whatsapp: 0, balcao: 0, site: 0, entrega_propria: 0 }
  tributos = 0,
  cancelamentosEDescontos = 0,
  cmvAlimentos = 0,
  cmvEmbalagens = 0,
  taxasIfood = 0,
  taxasMeiosPagamento = 0,
  subsidiosEntrega = 0,
  cmoAlocado = 0,
  despesasFixasDiretas = 0,
  despesasRateadasCozinha = 0, // Aluguel, gás, luz compartilhados
  outrasReceitasDespesas = 0,
}) {
  const receitaBruta = Object.values(vendasCanais).reduce((t, v) => t + pos(v), 0);
  const deducoesVendas = pos(tributos) + pos(cancelamentosEDescontos);
  const receitaLiquida = arredondar2(receitaBruta - deducoesVendas);

  const cmvTotal = arredondar2(pos(cmvAlimentos) + pos(cmvEmbalagens));
  const lucroBruto = arredondar2(receitaLiquida - cmvTotal);

  const despesasVariaveis = arredondar2(pos(taxasIfood) + pos(taxasMeiosPagamento) + pos(subsidiosEntrega));
  const margemContribuicao = arredondar2(lucroBruto - despesasVariaveis);

  const despesasOperacionais = arredondar2(pos(cmoAlocado) + pos(despesasFixasDiretas) + pos(despesasRateadasCozinha));
  const resultadoOperacional = arredondar2(margemContribuicao - despesasOperacionais);

  const resultadoFinal = arredondar2(resultadoOperacional + num(outrasReceitasDespesas));

  // Percentuais sobre a receita bruta
  const pct = (val) => (receitaBruta > 0 ? arredondar2((val / receitaBruta) * 100) : 0);

  return {
    receitaBruta: arredondar2(receitaBruta),
    vendasPorCanal: vendasCanais,
    deducoesVendas: arredondar2(deducoesVendas),
    tributos: pos(tributos),
    cancelamentosEDescontos: pos(cancelamentosEDescontos),
    receitaLiquida,
    pctReceitaLiquida: pct(receitaLiquida),

    cmvAlimentos: pos(cmvAlimentos),
    cmvEmbalagens: pos(cmvEmbalagens),
    cmvTotal,
    pctCmvTotal: pct(cmvTotal),

    lucroBruto,
    pctLucroBruto: pct(lucroBruto),

    despesasVariaveis,
    taxasIfood: pos(taxasIfood),
    taxasMeiosPagamento: pos(taxasMeiosPagamento),
    subsidiosEntrega: pos(subsidiosEntrega),
    pctDespesasVariaveis: pct(despesasVariaveis),

    margemContribuicao,
    pctMargemContribuicao: pct(margemContribuicao),

    cmoAlocado: pos(cmoAlocado),
    despesasFixasDiretas: pos(despesasFixasDiretas),
    despesasRateadasCozinha: pos(despesasRateadasCozinha),
    despesasOperacionais,
    pctDespesasOperacionais: pct(despesasOperacionais),

    resultadoOperacional,
    pctResultadoOperacional: pct(resultadoOperacional),

    resultadoFinal,
    pctResultadoFinal: pct(resultadoFinal),
  };
}

// ─── 8. PLANEJAMENTO INTELIGENTE 360º (CENTRAL DIÁRIA / SEMANAL) ──────────────

/**
 * Converte meta de vendas em plano operacional completo:
 * - Vendas e receita prevista
 * - Explosão de ingredientes e embalagens com desconto de estoque utilizável
 * - Estimativa de lista de compras e custos
 * - Equipe de RH e horas necessárias com base na produtividade média
 * - Capacidade produtiva (tempo total de montagem/cocção vs minutos disponíveis na cozinha)
 * - Projeção de margem e resultado da operação planejada
 */
export function gerarPlanoOperacionalCompleto({
  metaMarmitas = 100,
  mixProdutos = [], // [{ id, nome, precoVenda, custoAlimentos, custoEmbalagens, pctMix, tempoPreparoMin }]
  estoqueInsumos = new Map(), // Map(insumoId -> { disponivelUtilizavel, custoUnitario, unidade, nome })
  estoqueEmbalagens = new Map(), // Map(embalagemId -> { disponivelUtilizavel, custoUnitario, nome })
  colaboradoresAlocados = [], // [{ id, nome, horas_por_semana, salario_base }]
  horasOperacaoDia = 6, // Janela operacional de preparo (ex: 6 horas)
}) {
  const metaTotal = Math.max(0, parseInt(metaMarmitas, 10) || 0);

  // 1. Vendas previstas e mix de produtos
  let faturamentoPrevisto = 0;
  let custoAlimentosPrevisto = 0;
  let custoEmbalagensPrevisto = 0;
  let tempoTotalPreparoMin = 0;

  const distribuicao = (mixProdutos || []).map((prod) => {
    const pct = pos(prod.pctMix || (100 / Math.max(1, mixProdutos.length)));
    const qtdItem = Math.round((metaTotal * pct) / 100);
    const preco = pos(prod.precoVenda || 26.0);
    const cAlim = pos(prod.custoAlimentos || 6.8);
    const cEmb = pos(prod.custoEmbalagens || 2.05);
    const tPreparo = pos(prod.tempoPreparoMin || 1.8); // minutos por marmita na linha

    const fat = arredondar2(qtdItem * preco);
    const totAlim = arredondar2(qtdItem * cAlim);
    const totEmb = arredondar2(qtdItem * cEmb);

    faturamentoPrevisto += fat;
    custoAlimentosPrevisto += totAlim;
    custoEmbalagensPrevisto += totEmb;
    tempoTotalPreparoMin += qtdItem * tPreparo;

    return {
      ...prod,
      quantidadePlanejada: qtdItem,
      faturamentoPrevisto: fat,
      custoAlimentosPrevisto: totAlim,
      custoEmbalagensPrevisto: totEmb,
    };
  });

  const cmvPrevistoTotal = arredondar2(custoAlimentosPrevisto + custoEmbalagensPrevisto);

  // 2. Capacidade produtiva e gargalo
  // Produtividade estimada: 1 profissional monta/expede ~15 marmitas por hora
  const produtividadeMarmitasPorHoraPessoa = 14;
  const horasTotaisNecessarias = metaTotal > 0 ? arredondar2(metaTotal / produtividadeMarmitasPorHoraPessoa) : 0;
  const pessoasNecessarias = Math.max(1, Math.ceil(horasTotaisNecessarias / Math.max(1, horasOperacaoDia)));

  const minutosDisponiveisCozinha = horasOperacaoDia * 60;
  const capacidadeTotalCozinhaMarmitas = Math.round(minutosDisponiveisCozinha / 2.0); // 1 marmita a cada 2 min na linha
  const percentualOcupacaoCapacidade = capacidadeTotalCozinhaMarmitas > 0
    ? arredondar2((metaTotal / capacidadeTotalCozinhaMarmitas) * 100)
    : 0;

  const haSobrecarga = metaTotal > capacidadeTotalCozinhaMarmitas;

  // 3. Equipe disponível
  const pessoasDisponiveis = colaboradoresAlocados.length || 3;
  const cmoDiarioEstimado = colaboradoresAlocados.reduce((t, c) => {
    const sal = pos(c.salario_base || 2000) * 1.35 + 300;
    return t + (sal / 26) * (pos(c.percentual_tempo || 100) / 100);
  }, 0) || (pessoasNecessarias * 110);

  // 4. Margem de contribuição prevista
  const taxasCanaisEstimadas = arredondar2(faturamentoPrevisto * 0.10); // média ponderada multicanal (~10%)
  const margemContribuicaoPrevista = arredondar2(faturamentoPrevisto - cmvPrevistoTotal - taxasCanaisEstimadas);
  const lucroOperacionalPrevisto = arredondar2(margemContribuicaoPrevista - cmoDiarioEstimado - 85); // R$ 85 rateio fixo diário

  return {
    metaTotal,
    faturamentoPrevisto: arredondar2(faturamentoPrevisto),
    custoAlimentosPrevisto: arredondar2(custoAlimentosPrevisto),
    custoEmbalagensPrevisto: arredondar2(custoEmbalagensPrevisto),
    cmvPrevistoTotal,
    pctCmvPrevisto: faturamentoPrevisto > 0 ? arredondar2((cmvPrevistoTotal / faturamentoPrevisto) * 100) : 0,
    margemContribuicaoPrevista,
    cmoDiarioEstimado: arredondar2(cmoDiarioEstimado),
    lucroOperacionalPrevisto,
    distribuicaoProdutos: distribuicao,
    horasTotaisNecessarias,
    pessoasNecessarias,
    pessoasDisponiveis,
    defasagemEquipe: Math.max(0, pessoasNecessarias - pessoasDisponiveis),
    tempoTotalPreparoMin: Math.round(tempoTotalPreparoMin),
    minutosDisponiveisCozinha,
    percentualOcupacaoCapacidade,
    haSobrecarga,
  };
}

// ─── 9. ENGENHARIA DE CARDÁPIO (MATRIZ BCG DE RENTABILIDADE) ──────────────────

/**
 * Classifica os produtos de marmitaria em 4 quadrantes clássicos:
 * - ESTRELA (Star): Alta popularidade e Alta margem de contribuição
 * - BURRO DE CARGA (Plowhorse): Alta popularidade e Baixa margem
 * - QUEBRA-CABEÇA / ENIGMA (Puzzle): Baixa popularidade e Alta margem
 * - CÃO / ABACAXI (Dog): Baixa popularidade e Baixa margem
 */
export function classificarEngenhariaCardapio(produtos = []) {
  if (!produtos || produtos.length === 0) return { itens: [], mediaVolume: 0, mediaMargem: 0 };

  const totalVolume = produtos.reduce((t, p) => t + pos(p.volumeVendido), 0);
  const mediaVolume = totalVolume / Math.max(1, produtos.length);

  const totalMargem = produtos.reduce((t, p) => t + pos(p.margemContribuicaoR$), 0);
  const mediaMargem = totalMargem / Math.max(1, produtos.length);

  const itens = produtos.map((prod) => {
    const vol = pos(prod.volumeVendido);
    const margem = pos(prod.margemContribuicaoR$);

    let quadrante = 'cao';
    let recomendacao = '';

    if (vol >= mediaVolume && margem >= mediaMargem) {
      quadrante = 'estrela';
      recomendacao = 'Manter qualidade rígida, manter visibilidade no topo do iFood e proteger padrão.';
    } else if (vol >= mediaVolume && margem < mediaMargem) {
      quadrante = 'burro_de_carga';
      recomendacao = 'Reposicionar preço sutilmente para cima (+R$ 1,50) ou negociar insumos para subir a margem.';
    } else if (vol < mediaVolume && margem >= mediaMargem) {
      quadrante = 'enigma';
      recomendacao = 'Criar fotos atrativas, colocar em combos ou rodar campanha de destaque para aumentar giro.';
    } else {
      quadrante = 'cao';
      recomendacao = 'Avaliar substituição da receita por opção mais rentável ou reformular custos da ficha.';
    }

    return {
      ...prod,
      quadrante,
      recomendacao,
      acimaMediaVolume: vol >= mediaVolume,
      acimaMediaMargem: margem >= mediaMargem,
    };
  });

  return {
    itens,
    mediaVolume: arredondar2(mediaVolume),
    mediaMargem: arredondar2(mediaMargem),
    totalEstrelas: itens.filter((i) => i.quadrante === 'estrela').length,
    totalBurrosDeCarga: itens.filter((i) => i.quadrante === 'burro_de_carga').length,
    totalEnigmas: itens.filter((i) => i.quadrante === 'enigma').length,
    totalCaes: itens.filter((i) => i.quadrante === 'cao').length,
  };
}

// ─── 10. SIMULADOR DE COMBOS, CUPONS E SUBSÍDIO DE FRETE ─────────────────────

/**
 * Simula a viabilidade financeira de um Combo Promocional de Marmita:
 * Ex: Marmita Executiva (R$ 26) + Bebida (R$ 6) + Sobremesa (R$ 8) = R$ 40 avulso.
 * Preço do combo: R$ 34,90 com cupom de R$ 5,00 e frete grátis subsidiado de R$ 3,00 pela loja.
 */
export function simularComboPromocional({
  itensCombo = [], // [{ nome, precoAvulso, custoTecnico }]
  precoCombo = 0,
  cupomDescontoLoja = 0,
  subsidioFreteLoja = 0,
  taxaCanalPct = 15.0, // Ex: 15% iFood
  taxaPagamentoPct = 2.5,
  impostosPct = 6.0,
}) {
  const pCombo = pos(precoCombo);
  const cupom = pos(cupomDescontoLoja);
  const subsidioFrete = pos(subsidioFreteLoja);

  const valorAvulsoTotal = itensCombo.reduce((t, i) => t + pos(i.precoAvulso), 0);
  const custoTecnicoTotal = itensCombo.reduce((t, i) => t + pos(i.custoTecnico), 0);

  // Preço faturado ao cliente após cupom
  const precoFaturado = Math.max(0, pCombo - cupom);

  const valTaxaCanal = arredondar2(precoFaturado * (pos(taxaCanalPct) / 100));
  const valTaxaPgto = arredondar2(precoFaturado * (pos(taxaPagamentoPct) / 100));
  const valImpostos = arredondar2(precoFaturado * (pos(impostosPct) / 100));

  const receitaLiquida = arredondar2(precoFaturado - valTaxaCanal - valTaxaPgto - valImpostos - subsidioFrete);
  const margemContribuicaoR$ = arredondar2(receitaLiquida - custoTecnicoTotal);
  const margemContribuicaoPct = precoFaturado > 0 ? arredondar2((margemContribuicaoR$ / precoFaturado) * 100) : 0;

  const descontoOferecidoClienteR$ = arredondar2(valorAvulsoTotal - precoFaturado);
  const descontoOferecidoPct = valorAvulsoTotal > 0 ? arredondar2((descontoOferecidoClienteR$ / valorAvulsoTotal) * 100) : 0;

  const viavel = margemContribuicaoPct >= 18; // Meta de segurança mínima de 18% para combos

  return {
    valorAvulsoTotal: arredondar2(valorAvulsoTotal),
    precoCombo: pCombo,
    precoFaturado: arredondar2(precoFaturado),
    descontoOferecidoClienteR$,
    descontoOferecidoPct,
    custoTecnicoTotal: arredondar2(custoTecnicoTotal),
    valTaxaCanal,
    valTaxaPgto,
    valImpostos,
    subsidioFreteLoja: subsidioFrete,
    receitaLiquida,
    margemContribuicaoR$,
    margemContribuicaoPct,
    viavel,
  };
}

// ─── 11. CONCILIAÇÃO INTELIGENTE DE REPASSES IFOOD ─────────────────────────────

/**
 * Compara lote de pedidos com extrato oficial importado e sinaliza divergências:
 * - Divergência de comissão contratada vs cobrada
 * - Divergência de taxas de antecipação / cartão
 * - Estornos e cancelamentos indevidos
 */
export function conciliarExtratoIfoodLote({
  pedidosPdv = [], // [{ id, codigo_pedido, valor_bruto, taxa_esperada, valor_esperado }]
  extratoItens = [], // [{ codigo_pedido, valor_bruto, comissao_cobrada, taxa_adquirente, repasse_liquido }]
}) {
  let totalBrutoPdv = 0;
  let totalLiquidoEsperado = 0;
  let totalBrutoExtrato = 0;
  let totalComissaoCobrada = 0;
  let totalTaxasAdquirente = 0;
  let totalRepasseLiquidoReal = 0;

  const mapaExtrato = new Map(extratoItens.map((item) => [String(item.codigo_pedido), item]));

  const conciliados = pedidosPdv.map((ped) => {
    const cod = String(ped.codigo_pedido);
    const itemExtrato = mapaExtrato.get(cod);

    const brutoPdv = pos(ped.valor_bruto);
    totalBrutoPdv += brutoPdv;

    const taxaEsp = pos(ped.taxa_esperada || 15.0);
    const liquidoEsp = pos(ped.valor_esperado || brutoPdv * (1 - taxaEsp / 100));
    totalLiquidoEsperado += liquidoEsp;

    if (!itemExtrato) {
      return {
        codigo: cod,
        valorBrutoPdv: brutoPdv,
        status: 'pendente_extrato',
        divergenciaR$: 0,
        motivo: 'Pedido não consta ainda no extrato financeiro do iFood',
      };
    }

    const brutoExt = pos(itemExtrato.valor_bruto);
    const comissao = pos(itemExtrato.comissao_cobrada);
    const adquirente = pos(itemExtrato.taxa_adquirente);
    const repasseReal = pos(itemExtrato.repasse_liquido);

    totalBrutoExtrato += brutoExt;
    totalComissaoCobrada += comissao;
    totalTaxasAdquirente += adquirente;
    totalRepasseLiquidoReal += repasseReal;

    const diferenca = arredondar2(repasseReal - liquidoEsp);
    const temDivergencia = Math.abs(diferenca) > 0.10; // tolerância de R$ 0,10 por arredondamentos

    return {
      codigo: cod,
      valorBrutoPdv: brutoPdv,
      valorBrutoExtrato: brutoExt,
      comissaoCobrada: comissao,
      taxaAdquirente: adquirente,
      repasseLiquidoReal: repasseReal,
      repasseLiquidoEsperado: liquidoEsp,
      divergenciaR$: diferenca,
      temDivergencia,
      status: temDivergencia ? 'divergente' : 'conciliado',
      motivo: temDivergencia ? (diferenca < 0 ? 'Repasse recebido menor que o previsto em contrato' : 'Repasse maior que o previsto') : 'OK',
    };
  });

  const diferencaConsolidada = arredondar2(totalRepasseLiquidoReal - totalLiquidoEsperado);

  return {
    totalPedidosAnalisados: pedidosPdv.length,
    totalBrutoPdv: arredondar2(totalBrutoPdv),
    totalLiquidoEsperado: arredondar2(totalLiquidoEsperado),
    totalRepasseLiquidoReal: arredondar2(totalRepasseLiquidoReal),
    diferencaConsolidada,
    pedidosConciliados: conciliados.filter((c) => c.status === 'conciliado').length,
    pedidosDivergentes: conciliados.filter((c) => c.status === 'divergente').length,
    pedidosPendentes: conciliados.filter((c) => c.status === 'pendente_extrato').length,
    itens: conciliados,
  };
}

// ─── 12. QUALIDADE, ATENDIMENTO & TAXA DE FALHA OPERACIONAL ──────────────────

/**
 * Consolida métricas de qualidade, erros de montagem, cancelamentos e pontualidade:
 * - Taxa de defeitos operacionais (DPMO / % de pedidos com falha)
 * - Custo financeiro total de perdas e devoluções
 * - Motivos principais de reclamação (ranking)
 */
export function calcularMetricasQualidade({
  ocorrencias = [], // [{ tipo: 'erro_montagem'|'atraso'|'qualidade_comida'|'cancelamento', custo_reembolso, nota_avaliacao }]
  totalPedidos = 100,
}) {
  const total = Math.max(1, totalPedidos);
  const totalFalhas = ocorrencias.length;
  const taxaDefeitoPct = arredondar2((totalFalhas / total) * 100);

  const custoTotalReembolsos = ocorrencias.reduce((t, o) => t + pos(o.custo_reembolso), 0);

  const notas = ocorrencias.filter((o) => pos(o.nota_avaliacao) > 0).map((o) => pos(o.nota_avaliacao));
  const avaliacaoMedia = notas.length > 0 ? arredondar2(notas.reduce((a, b) => a + b, 0) / notas.length) : 4.8;

  // Agrupamento por motivo
  const motivos = {};
  ocorrencias.forEach((o) => {
    const t = o.tipo || 'outro';
    motivos[t] = (motivos[t] || 0) + 1;
  });

  return {
    totalPedidos: total,
    totalOcorrencias: totalFalhas,
    taxaDefeitoPct,
    custoTotalReembolsos: arredondar2(custoTotalReembolsos),
    avaliacaoMedia,
    motivosContagem: motivos,
    conformidadeOperacionalPct: arredondar2(100 - taxaDefeitoPct),
  };
}
