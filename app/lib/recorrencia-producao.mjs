/**
 * Módulo de Inteligência de Compras e Recorrência de Produções / Pré-Preparos.
 *
 * Calcula a taxa de consumo (burn-rate) de ingredientes brutos com base na
 * frequência histórica de produções/pré-preparos e determina alertas de
 * recompra preventiva com base nos dias de cobertura do estoque atual.
 */

export function parseData(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseIngredientesUsados(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Analisa as produções e gera alertas inteligentes de compras para insumos.
 *
 * @param {Array} producoes - Histórico de registros da tabela `producoes`
 * @param {Array} itensEstoque - Saldos atuais dos insumos/estoque (`insumos` ou `estoque_itens`)
 * @param {Array} fichas - Lista de fichas técnicas para vinculação de pré-preparos
 * @param {Object} opcoes - { diasAnalise: 30, margemSegurancaDias: 3 }
 */
export function calcularAlertasRecorrenciaProducao(producoes = [], itensEstoque = [], fichas = [], opcoes = {}) {
  const diasAnalise = Number(opcoes.diasAnalise) || 30;
  const margemSeguranca = Number(opcoes.margemSegurancaDias) || 3;
  const agora = new Date();
  const limiteData = new Date(agora.getTime() - diasAnalise * 24 * 60 * 60 * 1000);

  // 1. Filtrar produções recentes nos últimos X dias
  const producoesRecentes = (producoes || []).filter(p => {
    const dt = parseData(p.created_at || p.data_producao);
    return dt && dt >= limiteData;
  });

  if (!producoesRecentes.length && !fichas.length) {
    return { alertas: [], estatisticas: { totalAnalisados: 0, totalAlertas: 0 } };
  }

  // 2. Mapear consumo de cada ingrediente por produções/pré-preparos
  const consumoInsumos = new Map();

  for (const prod of producoesRecentes) {
    const ingUsados = parseIngredientesUsados(prod.ingredientes_usados);
    const nomePrePreparo = prod.prato_nome || "Pré-preparo";

    for (const ing of ingUsados) {
      const nomeInsumo = (ing.nome || ing.insumo_nome || "").trim();
      if (!nomeInsumo) continue;

      const key = (ing.estoque_id || ing.insumo_id || nomeInsumo).toLowerCase();
      const qtdUsada = Number(ing.qtd_usada ?? ing.quantidade ?? ing.qtd_ficha) || 0;
      if (qtdUsada <= 0) continue;

      if (!consumoInsumos.has(key)) {
        consumoInsumos.set(key, {
          key,
          nome: nomeInsumo,
          unidade: ing.unidade || "un",
          totalConsumido: 0,
          producoesCount: 0,
          prePreparos: new Map(),
        });
      }

      const item = consumoInsumos.get(key);
      item.totalConsumido += qtdUsada;
      item.producoesCount += 1;

      if (!item.prePreparos.has(nomePrePreparo)) {
        item.prePreparos.set(nomePrePreparo, { count: 0, qtdTotal: 0 });
      }
      const prepInfo = item.prePreparos.get(nomePrePreparo);
      prepInfo.count += 1;
      prepInfo.qtdTotal += qtdUsada;
    }
  }

  // 3. Cruzar com saldos atuais no estoque e calcular dias de cobertura
  const alertas = [];

  for (const [key, info] of consumoInsumos.entries()) {
    const itemEstoque = (itensEstoque || []).find(st => {
      const stKey = (st.insumo_id || st.id || "").toLowerCase();
      const stNome = (st.nome || st.insumo_nome || "").trim().toLowerCase();
      return stKey === key || stNome === info.nome.toLowerCase();
    });

    const saldoAtual = Number(itemEstoque?.quantidade_atual ?? itemEstoque?.saldo ?? 0);
    const unidadeMedida = itemEstoque?.unidade_medida || info.unidade || "un";
    const consumoDiario = info.totalConsumido / diasAnalise;

    if (consumoDiario <= 0) continue;

    const diasCobertura = saldoAtual / consumoDiario;
    const intervaloMedioProducao = diasAnalise / Math.max(1, info.producoesCount);

    if (diasCobertura <= margemSeguranca || saldoAtual < (consumoDiario * intervaloMedioProducao)) {
      const listaPrePreparos = Array.from(info.prePreparos.entries()).map(([nome, d]) => ({
        nome,
        frequenciaLotes: d.count,
        consumoTotal: d.qtdTotal,
      })).sort((a, b) => b.consumoTotal - a.consumoTotal);

      const principalPrePreparo = listaPrePreparos[0]?.nome || "Pré-preparos da Cozinha";
      const diasParaCobrir = Math.max(7, Math.ceil(intervaloMedioProducao * 2));
      const consumoNecessario = consumoDiario * diasParaCobrir;
      const qtdSugerida = Math.max(0, consumoNecessario - saldoAtual);
      const nivelUrgencia = diasCobertura <= 1.5 ? "critico" : "atencao";

      alertas.push({
        insumo_id: itemEstoque?.insumo_id || itemEstoque?.id || key,
        nome: info.nome,
        unidade_medida: unidadeMedida,
        saldo_atual: saldoAtual,
        consumo_diario: Math.round(consumoDiario * 1000) / 1000,
        dias_cobertura: Math.round(diasCobertura * 10) / 10,
        frequencia_dias: Math.round(intervaloMedioProducao * 10) / 10,
        total_producoes: info.producoesCount,
        principal_pre_preparo: principalPrePreparo,
        lista_pre_preparos: listaPrePreparos,
        qtd_sugerida_compra: Math.ceil(qtdSugerida * 100) / 100,
        nivel_urgencia: nivelUrgencia,
        custo_unitario: Number(itemEstoque?.custo_unitario ?? itemEstoque?.custo_compra) || 0,
      });
    }
  }

  alertas.sort((a, b) => {
    if (a.nivel_urgencia === "critico" && b.nivel_urgencia !== "critico") return -1;
    if (a.nivel_urgencia !== "critico" && b.nivel_urgencia === "critico") return 1;
    return a.dias_cobertura - b.dias_cobertura;
  });

  return {
    alertas,
    estatisticas: {
      totalAnalisados: consumoInsumos.size,
      totalAlertas: alertas.length,
      diasAnalise,
    },
  };
}
