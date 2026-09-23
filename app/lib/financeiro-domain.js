// ─── DOMÍNIO & REGRAS DE NEGÓCIO FINANCEIRAS (HÉFISTO ERP) ──────────────────

/**
 * Divide um valor total em N parcelas exatas, ajustando os centavos de arredondamento na última parcela.
 * Exemplo: R$ 100,00 / 3 -> [R$ 33,33, R$ 33,33, R$ 33,34]
 */
export function dividirParcelasExatas(valorTotal, numParcelas, primeiroVencimentoIso) {
  const total = Number(valorTotal) || 0;
  const n = Math.max(1, parseInt(numParcelas) || 1);
  if (total <= 0) return [];

  const baseCentavos = Math.floor((total * 100) / n);
  const sobraCentavos = Math.round(total * 100) - (baseCentavos * n);

  const parcelas = [];
  const baseData = primeiroVencimentoIso ? new Date(`${primeiroVencimentoIso}T12:00:00`) : new Date();

  for (let i = 1; i <= n; i++) {
    // Ajusta os centavos restantes na última parcela
    const centavos = i === n ? baseCentavos + sobraCentavos : baseCentavos;
    const valorParcela = centavos / 100;

    const dataVenc = new Date(baseData);
    dataVenc.setMonth(baseData.getMonth() + (i - 1));

    const ano = dataVenc.getFullYear();
    const mes = String(dataVenc.getMonth() + 1).padStart(2, "0");
    const dia = String(dataVenc.getDate()).padStart(2, "0");

    parcelas.push({
      parcela_numero: i,
      total_parcelas: n,
      valor: valorParcela,
      valor_original: valorParcela,
      saldo: valorParcela,
      valor_pago: 0,
      data_vencimento: `${ano}-${mes}-${dia}`,
      status: "PENDENTE"
    });
  }

  return parcelas;
}

/**
 * Calcula o status padronizado de uma conta a pagar de acordo com saldo e vencimento.
 */
export function calcularStatusConta(conta, dataHojeIso = null) {
  const statusAtual = String(conta?.status || "").toUpperCase();
  if (statusAtual === "CANCELADA" || statusAtual === "CANCELADO") return "CANCELADA";

  const valorOrig = Number(conta?.valor_original ?? conta?.valor) || 0;
  const valorPago = Number(conta?.valor_pago) || 0;
  const saldo = Number(conta?.saldo !== undefined ? conta.saldo : (valorOrig - valorPago));

  if (saldo <= 0.001 || statusAtual === "PAGA" || statusAtual === "PAGO") {
    return "PAGA";
  }

  if (valorPago > 0.001) {
    return "PARCIALMENTE PAGA";
  }

  // Verificar Vencimento
  const hojeStr = dataHojeIso || new Date().toISOString().slice(0, 10);
  const vencStr = String(conta?.data_vencimento || "").slice(0, 10);

  if (!vencStr) return "PENDENTE";

  if (vencStr < hojeStr) {
    return "VENCIDA";
  }

  // Vencendo nos próximos 3 dias
  const hoje = new Date(`${hojeStr}T00:00:00`);
  const venc = new Date(`${vencStr}T00:00:00`);
  const diffDias = Math.round((venc - hoje) / 86400000);

  if (diffDias >= 0 && diffDias <= 3) {
    return "VENCENDO";
  }

  return "PENDENTE";
}

/**
 * Calcula o valor líquido efetivo de saída bancária e o saldo restante da obrigação.
 */
export function calcularValoresPagamento(valorOriginal, valorPagoAnterior, valorPagamentoAtual, juros = 0, multa = 0, desconto = 0) {
  const orig = Number(valorOriginal) || 0;
  const ant = Number(valorPagoAnterior) || 0;
  const pag = Number(valorPagamentoAtual) || 0;
  const j = Number(juros) || 0;
  const m = Number(multa) || 0;
  const d = Number(desconto) || 0;

  const novoValorPago = ant + pag;
  const saldoRestante = Math.max(0, orig - novoValorPago);
  const valorSaidaEfetiva = pag + j + m - d;

  const novoStatus = saldoRestante <= 0.001 ? "PAGA" : "PARCIALMENTE PAGA";

  return {
    novoValorPago,
    saldoRestante,
    valorSaidaEfetiva,
    novoStatus
  };
}

/**
 * Monta o Demonstrativo de Resultados do Exercício (DRE Gerencial por Regime de Competência).
 * Regra Anti-Duplicidade: Compras de estoque não são somadas como despesa operacional direta
 * quando o CMV já reconhece o custo das mercadorias consumidas.
 */
export function montarDREGerencial({
  faturamentoTotal = 0,
  despesasContasPagar = [],
  cmoTotal = 0,
  cmvRealizado = 0,
  impostosVendas = 0,
  taxasCartao = 0
}) {
  const receitaBruta = Number(faturamentoTotal) || 0;
  const impostos = Number(impostosVendas) || 0;
  const taxas = Number(taxasCartao) || 0;

  const receitaLiquida = receitaBruta - impostos - taxas;
  const cmv = Number(cmvRealizado) || 0;
  const lucroBruto = receitaLiquida - cmv;

  // Filtrar despesas operacionais por categoria (ignorando 'cmv' e 'cmo' para evitar dupla contagem)
  const categoriasDespesas = {};
  let totalDespesasOperacionais = 0;

  despesasContasPagar.forEach(conta => {
    const cat = String(conta.categoria || "Outras despesas").toLowerCase();
    const st = calcularStatusConta(conta);

    // Na DRE por Competência, consideram-se contas ativas (não canceladas)
    if (st === "CANCELADA") return;
    if (cat === "cmv" || cat === "cmo") return; // CMV e CMO são calculados pelo motor próprio

    const val = Number(conta.valor_original ?? conta.valor) || 0;
    categoriasDespesas[conta.categoria] = (categoriasDespesas[conta.categoria] || 0) + val;
    totalDespesasOperacionais += val;
  });

  const cmo = Number(cmoTotal) || 0;
  const resultadoOperacional = lucroBruto - cmo - totalDespesasOperacionais;
  const margemOperacionalPct = receitaBruta > 0 ? (resultadoOperacional / receitaBruta) * 100 : 0;

  return {
    receitaBruta,
    impostos,
    taxas,
    receitaLiquida,
    cmv,
    lucroBruto,
    cmo,
    despesasOperacionais: totalDespesasOperacionais,
    categoriasDespesas,
    resultadoOperacional,
    margemOperacionalPct: Number(margemOperacionalPct.toFixed(2))
  };
}

/**
 * Monta o Fluxo de Caixa (Visão Previsto vs Realizado no Regime de Caixa).
 */
export function montarFluxoCaixaPrevistoERealizado(contas = [], lancamentos = [], contasFinanceiras = []) {
  const saldoContasBancarias = contasFinanceiras.reduce((s, c) => s + Number(c.saldo_atual || 0), 0);

  let entradasRealizadas = 0;
  let saidasRealizadas = 0;
  let entradasPrevistas = 0;
  let saidasPrevistas = 0;

  // Realizados no extrato bancário
  lancamentos.forEach(l => {
    const v = Number(l.valor) || 0;
    if (l.tipo === "entrada") entradasRealizadas += v;
    else if (l.tipo === "saida") saidasRealizadas += v;
  });

  // Previstos em contas a pagar
  contas.forEach(c => {
    const st = calcularStatusConta(c);
    if (st === "CANCELADA" || st === "PAGA") return;
    const saldoPendente = Number(c.saldo !== undefined ? c.saldo : (Number(c.valor) - Number(c.valor_pago || 0)));
    if (saldoPendente > 0) {
      saidasPrevistas += saldoPendente;
    }
  });

  const saldoRealizadoAtual = entradasRealizadas - saidasRealizadas;
  const saldoProjetado = saldoContasBancarias + entradasPrevistas - saidasPrevistas;

  return {
    saldoContasBancarias,
    entradasRealizadas,
    saidasRealizadas,
    saldoRealizadoAtual,
    entradasPrevistas,
    saidasPrevistas,
    saldoProjetado
  };
}
