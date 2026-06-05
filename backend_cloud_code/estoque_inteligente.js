// =============================================================================
// FOODERP — estoque_inteligente.js
// Módulo 1: Estoque Inteligente e Centralizado
// 5 Superpoderes: Ficha Técnica · KDS/Produção · Ordens de Compra ·
//                 Lotes/Validade · Análise de Desperdício + Previsão
// =============================================================================
"use strict";

const db = require("./banco_de_dados");

// ─────────────────────────────────────────────────────────────────────────────
// SUPERPOWER 1 — FICHAS TÉCNICAS E ENGENHARIA DE CARDÁPIO
// ─────────────────────────────────────────────────────────────────────────────

// Fichas técnicas estendem o cardápio existente com dados mais ricos
// Chave: prato_id (pode ser do cardapio existente ou novo)
const _fichas_tecnicas = {};
let _prato_counter = 100;

// Inicializa fichas técnicas a partir do cardápio existente

// [CLEAN SLATE — seed block removido]
/**
 * Calcula CMV real de uma ficha a partir dos custos atuais dos insumos.
 * Usa o custo_unitario do primeiro loja que tiver aquele insumo.
 */
function calcularCMVFicha(ingredientes) {
  let cmv = 0;
  const detalhes = [];
  for (const ing of ingredientes) {
    // Tenta encontrar custo em qualquer loja
    const chaves = Object.keys(db.insumos).filter(k => k.startsWith(ing.insumo_id + "_"));
    const insumo = chaves.length ? db.insumos[chaves[0]] : null;
    const custo_unit = insumo ? insumo.custo_unitario : 0;
    const subtotal = +(custo_unit * ing.quantidade).toFixed(4);
    cmv += subtotal;
    detalhes.push({
      insumo_id: ing.insumo_id,
      nome: insumo ? insumo.nome : ing.insumo_id,
      quantidade: ing.quantidade,
      unidade: ing.unidade,
      custo_unitario: custo_unit,
      subtotal,
    });
  }
  return { cmv: +cmv.toFixed(2), detalhes };
}

function enriquecerFicha(ficha) {
  const { cmv, detalhes } = calcularCMVFicha(ficha.ingredientes);
  const margem = ficha.preco_venda > 0
    ? +(((ficha.preco_venda - cmv) / ficha.preco_venda) * 100).toFixed(1)
    : 0;
  const markup = cmv > 0 ? +(ficha.preco_venda / cmv).toFixed(2) : 0;
  return {
    ...ficha,
    cmv_calculado: cmv,
    margem_pct: margem,
    markup,
    lucro_bruto: +(ficha.preco_venda - cmv).toFixed(2),
    detalhes_custo: detalhes,
    classificacao_engenharia: classificarPrato(margem, null), // popularity TBD
  };
}

function classificarPrato(margem_pct, popularidade_rank) {
  // Engenharia de cardápio: Estrela / Cavalo de Batalho / Quebra-Cabeça / Cão
  const alta_margem = margem_pct >= 65;
  // Sem dados de popularidade real, usamos margem como proxy
  if (alta_margem) return { classe: "Estrela", cor: "#22c55e", descricao: "Alta margem — promover ativamente" };
  if (margem_pct >= 50) return { classe: "Cavalo de Batalho", cor: "#3b82f6", descricao: "Volume alto, margem média — otimizar custo" };
  if (margem_pct >= 35) return { classe: "Quebra-Cabeça", cor: "#f59e0b", descricao: "Alta margem, baixa saída — reposicionar no menu" };
  return { classe: "Cão", cor: "#ef4444", descricao: "Baixa margem e baixa saída — revisar ou remover" };
}

function listarFichasTecnicas(loja_id) {
  const fichas = Object.values(_fichas_tecnicas)
    .filter(f => !loja_id || f.lojas_disponiveis.includes(loja_id))
    .map(enriquecerFicha);
  return fichas;
}

function getFichaTecnica(prato_id) {
  const f = _fichas_tecnicas[prato_id];
  if (!f) return null;
  return enriquecerFicha(f);
}

function criarFichaTecnica({ nome, categoria, preco_venda, ingredientes, tempo_preparo_min = 15,
  rendimento_porcoes = 1, modo_preparo = "", lojas_disponiveis }) {
  const id = `prato_${Date.now()}_${++_prato_counter}`;
  const ficha = {
    prato_id: id,
    nome,
    categoria: categoria || "Prato principal",
    preco_venda: +preco_venda,
    disponivel: true,
    tempo_preparo_min,
    rendimento_porcoes,
    modo_preparo,
    ingredientes: ingredientes || [],
    lojas_disponiveis: lojas_disponiveis || ["loja_1", "loja_2", "loja_3"],
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };
  _fichas_tecnicas[id] = ficha;

  // Sincroniza com o cardápio do banco
  db.cardapio[id] = {
    id,
    nome,
    preco: +preco_venda,
    categoria: ficha.categoria,
    disponivel: true,
    insumos_necessarios: ingredientes.map(i => ({ insumo_id: i.insumo_id, quantidade: i.quantidade, unidade: i.unidade })),
    cmv_unitario: calcularCMVFicha(ingredientes).cmv,
    tempo_preparo_min,
  };

  return enriquecerFicha(ficha);
}

function atualizarFichaTecnica(prato_id, dados) {
  const ficha = _fichas_tecnicas[prato_id];
  if (!ficha) return null;
  Object.assign(ficha, dados, { atualizado_em: new Date().toISOString() });
  // Ressincroniza cardápio
  if (db.cardapio[prato_id]) {
    if (dados.preco_venda) db.cardapio[prato_id].preco = dados.preco_venda;
    if (dados.ingredientes) {
      db.cardapio[prato_id].insumos_necessarios = dados.ingredientes.map(i => ({
        insumo_id: i.insumo_id, quantidade: i.quantidade, unidade: i.unidade
      }));
      db.cardapio[prato_id].cmv_unitario = calcularCMVFicha(dados.ingredientes).cmv;
    }
  }
  return enriquecerFicha(ficha);
}

function excluirFichaTecnica(prato_id) {
  if (!_fichas_tecnicas[prato_id]) return false;
  delete _fichas_tecnicas[prato_id];
  delete db.cardapio[prato_id];
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERPOWER 2 — KDS / PRODUÇÃO DO DIA
// ─────────────────────────────────────────────────────────────────────────────

// Histórico simulado de vendas por prato/dia da semana (7 dias × 3 lojas)
// Estrutura: _historico_vendas[loja_id][prato_id][dia_semana] = qtd_media
const _historico_vendas = {
  loja_1: {
    prato_001: [28, 45, 42, 40, 38, 55, 60], // dom-sab
    prato_002: [15, 22, 20, 24, 22, 35, 40],
    prato_003: [35, 50, 48, 52, 45, 65, 70],
  },
  loja_2: {
    prato_001: [40, 65, 60, 58, 55, 80, 85],
    prato_002: [20, 30, 28, 32, 30, 45, 50],
    prato_003: [50, 70, 68, 72, 65, 90, 95],
  },
  loja_3: {
    prato_001: [10, 15, 14, 16, 14, 22, 25],
    prato_002: [8,  12, 11, 13, 12, 18, 20],
    prato_003: [12, 18, 17, 19, 16, 26, 28],
  },
};

// Pedidos KDS em fila (tempo real)
const _kds_fila = {}; // loja_id → [{ id, prato_id, prato_nome, quantidade, status, ts, tempo_preparo_min }]

function getProducaoDia(loja_id, data_str) {
  const data = data_str ? new Date(data_str) : new Date();
  const diaSemana = data.getDay(); // 0=dom, 6=sab
  const historico = _historico_vendas[loja_id] || {};
  const loja = db.lojas[loja_id];
  if (!loja) return null;

  const resultado = [];
  const fichas = Object.values(_fichas_tecnicas).filter(f => f.lojas_disponiveis.includes(loja_id));

  for (const ficha of fichas) {
    const hist = historico[ficha.prato_id] || [0,0,0,0,0,0,0];
    const media_7d = +(hist.reduce((a,b) => a+b, 0) / 7).toFixed(0);
    const previsao_dia = hist[diaSemana];
    const qtd_produzir = Math.ceil(previsao_dia * 1.2); // +20% buffer anti-ruptura
    const { cmv } = calcularCMVFicha(ficha.ingredientes);

    // Verifica se há insumos suficientes para essa produção
    const alertas_insumos = [];
    for (const ing of ficha.ingredientes) {
      const chave = `${ing.insumo_id}_${loja_id}`;
      const estoque = db.insumos[chave];
      if (!estoque) {
        alertas_insumos.push({ insumo_id: ing.insumo_id, problema: "Insumo não cadastrado nesta unidade" });
        continue;
      }
      const necessario = +(ing.quantidade * qtd_produzir).toFixed(2);
      if (estoque.quantidade_atual < necessario) {
        const max_possivel = Math.floor(estoque.quantidade_atual / ing.quantidade);
        alertas_insumos.push({
          insumo_id: ing.insumo_id,
          nome: estoque.nome,
          necessario,
          disponivel: estoque.quantidade_atual,
          unidade: ing.unidade,
          max_possivel_com_estoque: max_possivel,
        });
      }
    }

    resultado.push({
      prato_id: ficha.prato_id,
      nome: ficha.nome,
      categoria: ficha.categoria,
      media_7d,
      previsao_dia,
      qtd_produzir,
      cmv_total_previsto: +(cmv * qtd_produzir).toFixed(2),
      faturamento_previsto: +(ficha.preco_venda * qtd_produzir).toFixed(2),
      tempo_total_preparo_min: ficha.tempo_preparo_min * Math.ceil(qtd_produzir / 5), // 5 simultâneos
      alertas_insumos,
      status: alertas_insumos.length > 0 ? "atencao" : "ok",
    });
  }

  // Ordena por status (atencao primeiro) depois por qtd_produzir desc
  resultado.sort((a, b) => {
    if (a.status !== b.status) return a.status === "atencao" ? -1 : 1;
    return b.qtd_produzir - a.qtd_produzir;
  });

  const totais = {
    faturamento_previsto: resultado.reduce((s,r) => s + r.faturamento_previsto, 0).toFixed(2),
    cmv_previsto: resultado.reduce((s,r) => s + r.cmv_total_previsto, 0).toFixed(2),
    pratos_com_alerta: resultado.filter(r => r.alertas_insumos.length > 0).length,
  };

  return { loja_id, loja_nome: loja.nome, data: data.toISOString().split("T")[0],
           dia_semana: ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][diaSemana],
           producao: resultado, totais };
}

// KDS em tempo real — registrar pedido na fila
let _kds_counter = 1;
function registrarPedidoKDS({ loja_id, prato_id, quantidade = 1, mesa = null, origem = "local" }) {
  if (!_kds_fila[loja_id]) _kds_fila[loja_id] = [];
  const ficha = _fichas_tecnicas[prato_id] || db.cardapio[prato_id];
  const pedido = {
    id: `kds_${Date.now()}_${_kds_counter++}`,
    loja_id, prato_id,
    prato_nome: ficha ? ficha.nome : prato_id,
    quantidade, mesa, origem,
    status: "aguardando", // aguardando → preparo → pronto → entregue
    ts: new Date().toISOString(),
    tempo_preparo_min: ficha ? (ficha.tempo_preparo_min || 15) : 15,
    iniciado_em: null,
    pronto_em: null,
  };
  _kds_fila[loja_id].push(pedido);
  return pedido;
}

function getFilaKDS(loja_id) {
  const fila = (_kds_fila[loja_id] || []).filter(p => p.status !== "entregue");
  return fila.sort((a,b) => new Date(a.ts) - new Date(b.ts));
}

function atualizarStatusKDS(pedido_id, loja_id, novo_status) {
  const fila = _kds_fila[loja_id] || [];
  const p = fila.find(x => x.id === pedido_id);
  if (!p) return null;
  p.status = novo_status;
  if (novo_status === "preparo") p.iniciado_em = new Date().toISOString();
  if (novo_status === "pronto")  p.pronto_em   = new Date().toISOString();
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERPOWER 3 — ORDENS DE COMPRA INTELIGENTES
// ─────────────────────────────────────────────────────────────────────────────

const _ordens_compra = [];
let _oc_counter = 1;

function gerarOrdemCompra(loja_id) {
  // Agrupa insumos abaixo do mínimo por fornecedor
  const insumos_loja = loja_id
    ? Object.values(db.insumos).filter(i => i.loja_id === loja_id)
    : Object.values(db.insumos);

  const por_fornecedor = {};

  for (const ins of insumos_loja) {
    if (ins.quantidade_atual >= ins.quantidade_minima) continue; // ok, não comprar

    const forn = db.fornecedores[ins.fornecedor_id];
    if (!forn) continue;

    // Quantidade a comprar: atingir o máximo (reposição completa)
    const qtd_comprar = +(ins.quantidade_maxima - ins.quantidade_atual).toFixed(2);
    // Arredonda para cima no múltiplo de consumo diário (pedido semanal)
    const qtd_semanal = Math.ceil(ins.consumo_medio_diario * 7);
    const qtd_final = Math.max(qtd_comprar, qtd_semanal);
    const custo_total = +(qtd_final * ins.custo_unitario).toFixed(2);

    const forn_id = ins.fornecedor_id;
    if (!por_fornecedor[forn_id]) {
      por_fornecedor[forn_id] = {
        fornecedor_id: forn_id,
        fornecedor_nome: forn.nome,
        contato: forn.contato,
        email: forn.email,
        prazo_entrega_horas: forn.prazo_entrega_horas,
        avaliacao: forn.avaliacao,
        itens: [],
        custo_total: 0,
        urgencia: "normal", // normal | urgente | critico
      };
    }

    const urgencia = ins.quantidade_atual === 0 ? "critico"
      : ins.quantidade_atual < ins.quantidade_minima * 0.5 ? "urgente" : "normal";

    por_fornecedor[forn_id].itens.push({
      insumo_id: ins.insumo_id,
      nome: ins.nome,
      loja_id: ins.loja_id,
      loja_nome: db.lojas[ins.loja_id]?.nome || ins.loja_id,
      quantidade_atual: ins.quantidade_atual,
      quantidade_minima: ins.quantidade_minima,
      quantidade_maxima: ins.quantidade_maxima,
      qtd_comprar: qtd_final,
      unidade: ins.unidade,
      custo_unitario: ins.custo_unitario,
      custo_total,
      urgencia,
      consumo_medio_diario: ins.consumo_medio_diario,
      dias_restantes: ins.consumo_medio_diario > 0
        ? +(ins.quantidade_atual / ins.consumo_medio_diario).toFixed(1) : 999,
    });

    por_fornecedor[forn_id].custo_total = +(por_fornecedor[forn_id].custo_total + custo_total).toFixed(2);

    // Urgência do pedido = a mais crítica dos itens
    const niveis = ["normal", "urgente", "critico"];
    const idx_atual = niveis.indexOf(por_fornecedor[forn_id].urgencia);
    const idx_novo  = niveis.indexOf(urgencia);
    if (idx_novo > idx_atual) por_fornecedor[forn_id].urgencia = urgencia;
  }

  const pedidos = Object.values(por_fornecedor);
  if (pedidos.length === 0) return { sem_pendencias: true, mensagem: "Todos os estoques estão dentro dos limites.", pedidos: [] };

  // Ordena por urgência
  const ordem_urgencia = { critico: 0, urgente: 1, normal: 2 };
  pedidos.sort((a,b) => ordem_urgencia[a.urgencia] - ordem_urgencia[b.urgencia]);

  const oc = {
    id: `OC-${String(_oc_counter++).padStart(4, "0")}`,
    loja_id: loja_id || "todas",
    status: "pendente", // pendente → enviada → recebida
    gerada_em: new Date().toISOString(),
    enviada_em: null,
    total_geral: pedidos.reduce((s,p) => s+p.custo_total, 0).toFixed(2),
    qtd_fornecedores: pedidos.length,
    pedidos,
  };
  _ordens_compra.unshift(oc);
  if (_ordens_compra.length > 50) _ordens_compra.pop();

  return oc;
}

function listarOrdensCompra(loja_id) {
  if (loja_id) return _ordens_compra.filter(o => o.loja_id === loja_id || o.loja_id === "todas");
  return _ordens_compra;
}

function atualizarStatusOC(oc_id, status) {
  const oc = _ordens_compra.find(o => o.id === oc_id);
  if (!oc) return null;
  oc.status = status;
  if (status === "enviada") oc.enviada_em = new Date().toISOString();
  if (status === "recebida") {
    // Dá entrada automática no estoque
    for (const pedido of oc.pedidos) {
      for (const item of pedido.itens) {
        const chave = `${item.insumo_id}_${item.loja_id}`;
        if (db.insumos[chave]) {
          db.insumos[chave].quantidade_atual = Math.min(
            db.insumos[chave].quantidade_maxima,
            db.insumos[chave].quantidade_atual + item.qtd_comprar
          );
          db.insumos[chave].ultima_entrada = {
            data: new Date().toISOString().split("T")[0],
            quantidade: item.qtd_comprar,
          };
          db.insumos[chave].status = "ok";
        }
      }
    }
    db.criarNotificacao({
      loja_id: oc.loja_id === "todas" ? "loja_1" : oc.loja_id,
      tipo: "estoque",
      nivel: "info",
      titulo: `Ordem de Compra ${oc.id} recebida`,
      mensagem: `Estoque reposto automaticamente para ${pedido_summary(oc)} itens.`,
      acao: null,
    });
  }
  return oc;
}

function pedido_summary(oc) {
  return oc.pedidos.reduce((s,p) => s + p.itens.length, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERPOWER 4 — RASTREABILIDADE E CONTROLE DE LOTES / VALIDADE
// ─────────────────────────────────────────────────────────────────────────────

const _lotes = {}; // chave: lote_id
let _lote_counter = 1;

// Seed alguns lotes de exemplo

// [CLEAN SLATE — seed block removido]
function _registrarLoteInterno({ insumo_id, loja_id, quantidade, vencimento, fornecedor_id, lote_fornecedor, temperatura_c = null, observacao = "" }) {
  const id = `LOT-${String(_lote_counter++).padStart(5, "0")}`;
  const insumo = db.insumos[`${insumo_id}_${loja_id}`] || {};
  const lote = {
    id, insumo_id, loja_id,
    nome_insumo: insumo.nome || insumo_id,
    unidade: insumo.unidade || "un",
    quantidade_entrada: quantidade,
    quantidade_restante: quantidade,
    vencimento,
    fornecedor_id,
    lote_fornecedor: lote_fornecedor || "",
    temperatura_c,
    observacao,
    status: "ativo", // ativo | consumido | descartado | vencido
    entrada_em: new Date().toISOString(),
    descartado_em: null,
    motivo_descarte: null,
  };
  _lotes[id] = lote;
  return lote;
}

function registrarLote(dados) {
  return _registrarLoteInterno(dados);
}

function getLotesPorLoja(loja_id) {
  const agora = new Date();
  return Object.values(_lotes)
    .filter(l => !loja_id || l.loja_id === loja_id)
    .map(l => {
      const venc = new Date(l.vencimento + "T23:59:59");
      const horas_restantes = Math.max(0, (venc - agora) / 3600000);
      const dias_restantes = +(horas_restantes / 24).toFixed(1);
      let alerta = "ok";
      if (venc < agora) alerta = "vencido";
      else if (horas_restantes <= 48) alerta = "critico";
      else if (horas_restantes <= 120) alerta = "atencao";

      if (alerta === "vencido" && l.status === "ativo") l.status = "vencido";

      return { ...l, dias_restantes, horas_restantes: +horas_restantes.toFixed(0), alerta };
    })
    .sort((a,b) => new Date(a.vencimento) - new Date(b.vencimento));
}

function getAlertasVencimento(loja_id) {
  return getLotesPorLoja(loja_id)
    .filter(l => l.alerta !== "ok" && l.status === "ativo" || l.status === "vencido");
}

function descartarLote(lote_id, motivo = "") {
  const lote = _lotes[lote_id];
  if (!lote) return null;
  lote.status = "descartado";
  lote.descartado_em = new Date().toISOString();
  lote.motivo_descarte = motivo;

  // Registra perda no análise de desperdício
  _registrarPerda({
    insumo_id: lote.insumo_id,
    loja_id: lote.loja_id,
    quantidade: lote.quantidade_restante,
    motivo: motivo || "Descarte por vencimento",
    lote_id,
  });

  return lote;
}

function gerarEtiquetaLote(lote_id) {
  const l = _lotes[lote_id];
  if (!l) return null;
  const forn = db.fornecedores[l.fornecedor_id] || {};
  return {
    lote_id: l.id,
    insumo: l.nome_insumo,
    loja: db.lojas[l.loja_id]?.nome || l.loja_id,
    quantidade: `${l.quantidade_entrada} ${l.unidade}`,
    entrada: new Date(l.entrada_em).toLocaleDateString("pt-BR"),
    vencimento: new Date(l.vencimento + "T12:00:00").toLocaleDateString("pt-BR"),
    fornecedor: forn.nome || l.fornecedor_id,
    lote_fornecedor: l.lote_fornecedor,
    temperatura: l.temperatura_c !== null ? `${l.temperatura_c}°C` : "Temperatura ambiente",
    qrcode_data: `FOODERP|${l.id}|${l.insumo_id}|${l.loja_id}|${l.vencimento}`,
  };
}

// Job: verifica lotes expirando em 48h e cria notificações Heitor
function verificarAlertasVencimento() {
  const alertas = getAlertasVencimento(null); // todas as lojas
  const notificados = new Set();

  for (const l of alertas) {
    const chave = `venc_${l.id}_${l.alerta}`;
    if (notificados.has(chave)) continue;
    notificados.add(chave);

    const nivel = l.alerta === "vencido" ? "critico" : l.alerta === "critico" ? "critico" : "atencao";
    const titulo = l.alerta === "vencido"
      ? `Lote VENCIDO: ${l.nome_insumo} (${l.loja_id})`
      : `Vencimento em ${l.dias_restantes}d: ${l.nome_insumo}`;

    db.criarNotificacao({
      loja_id: l.loja_id,
      tipo: "validade",
      nivel,
      titulo,
      mensagem: `Lote ${l.id} — ${l.quantidade_restante} ${l.unidade} — Vence: ${l.vencimento}. ${nivel === "critico" ? "Usar ou descartar IMEDIATAMENTE." : "Priorize o uso desta quantidade."}`,
      acao: { label: "Ver Lote", endpoint: `/api/estoque/lotes/${l.id}`, payload: null },
    });
  }
  return alertas;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERPOWER 5 — ANÁLISE DE DESPERDÍCIO + PREVISÃO DE DEMANDA (Toque do Heitor)
// ─────────────────────────────────────────────────────────────────────────────

const _perdas = [];
let _perda_counter = 1;

function _registrarPerda({ insumo_id, loja_id, quantidade, motivo, lote_id = null }) {
  const insumo = db.insumos[`${insumo_id}_${loja_id}`] || {};
  const perda = {
    id: `PERDA-${String(_perda_counter++).padStart(4,"0")}`,
    insumo_id, loja_id,
    nome_insumo: insumo.nome || insumo_id,
    unidade: insumo.unidade || "un",
    quantidade,
    custo_estimado: +(quantidade * (insumo.custo_unitario || 0)).toFixed(2),
    motivo,
    lote_id,
    data: new Date().toISOString().split("T")[0],
    ts: new Date().toISOString(),
  };
  _perdas.unshift(perda);
  if (_perdas.length > 500) _perdas.pop();
  return perda;
}

function registrarPerda(dados) {
  return _registrarPerda(dados);
}

function getAnaliseDesperdicio(loja_id) {
  const perdas_filtradas = loja_id
    ? _perdas.filter(p => p.loja_id === loja_id)
    : _perdas;

  // Agrupa por insumo
  const por_insumo = {};
  for (const p of perdas_filtradas) {
    const chave = `${p.insumo_id}_${p.loja_id}`;
    if (!por_insumo[chave]) {
      por_insumo[chave] = {
        insumo_id: p.insumo_id,
        loja_id: p.loja_id,
        nome: p.nome_insumo,
        unidade: p.unidade,
        total_perdido: 0,
        custo_total_perdido: 0,
        ocorrencias: 0,
        motivos: {},
      };
    }
    por_insumo[chave].total_perdido = +(por_insumo[chave].total_perdido + p.quantidade).toFixed(3);
    por_insumo[chave].custo_total_perdido = +(por_insumo[chave].custo_total_perdido + p.custo_estimado).toFixed(2);
    por_insumo[chave].ocorrencias++;
    por_insumo[chave].motivos[p.motivo] = (por_insumo[chave].motivos[p.motivo] || 0) + 1;
  }

  const ranking = Object.values(por_insumo)
    .sort((a,b) => b.custo_total_perdido - a.custo_total_perdido);

  // Calcula consumo teórico vs real (desabastecimento por descarte)
  const consumo_teorico_vs_real = [];
  for (const ins of Object.values(db.insumos).filter(i => !loja_id || i.loja_id === loja_id)) {
    const chave = `${ins.insumo_id}_${ins.loja_id}`;
    const entrada = ins.ultima_entrada ? ins.ultima_entrada.quantidade : 0;
    const saldo_atual = ins.quantidade_atual;
    const perdas_item = (por_insumo[chave] || {}).total_perdido || 0;
    const consumo_real = Math.max(0, entrada - saldo_atual - perdas_item);
    const consumo_teorico = ins.consumo_medio_diario * 7;
    const desvio_pct = consumo_teorico > 0
      ? +(((consumo_real - consumo_teorico) / consumo_teorico) * 100).toFixed(1) : 0;

    consumo_teorico_vs_real.push({
      insumo_id: ins.insumo_id,
      loja_id: ins.loja_id,
      nome: ins.nome,
      consumo_teorico_7d: consumo_teorico,
      consumo_real_estimado: +consumo_real.toFixed(2),
      perdas_registradas: perdas_item,
      desvio_pct,
      alerta: Math.abs(desvio_pct) > 25 ? "investigar" : "ok",
    });
  }

  const total_perdido_custo = ranking.reduce((s,r) => s+r.custo_total_perdido, 0).toFixed(2);

  return {
    loja_id: loja_id || "todas",
    total_perdas: perdas_filtradas.length,
    custo_total_desperdicio: total_perdido_custo,
    ranking_desperdicio: ranking,
    consumo_teorico_vs_real: consumo_teorico_vs_real.sort((a,b) => Math.abs(b.desvio_pct) - Math.abs(a.desvio_pct)),
    insight: total_perdido_custo > 0
      ? `R$ ${total_perdido_custo} em desperdício registrado. Principal causa: ${ranking[0]?.motivos ? Object.keys(ranking[0].motivos)[0] : "N/D"}.`
      : "Nenhum desperdício registrado. Continue monitorando!",
  };
}

// Previsão de demanda por dia da semana + fator climático simulado
function getPrevisaoDemanda(loja_id, dias_futuros = 7) {
  const loja = db.lojas[loja_id];
  if (!loja) return null;

  const nomes_dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const hist = _historico_vendas[loja_id] || {};
  const fichas = Object.values(_fichas_tecnicas).filter(f => f.lojas_disponiveis.includes(loja_id));

  const previsao = [];
  for (let i = 1; i <= dias_futuros; i++) {
    const data = new Date(); data.setDate(data.getDate() + i);
    const dia_semana = data.getDay();
    const nome_dia = nomes_dias[dia_semana];
    const is_fds = dia_semana === 0 || dia_semana === 6;

    // Fator de demanda por dia (baseado em histórico)
    const pedidos_total = fichas.reduce((total, f) => {
      const h = hist[f.prato_id] || [0,0,0,0,0,0,0];
      return total + h[dia_semana];
    }, 0);

    // Fator climático simulado (chuva reduz delivery/presencial diferente)
    const fator_climatico = Math.random() > 0.7 ? 0.85 : 1.0; // 30% chance chuva
    const pedidos_previstos = Math.round(pedidos_total * fator_climatico);

    // Faturamento previsto
    const fat_por_prato = fichas.map(f => {
      const h = hist[f.prato_id] || [0,0,0,0,0,0,0];
      return f.preco_venda * h[dia_semana] * fator_climatico;
    });
    const faturamento_previsto = fat_por_prato.reduce((s,v) => s+v, 0);

    previsao.push({
      data: data.toISOString().split("T")[0],
      dia_semana: nome_dia,
      is_fds,
      pedidos_previstos,
      faturamento_previsto: +faturamento_previsto.toFixed(2),
      fator_climatico,
      condicao: fator_climatico < 1 ? "Chuva prevista — priorize delivery" : "Tempo bom — balancear salão e delivery",
      recomendacao: is_fds
        ? "Final de semana: reforce equipe e produza 30% a mais"
        : `${nome_dia} típico: produção normal conforme ficha`,
    });
  }

  return {
    loja_id, loja_nome: loja.nome,
    gerado_em: new Date().toISOString(),
    previsao,
    melhor_dia: previsao.sort((a,b) => b.faturamento_previsto - a.faturamento_previsto)[0]?.dia_semana || "N/D",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // Superpower 1 — Fichas Técnicas
  listarFichasTecnicas,
  getFichaTecnica,
  criarFichaTecnica,
  atualizarFichaTecnica,
  excluirFichaTecnica,
  calcularCMVFicha,

  // Superpower 2 — KDS / Produção
  getProducaoDia,
  registrarPedidoKDS,
  getFilaKDS,
  atualizarStatusKDS,

  // Superpower 3 — Ordens de Compra
  gerarOrdemCompra,
  listarOrdensCompra,
  atualizarStatusOC,

  // Superpower 4 — Lotes / Validade
  registrarLote,
  getLotesPorLoja,
  getAlertasVencimento,
  descartarLote,
  gerarEtiquetaLote,
  verificarAlertasVencimento,

  // Superpower 5 — Desperdício + Previsão
  registrarPerda,
  getAnaliseDesperdicio,
  getPrevisaoDemanda,
};
