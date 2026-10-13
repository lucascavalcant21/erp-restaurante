import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularCustoTecnicoMarmita,
  calcularPrecificacaoCanal,
  simularOperacaoMarmitaria,
  compararCenariosEscala,
  calcularNecessidadeComprasMarmitaria,
  calcularRendimentoReal,
  calcularCmoAlocadoMarmitaria,
  calcularDreGerencialMarmitaria,
  gerarPlanoOperacionalCompleto,
  classificarEngenhariaCardapio,
  simularComboPromocional,
  conciliarExtratoIfoodLote,
  calcularMetricasQualidade,
} from './marmitaria-calculos.mjs';

test('1. Ficha Técnica Marmita: calcula custo técnico somando ingredientes, pré-preparos e embalagens', () => {
  const ingredientes = [
    { nome: 'Cebola picada', quantidade: 0.05, unidade_medida: 'kg', custo_unitario: 8.0, fator_correcao: 1.1, perda_pct: 5 }, // 0.05 * 1.1 * 1.05 * 8 = 0.46
  ];
  const preparacoes = [
    { nome: 'Arroz branco cozido', quantidade: 0.15, unidade_medida: 'kg', custo_unitario: 6.0 }, // 0.90
    { nome: 'Feijão carioca cozido', quantidade: 0.12, unidade_medida: 'kg', custo_unitario: 8.0 }, // 0.96
    { nome: 'Frango grelhado em tiras', quantidade: 0.15, unidade_medida: 'kg', custo_unitario: 24.0 }, // 3.60
  ];
  const embalagens = [
    { nome: 'Marmita c/ divisória 500ml', quantidade: 1, custo_unitario: 1.20 },
    { nome: 'Tampa transparente', quantidade: 1, custo_unitario: 0.45 },
    { nome: 'Lacre de segurança', quantidade: 1, custo_unitario: 0.08 },
    { nome: 'Kit Talher + Guardanapo', quantidade: 1, custo_unitario: 0.35 },
    { nome: 'Sacola Kraft Delivery', quantidade: 1, custo_unitario: 0.80 },
  ];

  const res = calcularCustoTecnicoMarmita({
    ingredientes,
    preparacoes,
    embalagens,
    percentualPerdaAdicional: 2,
  });

  // Alimentos: 0.46 + 0.90 + 0.96 + 3.60 = 5.92 + 2% perda (0.12) = 6.04
  // Embalagens: 1.20 + 0.45 + 0.08 + 0.35 + 0.80 = 2.88
  // Total: ~ 8.92
  assert.ok(res.custoTecnicoTotal > 8.0 && res.custoTecnicoTotal < 10.0);
  assert.equal(res.custoEmbalagens, 2.88);
  assert.ok(res.pesoEstimadoFinalG > 400);
});

test('2. Precificação Inteligente: canais e preço sugerido para atingir margem alvo', () => {
  const custoTecnico = 8.92;
  const precoVendaIfood = 26.00;

  const precIfood = calcularPrecificacaoCanal({
    custoTecnicoTotal: custoTecnico,
    custoAlimentos: 6.04,
    custoEmbalagens: 2.88,
    precoVenda: precoVendaIfood,
    taxaCanalPct: 15.0, // 15% iFood
    taxaPagamentoPct: 0.0,
    tributosPct: 6.0, // 6% Simples
    subsidioEntrega: 2.0, // R$ 2 subsídio
    promocaoDesconto: 0,
    margemMetaPct: 25.0,
  });

  // Taxa canal = 15% de 26 = 3.90
  assert.equal(precIfood.valTaxaCanal, 3.90);
  // Tributos = 6% de 26 = 1.56
  assert.equal(precIfood.valTributos, 1.56);
  // Receita Líquida = 26 - 3.90 - 1.56 - 2.0 = 18.54
  assert.equal(precIfood.receitaLiquida, 18.54);
  // Margem de contribuição = 18.54 - 8.92 = 9.62
  assert.equal(precIfood.margemContribuicaoR$, 9.62);
  // CMV % = 8.92 / 26 = 34.31%
  assert.equal(precIfood.cmvPct, 34.31);
  // Preço sugerido calculado
  assert.ok(precIfood.precoSugerido > 20);
});

test('3. Simulador de Vendas: 100 marmitas/dia, ponto de equilíbrio e resultado', () => {
  const marmitas = [
    { id: '1', nome: 'Marmita Tradicional', precoVenda: 22.0, custoAlimentos: 5.5, custoEmbalagens: 2.5, quantidadeDia: 30, taxaCanalPct: 10, taxaPagtoPct: 1.5, tributosPct: 6 },
    { id: '2', nome: 'Marmita Executiva', precoVenda: 28.0, custoAlimentos: 7.0, custoEmbalagens: 2.5, quantidadeDia: 40, taxaCanalPct: 12, taxaPagtoPct: 1.5, tributosPct: 6 },
    { id: '3', nome: 'Marmita Premium', precoVenda: 34.0, custoAlimentos: 9.5, custoEmbalagens: 2.8, quantidadeDia: 20, taxaCanalPct: 15, taxaPagtoPct: 1.5, tributosPct: 6 },
    { id: '4', nome: 'Marmita Fitness', precoVenda: 26.0, custoAlimentos: 6.8, custoEmbalagens: 2.5, quantidadeDia: 10, taxaCanalPct: 8, taxaPagtoPct: 1.5, tributosPct: 6 },
  ];

  const sim = simularOperacaoMarmitaria({
    marmitas,
    diasOperacaoMes: 26,
    cmoAlocadoMes: 4500, // 2 funcionários alocados na marmitaria
    custosFixosAlocadosMes: 2000, // rateio de aluguel/gás/luz
    metaLucroMes: 5000,
  });

  assert.equal(sim.quantidadeDiaria, 100);
  assert.equal(sim.quantidadeMensal, 2600);
  assert.ok(sim.faturamentoMensal > 60000);
  assert.ok(sim.margemContribuicaoMensal > 25000);
  assert.ok(sim.resultadoOperacionalMensal > 15000);
  assert.ok(sim.pontoEquilibrioQtdDia < 50); // Ponto de equilíbrio atingido bem antes de 100 marmitas/dia
});

test('4. Comparativo de Cenários: compara 20, 30, 50, 100, 150 e 200 marmitas/dia', () => {
  const marmitas = [
    { id: '1', nome: 'Marmita Padrão', precoVenda: 25.0, custoAlimentos: 6.0, custoEmbalagens: 2.5, quantidadeDia: 100, taxaCanalPct: 12, taxaPagtoPct: 1.5, tributosPct: 6 },
  ];

  const cenarios = compararCenariosEscala({
    marmitas,
    diasOperacaoMes: 26,
    cmoAlocadoMes: 4000,
    custosFixosAlocadosMes: 1500,
  });

  assert.equal(cenarios.length, 6);
  assert.equal(cenarios[0].cenarioMarmitasDia, 20);
  assert.equal(cenarios[5].cenarioMarmitasDia, 200);
  assert.ok(cenarios[5].resultadoOperacionalMes > cenarios[0].resultadoOperacionalMes);
});

test('5. Lista de Compras Inteligente: explode receitas e compara com estoque utilizável', () => {
  const planoVendas = [
    {
      quantidadePlanejada: 200,
      ficha: {
        fichas_ingredientes: [
          { insumo_id: 'ins-frango', nome: 'Peito de frango', quantidade: 0.15, unidade_medida: 'kg', fator_correcao: 1.2, perda_pct: 5, custo_unitario: 22.0 },
          { insumo_id: 'ins-arroz', nome: 'Arroz agulhinha', quantidade: 0.08, unidade_medida: 'kg', fator_correcao: 1.0, perda_pct: 0, custo_unitario: 5.5 },
        ],
        embalagens: [
          { embalagem_insumo_id: 'emb-pote', nome: 'Pote 500ml', quantidade: 1, custo_unitario: 1.10 },
        ],
      },
    },
  ];

  const estoquesAtuais = [
    { insumo_id: 'ins-frango', quantidade_atual: 10, quantidade_reservada: 2 }, // utilizável = 8 kg
    { insumo_id: 'ins-arroz', quantidade_atual: 50, quantidade_reservada: 0 }, // utilizável = 50 kg
    { insumo_id: 'emb-pote', quantidade_atual: 50, quantidade_reservada: 0 }, // utilizável = 50 un
  ];

  const compras = calcularNecessidadeComprasMarmitaria({
    planoVendas,
    estoquesAtuais,
    fornecedoresInsumos: {
      'ins-frango': { fornecedor_nome: 'Avícola Central', ultimo_preco: 22.0, qtd_minima_compra: 30 },
      'emb-pote': { fornecedor_nome: 'Embalagens Brasil', ultimo_preco: 1.10, qtd_minima_compra: 200 },
    },
  });

  assert.equal(compras.totalItensNecessarios, 3);
  // Frango necessário: 200 * 0.15 * 1.2 * 1.05 = 37.8 kg. Estoque disponível: 8 kg. Faltante: 29.8 kg. Mínimo compra: 30 kg.
  const itemFrango = compras.itensCompra.find((i) => i.insumoId === 'ins-frango');
  assert.equal(itemFrango.quantidadeComprar, 30);
  assert.ok(compras.custoTotalPrevisto > 0);
});

test('6. Rendimento Real: conversão limpeza -> cocção -> porções', () => {
  const rend = calcularRendimentoReal({
    pesoCompradoBrutoKg: 10,
    custoTotalComprado: 220.0,
    pesoAposLimpezaKg: 8.5,
    pesoAposCoccaoKg: 6.8,
    porcoesProduzidas: 45,
  });

  assert.equal(rend.perdaLimpezaPct, 15);
  assert.equal(rend.perdaCoccaoPct, 20);
  assert.equal(rend.rendimentoTotalPct, 68);
  assert.equal(rend.custoFinalPorPorcao, 4.89);
  assert.equal(rend.pesoMedioPorcaoG, 151.11);
});

test('7. Alocação de RH e CMO da Marmitaria', () => {
  const colaboradores = [
    { nome: 'Cozinheiro Marmitaria', tipo_alocacao: 'exclusivo', salario_base: 2200, encargos_provisoes: 800, beneficios: 400 },
    { nome: 'Auxiliar de Cozinha', tipo_alocacao: 'compartilhado', percentual_tempo: 50, salario_base: 1800, encargos_provisoes: 600, beneficios: 300 },
    { nome: 'Embalador Extra', tipo_alocacao: 'extra', percentual_tempo: 100, salario_base: 1200, encargos_provisoes: 0, beneficios: 150 },
  ];

  const cmo = calcularCmoAlocadoMarmitaria(colaboradores);

  // Exclusivo: 2200 + 800 + 400 = 3400 (100%)
  // Compartilhado: 1800 + 600 + 300 = 2700 * 50% = 1350
  // Extra: 1200 + 150 = 1350 (100%)
  // Total: 3400 + 1350 + 1350 = 6100
  assert.equal(cmo.cmoExclusivos, 3400);
  assert.equal(cmo.cmoCompartilhados, 1350);
  assert.equal(cmo.cmoExtras, 1350);
  assert.equal(cmo.cmoTotal, 6100);
});

test('8. DRE Gerencial da Marmitaria', () => {
  const dre = calcularDreGerencialMarmitaria({
    vendasCanais: { ifood: 40000, whatsapp: 18000, balcao: 6000 },
    tributos: 3840,
    cancelamentosEDescontos: 500,
    cmvAlimentos: 16000,
    cmvEmbalagens: 6400,
    taxasIfood: 6000,
    taxasMeiosPagamento: 600,
    subsidiosEntrega: 1200,
    cmoAlocado: 6100,
    despesasFixasDiretas: 1500,
    despesasRateadasCozinha: 1200,
    outrasReceitasDespesas: 0,
  });

  assert.equal(dre.receitaBruta, 64000);
  assert.equal(dre.receitaLiquida, 59660);
  assert.equal(dre.cmvTotal, 22400);
  assert.equal(dre.lucroBruto, 37260);
  assert.equal(dre.despesasVariaveis, 7800);
  assert.equal(dre.margemContribuicao, 29460);
  assert.equal(dre.despesasOperacionais, 8800);
  assert.equal(dre.resultadoOperacional, 20660);
  assert.equal(dre.resultadoFinal, 20660);
});

test('9. Planejamento Inteligente 360º: gera plano diário de vendas, CMV, equipe e capacidade', () => {
  const mix = [
    { nome: 'Marmita Tradicional', precoVenda: 24, custoAlimentos: 6.0, custoEmbalagens: 2.0, pctMix: 50, tempoPreparoMin: 1.5 },
    { nome: 'Marmita Executiva', precoVenda: 28, custoAlimentos: 7.5, custoEmbalagens: 2.0, pctMix: 50, tempoPreparoMin: 2.0 },
  ];
  const colaboradores = [
    { id: '1', nome: 'Chef Cozinha', salario_base: 2400, percentual_tempo: 100 },
    { id: '2', nome: 'Auxiliar Montagem', salario_base: 1800, percentual_tempo: 100 },
  ];

  const plano = gerarPlanoOperacionalCompleto({
    metaMarmitas: 120,
    mixProdutos: mix,
    colaboradoresAlocados: colaboradores,
    horasOperacaoDia: 6,
  });

  assert.equal(plano.metaTotal, 120);
  assert.ok(plano.faturamentoPrevisto > 3000);
  assert.ok(plano.cmvPrevistoTotal > 900);
  assert.ok(plano.pessoasNecessarias >= 1);
  assert.equal(plano.haSobrecarga, false);
});

test('10. Engenharia de Cardápio: classifica em Estrelas, Burros de Carga, Enigmas e Cães', () => {
  const produtos = [
    { nome: 'Executiva Frango', volumeVendido: 150, margemContribuicaoR$: 14.50 }, // Alta margem, Alto volume -> Estrela
    { nome: 'Básica Feijoada', volumeVendido: 140, margemContribuicaoR$: 7.20 },  // Baixa margem, Alto volume -> Burro de Carga
    { nome: 'Picanha Nobre', volumeVendido: 20, margemContribuicaoR$: 18.00 },   // Alta margem, Baixo volume -> Enigma
    { nome: 'Omelete Simples', volumeVendido: 15, margemContribuicaoR$: 5.00 },   // Baixa margem, Baixo volume -> Cão
  ];

  const classif = classificarEngenhariaCardapio(produtos);
  assert.equal(classif.totalEstrelas, 1);
  assert.equal(classif.totalBurrosDeCarga, 1);
  assert.equal(classif.totalEnigmas, 1);
  assert.equal(classif.totalCaes, 1);
});

test('11. Simulador de Combos: calcula margem faturada com desconto e frete subsidiado', () => {
  const combo = simularComboPromocional({
    itensCombo: [
      { nome: 'Marmita Executiva', precoAvulso: 26.0, custoTecnico: 8.5 },
      { nome: 'Coca-Cola Zero', precoAvulso: 6.0, custoTecnico: 2.2 },
      { nome: 'Pudim de Leite', precoAvulso: 8.0, custoTecnico: 2.0 },
    ],
    precoCombo: 34.0, // Avulso = 40.0
    cupomDescontoLoja: 4.0, // Fatura 30.0
    subsidioFreteLoja: 2.5,
    taxaCanalPct: 15.0,
    taxaPagamentoPct: 2.0,
    impostosPct: 6.0,
  });

  assert.equal(combo.valorAvulsoTotal, 40.0);
  assert.equal(combo.precoFaturado, 30.0);
  assert.equal(combo.custoTecnicoTotal, 12.7);
  assert.ok(combo.receitaLiquida > 18.0);
  assert.ok(combo.margemContribuicaoR$ > 0);
  assert.ok(combo.descontoOferecidoClienteR$ === 10.0);
});

test('12. Conciliação iFood: compara pedidos PDV x extrato oficial e aponta divergências', () => {
  const pdv = [
    { codigo_pedido: '1001', valor_bruto: 30.0, taxa_esperada: 15.0, valor_esperado: 25.5 },
    { codigo_pedido: '1002', valor_bruto: 50.0, taxa_esperada: 15.0, valor_esperado: 42.5 },
  ];
  const extrato = [
    { codigo_pedido: '1001', valor_bruto: 30.0, comissao_cobrada: 4.5, taxa_adquirente: 0.0, repasse_liquido: 25.5 },
    { codigo_pedido: '1002', valor_bruto: 50.0, comissao_cobrada: 12.0, taxa_adquirente: 0.0, repasse_liquido: 38.0 }, // cobraram mais comissao (divergente)
  ];

  const conc = conciliarExtratoIfoodLote({ pedidosPdv: pdv, extratoItens: extrato });
  assert.equal(conc.totalPedidosAnalisados, 2);
  assert.equal(conc.pedidosConciliados, 1);
  assert.equal(conc.pedidosDivergentes, 1);
  assert.equal(conc.diferencaConsolidada, -4.5);
});

test('13. Métricas de Qualidade: apura taxa de defeito operacional e custo de devoluções', () => {
  const ocorrencias = [
    { tipo: 'erro_montagem', custo_reembolso: 26.0, nota_avaliacao: 1 },
    { tipo: 'atraso', custo_reembolso: 10.0, nota_avaliacao: 3 },
  ];

  const qual = calcularMetricasQualidade({ ocorrencias, totalPedidos: 100 });
  assert.equal(qual.totalPedidos, 100);
  assert.equal(qual.totalOcorrencias, 2);
  assert.equal(qual.taxaDefeitoPct, 2.0);
  assert.equal(qual.custoTotalReembolsos, 36.0);
  assert.equal(qual.avaliacaoMedia, 2.0);
  assert.equal(qual.conformidadeOperacionalPct, 98.0);
});
