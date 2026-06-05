// =============================================================================
// FOODERP — integracao_vendas.js
// Motor de integração de vendas: iFood + Saipos → Estoque em tempo real
//
// Fluxo completo:
//   Webhook iFood / Polling Saipos
//     → Validação do pedido
//     → Baixa de insumos no estoque
//     → Atualização do faturamento
//     → Disparo de alertas se estoque crítico
//     → Log de auditoria
// =============================================================================

"use strict";

const db = require("./banco_de_dados");

// ---------------------------------------------------------------------------
// ORIGENS DE VENDA suportadas
// ---------------------------------------------------------------------------
const ORIGENS = {
  IFOOD:        "ifood",
  SAIPOS_MESA:  "saipos_mesa",
  SAIPOS_BALCAO:"saipos_balcao",
  MANUAL:       "manual",
};

// Status possíveis de um pedido no pipeline
const STATUS_PEDIDO = {
  RECEBIDO:  "recebido",
  CONFIRMADO:"confirmado",
  PREPARO:   "preparo",
  PRONTO:    "pronto",
  ENTREGUE:  "entregue",
  CANCELADO: "cancelado",
};

// Log de pedidos processados na sessão
const pedidos_processados = [];

// Contadores em tempo real (substitui um Redis/cache em produção)
const contadores = {
  loja_1: { pedidos_hoje: 47, faturamento_hoje: 4138.00, cmv_hoje: 1298.40 },
  loja_2: { pedidos_hoje: 83, faturamento_hoje: 7320.50, cmv_hoje: 2319.00 },
  loja_3: { pedidos_hoje: 14, faturamento_hoje: 1240.00, cmv_hoje:  389.50 },
};

// ---------------------------------------------------------------------------
// 1. RECEBER PEDIDO (ponto de entrada do webhook/polling)
// ---------------------------------------------------------------------------

/**
 * Processa um pedido chegando do iFood ou Saipos.
 * Valida, abate estoque e atualiza métricas.
 *
 * @param {object} payload — Payload cru do webhook
 * @param {string} origem  — Ver ORIGENS
 * @returns {Promise<object>}
 */
async function receberPedido(payload, origem) {
  console.log(`\n[INTEGRAÇÃO] 📦 Pedido recebido via ${origem.toUpperCase()}`);

  // 1. Normaliza o payload para o formato interno
  const pedido = normalizarPayload(payload, origem);
  if (!pedido.valido) {
    console.error(`[INTEGRAÇÃO] ❌ Payload inválido: ${pedido.erro}`);
    return { sucesso: false, erro: pedido.erro };
  }

  console.log(`[INTEGRAÇÃO] ✔ Pedido normalizado — ID: ${pedido.id} | Loja: ${pedido.loja_id} | Prato: ${pedido.prato_id}`);

  // 2. Verifica se o prato existe no cardápio
  const prato = db.cardapio[pedido.prato_id];
  if (!prato) {
    return { sucesso: false, erro: `Prato '${pedido.prato_id}' não encontrado no cardápio.` };
  }

  // 3. Verifica disponibilidade de estoque antes de confirmar
  const checagem = verificarEstoqueParaPedido(prato, pedido.quantidade, pedido.loja_id);
  if (!checagem.disponivel) {
    console.warn(`[INTEGRAÇÃO] ⚠ Estoque insuficiente para pedido ${pedido.id}:`, checagem.faltando);
    await notificarFaltaDeEstoque(checagem.faltando, pedido.loja_id);
    // Em produção: pausa o prato no iFood/Saipos automaticamente
    return {
      sucesso: false,
      erro: "Estoque insuficiente",
      detalhes: checagem.faltando,
      acao: "Prato pausado automaticamente nos canais de venda.",
    };
  }

  // 4. Confirma o pedido e muda status para PREPARO
  pedido.status = STATUS_PEDIDO.CONFIRMADO;
  pedido.confirmado_em = new Date().toISOString();
  await sleep(60); // simula round-trip ao banco

  // 5. Baixa os insumos do estoque
  const baixas = await abaterEstoquePedido(prato, pedido.quantidade, pedido.loja_id);
  pedido.baixas_estoque = baixas.resultados;
  pedido.alertas_estoque = baixas.alertas;

  // 6. Atualiza contadores de faturamento e CMV
  atualizarContadores(pedido.loja_id, {
    valor: pedido.valor_total,
    cmv: prato.cmv_unitario * pedido.quantidade,
  });

  // 7. Adiciona ao log de vendas do banco
  db.vendas_recentes.unshift({
    id: pedido.id,
    loja_id: pedido.loja_id,
    origem,
    prato_id: pedido.prato_id,
    quantidade: pedido.quantidade,
    valor_total: pedido.valor_total,
    timestamp: pedido.criado_em,
    status: pedido.status,
  });

  // 8. Dispara alertas de estoque crítico (se houver)
  if (baixas.alertas.length > 0) {
    await processarAlertasEstoque(baixas.alertas, pedido.loja_id);
  }

  pedido.status = STATUS_PEDIDO.PREPARO;
  pedido.processado_em = new Date().toISOString();
  pedidos_processados.push(pedido);

  console.log(`[INTEGRAÇÃO] ✅ Pedido ${pedido.id} processado com sucesso — Status: ${pedido.status}`);
  if (baixas.alertas.length > 0) {
    console.warn(`[INTEGRAÇÃO] ⚠ ${baixas.alertas.length} alerta(s) de estoque gerado(s).`);
  }

  return { sucesso: true, pedido };
}

// ---------------------------------------------------------------------------
// 2. NORMALIZAR PAYLOAD
// ---------------------------------------------------------------------------

/**
 * Converte os diferentes formatos de webhook (iFood vs Saipos) para o
 * esquema interno do FoodERP.
 */
function normalizarPayload(payload, origem) {
  try {
    if (origem === ORIGENS.IFOOD) {
      // Esquema iFood Merchant API v3
      return {
        valido: true,
        id: `venda_${payload.id ?? Date.now()}`,
        origem,
        loja_id: payload.merchantId ? mapearMerchantParaLoja(payload.merchantId) : payload.loja_id,
        prato_id: payload.items?.[0]?.externalCode ?? payload.prato_id,
        quantidade: payload.items?.[0]?.quantity ?? payload.quantidade ?? 1,
        valor_total: payload.totalPrice ?? payload.valor_total ?? 0,
        cliente: payload.customer?.name ?? "Cliente iFood",
        endereco_entrega: payload.delivery?.deliveryAddress?.formattedAddress ?? null,
        criado_em: payload.createdAt ?? new Date().toISOString(),
        status: STATUS_PEDIDO.RECEBIDO,
        raw: payload,
      };
    }

    if (origem === ORIGENS.SAIPOS_MESA || origem === ORIGENS.SAIPOS_BALCAO) {
      // Esquema Saipos API v2
      return {
        valido: true,
        id: `venda_${payload.orderId ?? Date.now()}`,
        origem,
        loja_id: payload.loja_id ?? "loja_1",
        prato_id: payload.itemCode ?? payload.prato_id,
        quantidade: payload.qty ?? payload.quantidade ?? 1,
        valor_total: payload.totalAmount ?? payload.valor_total ?? 0,
        mesa: payload.tableNumber ?? null,
        garcom_id: payload.waiterId ?? null,
        criado_em: payload.timestamp ?? new Date().toISOString(),
        status: STATUS_PEDIDO.RECEBIDO,
        raw: payload,
      };
    }

    if (origem === ORIGENS.MANUAL) {
      // Entrada direta via painel ERP
      return { valido: true, id: `venda_${Date.now()}`, origem, status: STATUS_PEDIDO.RECEBIDO, ...payload };
    }

    return { valido: false, erro: `Origem desconhecida: ${origem}` };
  } catch (err) {
    return { valido: false, erro: `Erro ao normalizar payload: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 3. VERIFICAR ESTOQUE ANTES DE CONFIRMAR
// ---------------------------------------------------------------------------

function verificarEstoqueParaPedido(prato, quantidade, loja_id) {
  const faltando = [];

  for (const ingrediente of prato.insumos_necessarios) {
    const chave = `${ingrediente.insumo_id}_${loja_id}`;
    const item = db.insumos[chave];
    const necessario = ingrediente.quantidade * quantidade;

    if (!item) {
      faltando.push({ insumo_id: ingrediente.insumo_id, motivo: "Insumo não cadastrado para esta loja" });
    } else if (item.quantidade_atual < necessario) {
      faltando.push({
        insumo_id: ingrediente.insumo_id,
        nome: item.nome,
        necessario: +necessario.toFixed(3),
        disponivel: item.quantidade_atual,
        unidade: item.unidade,
      });
    }
  }

  return { disponivel: faltando.length === 0, faltando };
}

// ---------------------------------------------------------------------------
// 4. ABATER ESTOQUE DOS INSUMOS
// ---------------------------------------------------------------------------

async function abaterEstoquePedido(prato, quantidade, loja_id) {
  const resultados = [];
  const alertas = [];

  for (const ingrediente of prato.insumos_necessarios) {
    const qtd_necessaria = +(ingrediente.quantidade * quantidade).toFixed(4);
    const resultado = db.abaterEstoque(ingrediente.insumo_id, loja_id, qtd_necessaria);

    resultados.push({
      insumo_id: ingrediente.insumo_id,
      quantidade_baixada: qtd_necessaria,
      unidade: ingrediente.unidade,
      saldo_restante: resultado.saldo_restante,
      sucesso: resultado.sucesso,
    });

    if (resultado.alerta) {
      alertas.push(resultado.alerta);
    }

    console.log(
      `[ESTOQUE] ${resultado.sucesso ? "✔" : "✖"} ${ingrediente.insumo_id}: -${qtd_necessaria} ${ingrediente.unidade} → saldo: ${resultado.saldo_restante ?? "N/A"}`
    );

    await sleep(10); // simula I/O ao banco por insumo
  }

  return { resultados, alertas };
}

// ---------------------------------------------------------------------------
// 5. ATUALIZAR CONTADORES EM TEMPO REAL
// ---------------------------------------------------------------------------

function atualizarContadores(loja_id, { valor, cmv }) {
  if (!contadores[loja_id]) contadores[loja_id] = { pedidos_hoje: 0, faturamento_hoje: 0, cmv_hoje: 0 };

  contadores[loja_id].pedidos_hoje += 1;
  contadores[loja_id].faturamento_hoje = +(contadores[loja_id].faturamento_hoje + valor).toFixed(2);
  contadores[loja_id].cmv_hoje = +(contadores[loja_id].cmv_hoje + cmv).toFixed(2);

  // Atualiza também o faturamento mensal no banco de dados
  if (db.lojas[loja_id]) {
    db.lojas[loja_id].faturamento_mes_atual += valor;
    db.lojas[loja_id].pedidos_hoje = contadores[loja_id].pedidos_hoje;
  }

  console.log(`[CONTADORES] ${loja_id} → pedidos: ${contadores[loja_id].pedidos_hoje} | fat. hoje: R$ ${contadores[loja_id].faturamento_hoje.toFixed(2)} | CMV: ${calcularCMVPct(loja_id).toFixed(1)}%`);
}

function calcularCMVPct(loja_id) {
  const c = contadores[loja_id];
  if (!c || c.faturamento_hoje === 0) return 0;
  return (c.cmv_hoje / c.faturamento_hoje) * 100;
}

// ---------------------------------------------------------------------------
// 6. PROCESSAR ALERTAS DE ESTOQUE
// ---------------------------------------------------------------------------

async function processarAlertasEstoque(alertas, loja_id) {
  const loja = db.lojas[loja_id];
  const gerente = db.funcionarios[loja.gerente_id];

  for (const alerta of alertas) {
    console.warn(`[ALERTA ESTOQUE] 🔴 ${alerta.mensagem} — Loja: ${loja.nome}`);

    // Verifica se deve gerar pedido automático ao fornecedor
    const recomendacao = recomendarPedidoFornecedor(alerta, loja_id);
    if (recomendacao) {
      console.log(`[PEDIDO AUTO] 🛒 Sugestão gerada: ${recomendacao.mensagem}`);
    }

    // Notifica gerente via push
    console.log(`[NOTIFICAÇÃO] → ${gerente?.nome ?? "Gerente"} via push: ${alerta.mensagem}`);
  }
}

async function notificarFaltaDeEstoque(itens, loja_id) {
  const loja = db.lojas[loja_id];
  itens.forEach((item) => {
    console.warn(`[SEM ESTOQUE] Prato pausado na ${loja.nome} — falta de: ${item.nome ?? item.insumo_id}`);
  });
}

// ---------------------------------------------------------------------------
// 7. RECOMENDAÇÃO AUTOMÁTICA DE PEDIDO AO FORNECEDOR
// ---------------------------------------------------------------------------

function recomendarPedidoFornecedor(alerta, loja_id) {
  // Encontra o insumo no banco pelo nome
  const item = Object.values(db.insumos).find(
    (i) => i.loja_id === loja_id && i.status === alerta.nivel
  );
  if (!item) return null;

  const fornecedor = db.fornecedores[item.fornecedor_id];
  if (!fornecedor) return null;

  const quantidade_sugerida = item.quantidade_maxima - item.quantidade_atual;
  const custo_estimado = +(quantidade_sugerida * item.custo_unitario).toFixed(2);
  const entrega_prevista = new Date(Date.now() + fornecedor.prazo_entrega_horas * 3600000)
    .toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return {
    insumo: item.nome,
    fornecedor: fornecedor.nome,
    quantidade_sugerida: `${quantidade_sugerida} ${item.unidade}`,
    custo_estimado: `R$ ${custo_estimado.toLocaleString("pt-BR")}`,
    entrega_prevista,
    mensagem: `Pedir ${quantidade_sugerida} ${item.unidade} de "${item.nome}" para ${fornecedor.nome} — entrega prevista: ${entrega_prevista}`,
  };
}

// ---------------------------------------------------------------------------
// 8. CONSULTAS ANALÍTICAS
// ---------------------------------------------------------------------------

/**
 * Retorna métricas em tempo real de todas as lojas.
 */
function getDashboardTempoReal(loja_id_filtro) {
  const ids = loja_id_filtro ? [loja_id_filtro] : Object.keys(contadores);
  const lista = ids
    .filter(id => contadores[id] || db.lojas[id])
    .map((loja_id) => {
      const c = contadores[loja_id] || { pedidos_hoje: 0, faturamento_hoje: 0, cmv_hoje: 0 };
      const loja = db.lojas[loja_id];
      const alertasEstoque = db.getAlertasEstoque().filter((a) => a.loja_id === loja_id);
      // Sync faturamento_hoje de volta ao db.lojas
      if (loja) {
        loja.faturamento_hoje = c.faturamento_hoje;
        loja.pedidos_hoje = c.pedidos_hoje;
        loja.cmv_pct_hoje = +calcularCMVPct(loja_id).toFixed(1);
      }
      return {
        loja_id,
        nome: loja?.nome ?? loja_id,
        pedidos_hoje: c.pedidos_hoje,
        faturamento_hoje: c.faturamento_hoje,
        cmv_hoje_pct: +calcularCMVPct(loja_id).toFixed(1),
        cmv_status: calcularCMVPct(loja_id) > db.config.alertas.cmv_alerta_pct ? "alerta" : "ok",
        alertas_estoque: alertasEstoque.length,
        itens_criticos: alertasEstoque.filter((a) => a.status === "critico").length,
      };
    });
  return loja_id_filtro ? (lista[0] || null) : lista;
}

/**
 * Retorna os pratos mais vendidos no dia, calculado a partir do log de vendas.
 */
function getPratosMaisVendidosHoje(loja_id) {
  const vendas = db.vendas_recentes.filter(
    (v) => v.loja_id === loja_id && v.status !== STATUS_PEDIDO.CANCELADO
  );
  const contagem = {};
  vendas.forEach((v) => {
    contagem[v.prato_id] = (contagem[v.prato_id] ?? 0) + (v.quantidade ?? 1);
  });
  return Object.entries(contagem)
    .sort(([, a], [, b]) => b - a)
    .map(([prato_id, total]) => ({
      prato_id,
      nome: db.cardapio[prato_id]?.nome ?? prato_id,
      total_pedidos: total,
      faturamento: +(total * (db.cardapio[prato_id]?.preco ?? 0)).toFixed(2),
    }));
}

/**
 * Simula o pipeline de entrada de pedidos (para demo/teste).
 * Gera pedidos aleatórios a cada intervalo e processa em fila.
 */
function iniciarSimulacaoTempoReal(loja_id, intervalo_ms = 8000) {
  const pratos = Object.keys(db.cardapio);
  const origens = [ORIGENS.IFOOD, ORIGENS.SAIPOS_MESA, ORIGENS.SAIPOS_BALCAO];

  console.log(`\n[SIMULAÇÃO] ▶ Iniciando stream de pedidos para ${loja_id} (intervalo: ${intervalo_ms}ms)\n`);

  const timer = setInterval(async () => {
    const prato_id = pratos[Math.floor(Math.random() * pratos.length)];
    const origem = origens[Math.floor(Math.random() * origens.length)];
    const quantidade = Math.floor(Math.random() * 3) + 1;

    const prato = db.cardapio[prato_id];
    const payload = {
      loja_id,
      prato_id,
      quantidade,
      valor_total: +(prato.preco * quantidade).toFixed(2),
      criado_em: new Date().toISOString(),
    };

    await receberPedido(payload, origem);
  }, intervalo_ms);

  // Retorna função para parar a simulação
  return () => {
    clearInterval(timer);
    console.log("[SIMULAÇÃO] ■ Stream de pedidos encerrado.");
  };
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------------------------

function mapearMerchantParaLoja(merchantId) {
  const mapa = {
    "merchant_centro":   "loja_1",
    "merchant_shopping": "loja_2",
    "merchant_norte":    "loja_3",
  };
  return mapa[merchantId] ?? "loja_1";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// PROCESSAMENTO EXTERNO (alias para compatibilidade com server.js)
// ---------------------------------------------------------------------------

/**
 * Alias de receberPedido para chamadas externas via API REST.
 * Aceita { payload, origem } ou { loja_id, prato_id, quantidade, valor_total, origem }
 */
async function processarPedidoExterno({ payload, origem, loja_id, prato_id, quantidade, valor_total }) {
  const p = payload || { loja_id, prato_id, quantidade, valor_total, criado_em: new Date().toISOString() };
  const o = origem || ORIGENS.MANUAL;
  return receberPedido(p, o);
}

// ---------------------------------------------------------------------------
// EXPORTAÇÕES
// ---------------------------------------------------------------------------
module.exports = {
  ORIGENS,
  STATUS_PEDIDO,
  receberPedido,
  normalizarPayload,
  verificarEstoqueParaPedido,
  atualizarContadores,
  getDashboardTempoReal,
  getPratosMaisVendidosHoje,
  recomendarPedidoFornecedor,
  iniciarSimulacaoTempoReal,
  pedidos_processados,
  contadores,
  processarPedidoExterno,
  getPratosMaisVendidos: getPratosMaisVendidosHoje,
};

// ---------------------------------------------------------------------------
// DEMO — executa ao rodar `node integracao_vendas.js` diretamente
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    console.log("=== FoodERP — Integração de Vendas (demo) ===\n");

    // Simula pedido do iFood
    console.log("── Pedido 1: iFood ──────────────────────────────");
    await receberPedido({
      loja_id: "loja_1",
      prato_id: "prato_001",
      quantidade: 2,
      valor_total: 69.80,
      criado_em: new Date().toISOString(),
    }, ORIGENS.IFOOD);

    // Simula pedido do Saipos (mesa)
    console.log("\n── Pedido 2: Saipos Mesa ────────────────────────");
    await receberPedido({
      loja_id: "loja_1",
      prato_id: "prato_002",
      quantidade: 1,
      valor_total: 42.00,
      mesa: "07",
      garcom_id: "func_001",
      criado_em: new Date().toISOString(),
    }, ORIGENS.SAIPOS_MESA);

    // Exibe dashboard em tempo real
    console.log("\n── Dashboard em tempo real ─────────────────────");
    console.log(JSON.stringify(getDashboardTempoReal(), null, 2));

    // Pratos mais vendidos
    console.log("\n── Pratos mais vendidos hoje (Loja 1) ──────────");
    console.log(getPratosMaisVendidosHoje("loja_1"));

    // Inicia simulação por 20s (3 pedidos automáticos)
    console.log("\n── Simulação automática (20s) ───────────────────");
    const parar = iniciarSimulacaoTempoReal("loja_1", 6000);
    setTimeout(() => {
      parar();
      console.log("\n── Resumo final dos pedidos processados ─────────");
      console.log(`Total processado: ${pedidos_processados.length} pedidos`);
      console.log("Contadores finais:", contadores);
    }, 20000);
  })();
}
