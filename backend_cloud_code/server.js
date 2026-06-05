// =============================================================================
// CEREBRO ERP — server.js v2.1 (Firebase Firestore)
// =============================================================================
"use strict";

const express    = require("express");
const cors       = require("cors");
const morgan     = require("morgan");
const crypto     = require("crypto");

const db         = require("./banco_de_dados");
const rh         = require("./rh_escala");
const vendas     = require("./integracao_vendas");
const agente     = require("./agente_ia_config");
const estoque    = require("./estoque_inteligente");
const docs       = require("./documentos");
const colab      = require("./colaborador_rh");
const eventos    = require("./eventos");
const crm        = require("./crm");
const cmv        = require("./cmv");
const menu       = require("./menu_engineering");
let fdb; try { fdb = require("./firebase_db"); } catch(e) { console.error("[FDB] Erro ao carregar firebase_db:", e.message); const _noop = async()=>{}; const _col = ()=>({salvar:_noop,buscar:async()=>null,listar:async()=>[],deletar:_noop}); fdb = { firebaseAtivo:()=>false, salvar:async()=>({ok:false}), buscar:async()=>null, listar:async()=>[], deletar:async()=>({ok:false}), novoId:(p)=>p+"_"+Date.now(), pratos:_col(), clientes:_col(), campanhas:_col(), feedbacks:_col(), estoque:_col(), funcionarios:_col(), eventos:_col(), documentos:_col(), financeiro:_col(), escalas:_col(), config:_col() }; }

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

function ok(res, data)              { res.json({ sucesso: true,  dados: data }); }
function erro(res, msg, code = 400) { res.status(code).json({ sucesso: false, erro: msg }); }

// ---------------------------------------------------------------------------
// Firebase — carregar dados persistidos na inicializacao da instancia
// ---------------------------------------------------------------------------
let _dadosCarregados = false;

async function carregarDadosFirebase() {
  if (_dadosCarregados || !fdb.firebaseAtivo()) return;
  try {
    // Pratos (CMV + Menu Engineering)
    const pratos = await fdb.pratos.listar();
    pratos.forEach(p => {
      try { cmv.registrarPrato(p); } catch(_) {}
      try { menu.registrarPrato(p); } catch(_) {}
      if (p.qtd_vendida) { try { menu.atualizarQtdVendida(p.id, p.qtd_vendida); } catch(_) {} }
    });

    // Fichas técnicas (Estoque)
    const fichas = await fdb.listar('fichas_tecnicas');
    fichas.forEach(f => { try { estoque.criarFichaTecnica(f); } catch(_) {} });

    // CRM — Clientes
    const clientes = await fdb.clientes.listar();
    clientes.forEach(c => { try { crm.upsertCliente && crm.upsertCliente(c); } catch(_) {} });

    // CRM — Campanhas
    const campanhas = await fdb.campanhas.listar();
    campanhas.forEach(c => { try { crm.upsertCampanha && crm.upsertCampanha(c); } catch(_) {} });

    // Funcionários
    const funcs = await fdb.funcionarios.listar();
    funcs.forEach(f => { try { colab.criarFuncionario && colab.criarFuncionario(f, true); } catch(_) {} });

    // Eventos
    const evts = await fdb.eventos.listar();
    evts.forEach(e => { try { eventos.criarEvento && eventos.criarEvento(e, true); } catch(_) {} });

    _dadosCarregados = true;
    console.log(`[Firebase] Carregado — Pratos:${pratos.length} Fichas:${fichas.length} Clientes:${clientes.length} Campanhas:${campanhas.length} Funcs:${funcs.length} Eventos:${evts.length}`);
  } catch (e) {
    console.error('[Firebase] Erro ao carregar dados:', e.message);
  }
}

app.use(async (_req, res, next) => {
  if (!_dadosCarregados && fdb.firebaseAtivo()) await carregarDadosFirebase().catch(() => {});
  next();
});

// Health check
app.get("/", (_req, res) => {
  res.json({ sistema: "Cerebro ERP", versao: "2.1.0", agente: "Heitor",
    firebase: fdb.firebaseAtivo() ? "conectado" : "modo_memoria",
    status: "online", timestamp: new Date().toISOString() });
});

// Firebase status
app.get("/api/firebase/status", (_req, res) => {
  ok(res, { ativo: fdb.firebaseAtivo(), dados_carregados: _dadosCarregados,
    project_id: process.env.FIREBASE_PROJECT_ID || null,
    modo: fdb.firebaseAtivo() ? 'firestore' : 'memoria' });
});
app.post("/api/firebase/reload", async (_req, res) => {
  _dadosCarregados = false;
  await carregarDadosFirebase();
  ok(res, { mensagem: 'Recarregado', dados_carregados: _dadosCarregados });
});

// MODULO 1 — banco_de_dados
app.get("/api/db/lojas", (_req, res) => {
  const lista = Object.values(db.lojas).map((l) => {
    const c = vendas.contadores[l.id] || {};
    return { id: l.id, nome: l.nome, status: l.status,
      faturamento_mes_atual: l.faturamento_mes_atual,
      pedidos_hoje: c.pedidos_hoje ?? l.pedidos_hoje,
      faturamento_hoje: c.faturamento_hoje ?? l.faturamento_hoje,
      cmv_pct_hoje: vendas.contadores[l.id] ? +(c.cmv_hoje/(c.faturamento_hoje||1)*100).toFixed(1) : l.cmv_pct_hoje,
      cmv_pct: l.cmv_pct, cmo_pct: l.cmo_pct, metas_mensais: l.metas_mensais };
  });
  ok(res, lista);
});
app.get("/api/db/lojas/:loja_id", (req, res) => {
  const loja = db.lojas[req.params.loja_id];
  if (!loja) return erro(res, "Loja nao encontrada", 404);
  ok(res, loja);
});
app.get("/api/db/estoque/alertas", (_req, res) => ok(res, db.getAlertasEstoque()));
app.get("/api/db/estoque/:loja_id", (req, res) => ok(res, db.getEstoquePorLoja(req.params.loja_id)));
app.post("/api/db/estoque/abater", (req, res) => {
  const { insumo_id, loja_id, quantidade } = req.body;
  if (!insumo_id || !loja_id || quantidade == null) return erro(res, "insumo_id, loja_id, quantidade obrigatorios");
  const result = db.abaterEstoque(insumo_id, loja_id, quantidade);
  if (!result.sucesso) return erro(res, result.mensagem || "Estoque insuficiente", 422);
  ok(res, result);
});
app.get("/api/db/funcionarios/:loja_id", (req, res) => ok(res, db.getFuncionariosPorLoja(req.params.loja_id)));

// MODULO 2 — rh_escala
app.get("/api/rh/escala/:loja_id", (req, res) => ok(res, rh.getEscalaPorLoja(req.params.loja_id)));
app.get("/api/rh/ausentes", (req, res) => ok(res, rh.getAusentesHoje(req.query.loja_id, req.query.data)));
app.post("/api/rh/falta", async (req, res) => {
  const { funcionario_id, loja_id, data, tipo, motivo } = req.body;
  if (!funcionario_id || !loja_id || !tipo) return erro(res, "funcionario_id, loja_id, tipo obrigatorios");
  try { ok(res, await rh.registrarFalta({ funcionario_id, loja_id, data: data || new Date().toISOString().split("T")[0], tipo, motivo: motivo || "Nao informado" })); }
  catch (e) { erro(res, e.message, 500); }
});
app.get("/api/rh/cmo-semana/:loja_id", (req, res) => ok(res, rh.calcularCMOSemana(req.params.loja_id)));
app.get("/api/rh/ocorrencias", (req, res) => {
  let ocs = rh.ocorrencias_do_dia || [];
  if (req.query.loja_id) ocs = ocs.filter(o => o.loja_id === req.query.loja_id);
  ok(res, ocs);
});
app.post("/api/rh/convocar", async (req, res) => {
  const { substituto_id, funcionario_id, loja_id, data } = req.body;
  if (!substituto_id || !funcionario_id || !loja_id) return erro(res, "substituto_id, funcionario_id, loja_id obrigatorios");
  try { ok(res, await rh.convocarSubstituto({ substituto_id, funcionario_id, loja_id, data: data || new Date().toISOString().split("T")[0] })); }
  catch(e) { erro(res, e.message, 500); }
});
app.get("/api/rh/alertar", async (req, res) => {
  const { funcionario_id, loja_id, data, tipo } = req.query;
  if (!funcionario_id || !loja_id) return erro(res, "funcionario_id e loja_id obrigatorios");
  try { ok(res, await rh.alertarGerente({ funcionario_id, loja_id, data: data || new Date().toISOString().split("T")[0], tipo: tipo || "falta_injustificada" })); }
  catch(e) { erro(res, e.message, 500); }
});

// MODULO 3 — vendas
app.get("/api/vendas/dashboard/:loja_id", (req, res) => {
  const d = req.params.loja_id === "todas" ? vendas.getDashboardTempoReal() : vendas.getDashboardTempoReal(req.params.loja_id);
  if (!d) return erro(res, "Loja nao encontrada", 404);
  ok(res, d);
});
app.get("/api/vendas/dashboard", (_req, res) => ok(res, vendas.getDashboardTempoReal()));
app.post("/api/vendas/pedido", async (req, res) => {
  const { payload, origem } = req.body;
  if (!payload || !origem) return erro(res, "payload, origem obrigatorios");
  try { ok(res, await vendas.processarPedidoExterno({ payload, origem })); } catch(e) { erro(res, e.message, 500); }
});
app.get("/api/vendas/pratos-mais-vendidos/:loja_id", (req, res) => {
  ok(res, vendas.getPratosMaisVendidos ? vendas.getPratosMaisVendidos(req.params.loja_id) : []);
});

const simulacoes = {};
app.post("/api/vendas/simulacao/start", (req, res) => {
  const { loja_id = "loja_1", intervalo_ms = 8000 } = req.body;
  if (simulacoes[loja_id]) return erro(res, "Simulacao ja ativa");
  simulacoes[loja_id] = vendas.iniciarSimulacaoTempoReal ? vendas.iniciarSimulacaoTempoReal(loja_id, intervalo_ms) : null;
  ok(res, { mensagem: "Simulacao iniciada em " + loja_id });
});
app.post("/api/vendas/simulacao/stop", (req, res) => {
  const { loja_id = "loja_1" } = req.body;
  if (!simulacoes[loja_id]) return erro(res, "Nenhuma simulacao ativa");
  if (typeof simulacoes[loja_id] === "function") simulacoes[loja_id]();
  delete simulacoes[loja_id];
  ok(res, { mensagem: "Simulacao encerrada" });
});

// MODULO 4 — Webhooks
const WEBHOOK_SECRET_IFOOD  = process.env.WEBHOOK_SECRET_IFOOD  || "fooderrp_ifood_dev_secret";
const WEBHOOK_SECRET_SAIPOS = process.env.WEBHOOK_SECRET_SAIPOS || "fooderrp_saipos_dev_secret";
function validarAssinatura(payload, assinatura, segredo) {
  const esperada = crypto.createHmac("sha256", segredo).update(typeof payload==="string"?payload:JSON.stringify(payload)).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(assinatura||"","hex"), Buffer.from(esperada,"hex")); } catch(_) { return false; }
}

// MODULO 5 — Heitor
app.post("/api/chat", async (req, res) => {
  const { mensagem, historico = [] } = req.body;
  if (!mensagem) return erro(res, "mensagem obrigatoria");
  try {
    const resultado = await agente.chatComHeitor([...historico.slice(-10), { role:"user", content:mensagem }]);
    agente.verificarTriggers();
    res.json({ resposta: resultado.resposta, simulado: resultado.simulado, modelo: resultado.modelo, timestamp: new Date().toISOString() });
  } catch(e) { erro(res, e.message, 500); }
});
app.get("/api/heitor/log", (req, res) => ok(res, agente.getLog(parseInt(req.query.limit)||50)));
app.post("/api/heitor/aprovar", (req, res) => {
  const r = agente.aprovarAcao(req.body.log_id);
  if (!r.ok) return erro(res, r.erro);
  ok(res, { mensagem:"Acao aprovada", entrada:r.entrada });
});
app.post("/api/heitor/rejeitar", (req, res) => {
  const r = agente.rejeitarAcao(req.body.log_id, req.body.motivo||"");
  if (!r.ok) return erro(res, r.erro);
  ok(res, { mensagem:"Acao rejeitada", entrada:r.entrada });
});
app.post("/api/heitor/remanejamento", (req, res) => {
  const { insumo_nome, loja_origem, loja_destino, quantidade } = req.body;
  if (!insumo_nome || !loja_origem || !loja_destino) return erro(res, "insumo_nome, loja_origem, loja_destino obrigatorios");
  ok(res, agente.sugerirRemanejamento(insumo_nome, loja_origem, loja_destino, quantidade||1));
});
app.get("/api/heitor/politicas", (_req, res) => ok(res, agente.POLITICAS));
app.get("/api/analise/rede", async (_req, res) => { try { ok(res, await agente.gerarAnaliseRede()); } catch(e) { erro(res, e.message, 500); } });
app.get("/api/triggers/verificar", (req, res) => { const a = agente.verificarTriggers(); ok(res, { acoes_geradas:a.length, acoes:a }); });
app.post("/api/triggers/verificar", (req, res) => { const a = agente.verificarTriggers(); ok(res, { acoes_geradas:a.length, acoes:a }); });
app.get("/api/contexto", (_req, res) => ok(res, agente.buildContexto()));
app.get("/api/notificacoes", (req, res) => ok(res, db.getNotificacoes({ limit: parseInt(req.query.limit)||20 })));
app.post("/api/notificacoes/lida", (req, res) => { if (!req.body.notif_id) return erro(res,"notif_id obrigatorio"); ok(res, db.marcarNotificacaoLida(req.body.notif_id)); });
app.post("/api/notificacoes/todas-lidas", (req, res) => ok(res, db.marcarTodasNotificacoesLidas(req.body.loja_id||null)));

// MODULO 6 — Config unidades
app.get("/api/config/unidades", (_req, res) => ok(res, agente.getUnidades()));
app.post("/api/config/unidades", (req, res) => {
  if (!req.body.nome) return erro(res, "nome obrigatorio");
  const r = agente.adicionarUnidade(req.body.nome);
  if (!r.ok) return erro(res, r.erro);
  ok(res, r.unidade);
});
app.put("/api/config/unidades/:id", (req, res) => {
  const { nome, status } = req.body;
  if (nome !== undefined) { const r = agente.renomearUnidade(req.params.id, nome); if (!r.ok) return erro(res,r.erro); return ok(res,r.unidade); }
  if (status !== undefined) { const r = agente.alterarStatusUnidade(req.params.id, status); if (!r.ok) return erro(res,r.erro); return ok(res,r.unidade); }
  erro(res, "Informe nome ou status");
});
app.delete("/api/config/unidades/:id", (req, res) => {
  const r = agente.removerUnidade(req.params.id);
  if (!r.ok) return erro(res, r.erro, 404);
  ok(res, { mensagem:"Unidade removida", unidade:r.unidade });
});

// MODULO 7 — Estoque Inteligente
app.get("/api/estoque/fichas", (req, res) => ok(res, estoque.listarFichasTecnicas(req.query.loja_id||null)));
app.get("/api/estoque/fichas/:prato_id", (req, res) => {
  const f = estoque.getFichaTecnica(req.params.prato_id);
  if (!f) return erro(res, "Ficha nao encontrada", 404);
  ok(res, f);
});
app.post("/api/estoque/fichas", async (req, res) => {
  if (!req.body.nome || !req.body.preco_venda || !req.body.ingredientes) return erro(res, "nome, preco_venda, ingredientes obrigatorios");
  const ficha = estoque.criarFichaTecnica(req.body);
  if (fdb.firebaseAtivo() && ficha) await fdb.salvar('fichas_tecnicas', ficha.id, ficha).catch(()=>{});
  ok(res, ficha);
});
app.put("/api/estoque/fichas/:prato_id", async (req, res) => {
  const f = estoque.atualizarFichaTecnica(req.params.prato_id, req.body);
  if (!f) return erro(res, "Ficha nao encontrada", 404);
  if (fdb.firebaseAtivo()) await fdb.salvar('fichas_tecnicas', f.id, f).catch(()=>{});
  ok(res, f);
});
app.delete("/api/estoque/fichas/:prato_id", async (req, res) => {
  if (!estoque.excluirFichaTecnica(req.params.prato_id)) return erro(res, "Ficha nao encontrada", 404);
  if (fdb.firebaseAtivo()) await fdb.deletar('fichas_tecnicas', req.params.prato_id).catch(()=>{});
  ok(res, { mensagem:"Ficha excluida" });
});
app.get("/api/estoque/producao/:loja_id", (req, res) => {
  const p = estoque.getProducaoDia(req.params.loja_id, req.query.data||null);
  if (!p) return erro(res, "Loja nao encontrada", 404);
  ok(res, p);
});
app.get("/api/estoque/kds/:loja_id", (req, res) => ok(res, estoque.getFilaKDS(req.params.loja_id)));
app.post("/api/estoque/kds/pedido", (req, res) => {
  if (!req.body.loja_id || !req.body.prato_id) return erro(res, "loja_id e prato_id obrigatorios");
  ok(res, estoque.registrarPedidoKDS(req.body));
});
app.put("/api/estoque/kds/:loja_id/:pedido_id", (req, res) => {
  if (!req.body.status) return erro(res, "status obrigatorio");
  const p = estoque.atualizarStatusKDS(req.params.pedido_id, req.params.loja_id, req.body.status);
  if (!p) return erro(res, "Pedido nao encontrado", 404);
  ok(res, p);
});
app.get("/api/estoque/ordens", (req, res) => ok(res, estoque.listarOrdensCompra(req.query.loja_id||null)));
app.post("/api/estoque/ordens/gerar", (req, res) => ok(res, estoque.gerarOrdemCompra(req.body.loja_id||null)));
app.put("/api/estoque/ordens/:oc_id", (req, res) => {
  if (!req.body.status) return erro(res, "status obrigatorio");
  const oc = estoque.atualizarStatusOC(req.params.oc_id, req.body.status);
  if (!oc) return erro(res, "Ordem nao encontrada", 404);
  ok(res, oc);
});
app.get("/api/estoque/lotes", (req, res) => ok(res, estoque.getLotesPorLoja(req.query.loja_id||null)));
app.get("/api/estoque/lotes/alertas", (_req, res) => ok(res, estoque.verificarAlertasVencimento()));
app.get("/api/estoque/lotes/:lote_id", (req, res) => {
  const l = estoque.getLotesPorLoja(null).find(x => x.id === req.params.lote_id);
  if (!l) return erro(res, "Lote nao encontrado", 404);
  ok(res, l);
});
app.post("/api/estoque/lotes", async (req, res) => {
  const { insumo_id, loja_id, quantidade, vencimento } = req.body;
  if (!insumo_id || !loja_id || !quantidade || !vencimento) return erro(res, "insumo_id, loja_id, quantidade, vencimento obrigatorios");
  const lote = estoque.registrarLote(req.body);
  if (fdb.firebaseAtivo() && lote) await fdb.salvar('lotes', lote.id, lote).catch(()=>{});
  ok(res, lote);
});
app.post("/api/estoque/lotes/:lote_id/descartar", (req, res) => {
  const l = estoque.descartarLote(req.params.lote_id, req.body.motivo||"");
  if (!l) return erro(res, "Lote nao encontrado", 404);
  ok(res, l);
});
app.get("/api/estoque/lotes/:lote_id/etiqueta", (req, res) => {
  const e = estoque.gerarEtiquetaLote(req.params.lote_id);
  if (!e) return erro(res, "Lote nao encontrado", 404);
  ok(res, e);
});
app.get("/api/estoque/desperdicio", (req, res) => ok(res, estoque.getAnaliseDesperdicio(req.query.loja_id||null)));
app.post("/api/estoque/perda", (req, res) => {
  const { insumo_id, loja_id, quantidade, motivo } = req.body;
  if (!insumo_id || !loja_id || !quantidade || !motivo) return erro(res, "insumo_id, loja_id, quantidade, motivo obrigatorios");
  ok(res, estoque.registrarPerda(req.body));
});
app.get("/api/estoque/previsao/:loja_id", (req, res) => {
  const p = estoque.getPrevisaoDemanda(req.params.loja_id, parseInt(req.query.dias)||7);
  if (!p) return erro(res, "Loja nao encontrada", 404);
  ok(res, p);
});

// MODULO 10 — Eventos
app.get("/api/eventos", eventos.listarEventos);
app.get("/api/eventos/:id", eventos.getEvento);
app.post("/api/eventos", async (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = async (d) => { if (fdb.firebaseAtivo() && d.sucesso && d.dados) await fdb.eventos.salvar(d.dados.id, d.dados).catch(() => {}); orig(d); };
  eventos.criarEvento(req, res, next);
});
app.put("/api/eventos/:id", async (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = async (d) => { if (fdb.firebaseAtivo() && d.sucesso && d.dados) await fdb.eventos.salvar(d.dados.id, d.dados).catch(() => {}); orig(d); };
  eventos.atualizarEvento(req, res, next);
});
app.post("/api/eventos/:id/concluir", async (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = async (d) => { if (fdb.firebaseAtivo() && d.sucesso && d.dados) await fdb.eventos.salvar(d.dados.id, d.dados).catch(() => {}); orig(d); };
  eventos.concluirEvento(req, res, next);
});
app.get("/api/eventos/:id/raio-x", eventos.getRaioX);
app.get("/api/eventos/:id/cardapio", eventos.listarCardapio);
app.post("/api/eventos/:id/cardapio", eventos.adicionarPrato);
app.delete("/api/eventos/:id/cardapio/:prato_id", eventos.removerPrato);
app.get("/api/eventos/:id/reservas", eventos.listarReservas);
app.post("/api/eventos/:id/reservas", eventos.criarReserva);
app.put("/api/eventos/:id/reservas/:res_id", eventos.atualizarReserva);
app.delete("/api/eventos/:id/reservas/:res_id", eventos.cancelarReserva);
app.get("/api/eventos/:id/custos", eventos.listarCustos);
app.post("/api/eventos/:id/custos", eventos.adicionarCusto);
app.put("/api/eventos/:id/custos/:custo_id", eventos.atualizarCusto);
app.delete("/api/eventos/:id/custos/:custo_id", eventos.removerCusto);
app.get("/api/eventos/:id/breakeven", eventos.getBreakEven);
app.get("/api/eventos/:id/preview-cozinha", eventos.getPreviewCozinha);

// Integracao cross-modulo
app.get("/api/integracao/evento/:id/custo-insumos", (req, res) => {
  const fichas = Object.values(estoque._fichas || {});
  const custo_medio = fichas.length ? fichas.reduce((a,f) => a+(f.custo_total||0),0)/fichas.length : 0;
  ok(res, { evento_id:req.params.id, fichas_disponiveis:fichas.length, custo_medio_prato:custo_medio,
    aviso: fichas.length===0 ? "Nenhuma ficha tecnica cadastrada." : null });
});
app.get("/api/integracao/dre/custo-folha/:loja_id", (req, res) => {
  const funs = colab.listarFuncionarios
    ? (() => { const r = {}; colab.listarFuncionarios({ query:{ loja_id:req.params.loja_id } }, { json:(d)=>Object.assign(r,d) }); return r.funcionarios||[]; })()
    : [];
  const custo = funs.reduce((a,f) => a+(f.salario_base||0), 0);
  ok(res, { loja_id:req.params.loja_id, funcionarios:funs.length, custo_folha_mensal:custo, custo_folha_diario:parseFloat((custo/30).toFixed(2)) });
});
app.get("/api/integracao/health-check", (_req, res) => {
  ok(res, { status:"online", timestamp:new Date().toISOString(),
    firebase: fdb.firebaseAtivo() ? "conectado" : "memoria",
    modulos:{ banco_dados:"ok", estoque:"ok", documentos:"ok", colaboradores:"ok", eventos:"ok", agente_ia:"ok", crm:"ok", cmv:"ok", menu_engineering:"ok" },
    modo:"producao", dados_seed:false });
});

// MODULO 11 — CRM & MARKETING
app.get("/api/crm/dashboard", crm.dashboardCRM);
app.get("/api/crm/clientes", crm.listarClientes);
app.post("/api/crm/clientes", async (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = async (d) => { if (fdb.firebaseAtivo() && d.sucesso && d.dados) await fdb.clientes.salvar(d.dados.id, d.dados).catch(()=>{}); orig(d); };
  crm.criarCliente(req, res, next);
});
app.get("/api/crm/clientes/:id", crm.getCliente);
app.put("/api/crm/clientes/:id", async (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = async (d) => { if (fdb.firebaseAtivo() && d.sucesso && d.dados) await fdb.clientes.salvar(d.dados.id, d.dados).catch(()=>{}); orig(d); };
  crm.atualizarCliente(req, res, next);
});
app.post("/api/crm/clientes/:id/visita", crm.registrarVisita);
app.post("/api/crm/clientes/:id/resgatar", crm.resgatarPontos);
app.get("/api/crm/fidelidade/resumo", crm.resumoFidelidade);
app.get("/api/crm/campanhas", crm.listarCampanhas);
app.post("/api/crm/campanhas", async (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = async (d) => { if (fdb.firebaseAtivo() && d.sucesso && d.dados) await fdb.campanhas.salvar(d.dados.id, d.dados).catch(()=>{}); orig(d); };
  crm.criarCampanha(req, res, next);
});
app.put("/api/crm/campanhas/:id", crm.atualizarCampanha);
app.post("/api/crm/campanhas/:id/ativar", crm.ativarCampanha);
app.post("/api/crm/campanhas/:id/metricas", crm.registrarMetrica);
app.get("/api/crm/avaliacoes", crm.listarAvaliacoes);
app.post("/api/crm/avaliacoes", async (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = async (d) => { if (fdb.firebaseAtivo() && d.sucesso && d.dados) await fdb.feedbacks.salvar(d.dados.id, d.dados).catch(()=>{}); orig(d); };
  crm.registrarAvaliacao(req, res, next);
});
app.put("/api/crm/avaliacoes/:id/responder", crm.responderAvaliacao);
app.get("/api/crm/nps", crm.getNPS);
app.get("/api/crm/canais", (_req, res) => ok(res, { canais: crm.CANAIS }));

// MODULO CMV
app.get("/api/cmv/metas", (_req, res) => ok(res, cmv.listarMetas()));
app.get("/api/cmv/metas/:loja_id", (req, res) => { const m = cmv.getMetas(req.params.loja_id); if (!m) return erro(res,"Loja nao encontrada",404); ok(res,m); });
app.put("/api/cmv/metas/:loja_id", (req, res) => ok(res, cmv.atualizarMeta(req.params.loja_id, req.body)));
app.get("/api/cmv/dashboard", (_req, res) => ok(res, cmv.dashboardCMV()));
app.get("/api/cmv/unidade/:loja_id", (req, res) => ok(res, cmv.cmvPorUnidade(req.params.loja_id)));
app.get("/api/cmv/pratos", (req, res) => ok(res, cmv.listarPratosComCMV(req.query.loja_id)));
app.get("/api/cmv/prato/:id", (req, res) => { const r = cmv.cmvPorPrato(req.params.id); if (r.erro) return erro(res,r.erro,404); ok(res,r); });
app.post("/api/cmv/pratos", async (req, res) => {
  const r = cmv.registrarPrato(req.body);
  if (r.erro) return erro(res, r.erro);
  if (fdb.firebaseAtivo() && r.prato) await fdb.pratos.salvar(r.prato.id, r.prato).catch(()=>{});
  ok(res, r);
});
app.put("/api/cmv/pratos/:id", async (req, res) => {
  const r = cmv.atualizarVendasPrato(req.params.id, req.body);
  if (r.erro) return erro(res, r.erro, 404);
  if (fdb.firebaseAtivo() && r.prato) await fdb.pratos.salvar(r.prato.id, r.prato).catch(()=>{});
  ok(res, r);
});
app.get("/api/cmv/historico/:loja_id", (req, res) => ok(res, cmv.historicoUnidade(req.params.loja_id, req.query.dias)));
app.post("/api/cmv/snapshot/:loja_id", (req, res) => ok(res, cmv.registrarSnapshotDiario(req.params.loja_id)));
app.get("/api/cmv/recomendacoes", (req, res) => ok(res, cmv.gerarRecomendacoes(req.query.loja_id)));
app.get("/api/cmv/recomendacoes/lista", (_req, res) => ok(res, cmv.listarRecomendacoes()));
app.put("/api/cmv/recomendacoes/:prato_id/resolver", (req, res) => { const r = cmv.resolverRecomendacao(req.params.prato_id); if (r.erro) return erro(res,r.erro,404); ok(res,r); });

// MODULO MENU ENGINEERING
app.get("/api/menu-eng/dashboard", (_req, res) => ok(res, menu.dashboardMenuEngineering()));
app.get("/api/menu-eng/analise/:loja_id", (req, res) => ok(res, menu.analisarCardapio(req.params.loja_id, req.query)));
app.get("/api/menu-eng/historico/:loja_id", (req, res) => ok(res, menu.historicoAnalise(req.params.loja_id, req.query.dias)));
app.get("/api/menu-eng/pratos", (req, res) => ok(res, menu.listarPratos(req.query.loja_id)));
app.post("/api/menu-eng/pratos", async (req, res) => {
  const r = menu.registrarPrato(req.body);
  if (r.erro) return erro(res, r.erro);
  if (fdb.firebaseAtivo() && r.prato) await fdb.pratos.salvar(r.prato.id, r.prato).catch(()=>{});
  ok(res, r);
});
app.put("/api/menu-eng/pratos/:id/vendas", async (req, res) => {
  const r = menu.atualizarQtdVendida(req.params.id, req.body.qtd_vendida);
  if (r.erro) return erro(res, r.erro, 404);
  if (fdb.firebaseAtivo()) { const p = menu.listarPratos().find(x => x.id===req.params.id); if(p) await fdb.pratos.salvar(p.id,p).catch(()=>{}); }
  ok(res, r);
});
app.post("/api/menu-eng/simular/:prato_id", (req, res) => { const r = menu.simularMudanca(req.params.prato_id, req.body); if (r.erro) return erro(res,r.erro,404); ok(res,r); });

// =============================================================================
// MODULO COLABORADOR RH
// =============================================================================
app.get("/api/colaborador/funcionarios", (req, res) => ok(res, colab.listarFuncionarios(req.query.loja_id)));
app.get("/api/colaborador/funcionarios/:id", (req, res) => {
  const f = colab.getFuncionarioCompleto(req.params.id);
  if (!f) return erro(res, "Funcionário não encontrado", 404);
  ok(res, f);
});
app.post("/api/colaborador/funcionarios", async (req, res) => {
  const r = colab.criarFuncionario(req.body);
  if (r.erro) return erro(res, r.erro);
  if (fdb.firebaseAtivo() && r.funcionario) await fdb.funcionarios.salvar(r.funcionario.id, r.funcionario).catch(() => {});
  ok(res, r);
});
app.put("/api/colaborador/funcionarios/:id", async (req, res) => {
  const r = colab.atualizarFuncionario(req.params.id, req.body);
  if (r.erro) return erro(res, r.erro, 404);
  if (fdb.firebaseAtivo() && r.funcionario) await fdb.funcionarios.salvar(r.funcionario.id, r.funcionario).catch(() => {});
  ok(res, r);
});
app.post("/api/colaborador/ponto", (req, res) => {
  const r = colab.baterPonto(req.body.func_id, req.body.tipo);
  if (r.erro) return erro(res, r.erro);
  ok(res, r);
});
app.get("/api/colaborador/ponto/:func_id", (req, res) => ok(res, colab.getPonto(req.params.func_id, req.query.limite)));
app.get("/api/colaborador/checklist/:func_id", (req, res) => ok(res, colab.getChecklist(req.params.func_id, req.query.data)));
app.post("/api/colaborador/checklist", (req, res) => {
  const { func_id, chk_id, concluido, data } = req.body;
  ok(res, colab.marcarChecklist(func_id, chk_id, concluido, data));
});
app.get("/api/colaborador/treinamentos", (req, res) => ok(res, colab.listarTreinamentos(req.query.categoria)));
app.get("/api/colaborador/treinamentos/:id", (req, res) => {
  const t = colab.getTreinamento(req.params.id);
  if (!t) return erro(res, "Treinamento não encontrado", 404);
  ok(res, t);
});
app.post("/api/colaborador/treinamentos/concluir", (req, res) => {
  const r = colab.registrarConclusaoTreinamento(req.body.func_id, req.body.trein_id, req.body.nota);
  if (r.erro) return erro(res, r.erro);
  ok(res, r);
});
app.get("/api/colaborador/treinamentos/progresso/:func_id", (req, res) => ok(res, colab.getProgressoTreinamentos(req.params.func_id)));
app.get("/api/colaborador/holerite/:func_id", (req, res) => {
  const r = colab.getHolerite(req.params.func_id, req.query.competencia);
  if (!r) return erro(res, "Holerite não encontrado", 404);
  ok(res, r);
});
app.get("/api/colaborador/holerites/:func_id", (req, res) => ok(res, colab.listarHolerites(req.params.func_id)));
app.get("/api/colaborador/holerite/explicar/:termo", (req, res) => ok(res, colab.explicarTermoHolerite(req.params.termo)));
app.get("/api/colaborador/aniversariantes", (req, res) => ok(res, colab.getAniversariantesDoMes(req.query.mes)));
app.get("/api/colaborador/alertas-contratos", (_req, res) => ok(res, colab.getAlertasContratos()));
app.get("/api/colaborador/escala-folgas/:loja_id", (req, res) => ok(res, colab.getEscalaFolgas(req.params.loja_id, req.query.semanas)));

// =============================================================================
// MODULO DOCUMENTOS
// =============================================================================
app.get("/api/documentos/notas", (req, res) => ok(res, docs.listarNotas(req.query.loja_id, req.query)));
app.get("/api/documentos/notas/:id", (req, res) => {
  const n = docs.getNota(req.params.id);
  if (!n) return erro(res, "Nota não encontrada", 404);
  ok(res, n);
});
app.post("/api/documentos/notas", async (req, res) => {
  const r = docs.simularRecebimentoNF(req.body);
  if (!r.sucesso) return erro(res, r.erro);
  if (fdb.firebaseAtivo() && r.nota) await fdb.documentos.salvar(r.nota.id, r.nota).catch(() => {});
  ok(res, r);
});
app.put("/api/documentos/notas/:id/categorizar", async (req, res) => {
  const r = docs.categorizarNota(req.params.id, req.body.categoria);
  if (r.erro) return erro(res, r.erro, 404);
  if (fdb.firebaseAtivo() && r.nota) await fdb.documentos.salvar(r.nota.id, r.nota).catch(() => {});
  ok(res, r);
});
app.get("/api/documentos/fiscal/:loja_id", (req, res) => ok(res, docs.resumoFiscal(req.params.loja_id)));
app.get("/api/documentos/boletos", (req, res) => ok(res, docs.listarBoletos(req.query.loja_id, req.query)));
app.post("/api/documentos/boletos", async (req, res) => {
  const r = docs.criarBoleto(req.body);
  if (r.erro) return erro(res, r.erro);
  if (fdb.firebaseAtivo() && r.boleto) await fdb.documentos.salvar(r.boleto.id, r.boleto).catch(() => {});
  ok(res, r);
});
app.put("/api/documentos/boletos/:id/pagar", async (req, res) => {
  const r = docs.pagarBoleto(req.params.id);
  if (r.erro) return erro(res, r.erro, 404);
  if (fdb.firebaseAtivo() && r.boleto) await fdb.documentos.salvar(r.boleto.id, r.boleto).catch(() => {});
  ok(res, r);
});
app.get("/api/documentos/boletos/resumo/:loja_id", (req, res) => ok(res, docs.resumoBoletos(req.params.loja_id)));
app.get("/api/documentos/legais/:loja_id", (req, res) => ok(res, docs.listarDocsLegais(req.params.loja_id)));
app.post("/api/documentos/legais", async (req, res) => {
  const r = docs.upsertDocLegal(req.body);
  if (r.erro) return erro(res, r.erro);
  if (fdb.firebaseAtivo() && r.doc) await fdb.documentos.salvar(r.doc.id, r.doc).catch(() => {});
  ok(res, r);
});
app.get("/api/documentos/alertas", (_req, res) => ok(res, docs.verificarAlertasDocumentos()));
app.get("/api/documentos/categorias", (_req, res) => ok(res, { categorias: docs.CATEGORIAS_BOLETO, tipos_legais: docs.TIPOS_DOC_LEGAL }));

// =============================================================================
// ALIAS ROUTES — Frontend usa /api/docs/* e /api/colab/* e /api/estoque/alertas
// =============================================================================

// ESTOQUE alias
app.get("/api/estoque/alertas", (_req, res) => {
  const est = (estoque.getAlertasVencimento ? estoque.getAlertasVencimento() : []);
  const dbA = (db.getAlertasEstoque ? db.getAlertasEstoque() : []);
  ok(res, { alertas: [...dbA, ...est] });
});

// DOCS aliases
app.get("/api/docs/nf",              (req, res) => ok(res, docs.listarNotas(req.query.loja_id, req.query)));
app.get("/api/docs/boletos",         (req, res) => ok(res, docs.listarBoletos(req.query.loja_id, req.query)));
app.put("/api/docs/boletos/:id/pagar", async (req, res) => {
  const r = docs.pagarBoleto(req.params.id);
  if (r.erro) return erro(res, r.erro, 404);
  if (fdb.firebaseAtivo() && r.boleto) await fdb.documentos.salvar(r.boleto.id, r.boleto).catch(() => {});
  ok(res, r);
});
app.get("/api/docs/legais", (req, res) => ok(res, docs.listarDocsLegais(req.query.loja_id)));

// COLAB aliases
app.get("/api/colab/funcionarios", (req, res) => ok(res, colab.listarFuncionarios(req.query.loja_id)));
app.get("/api/colab/ponto",        (req, res) => ok(res, colab.listarPontos(req.query)));
app.get("/api/colab/holerite/:func_id",  (req, res) => ok(res, colab.calcularHolerite(req.params.func_id)));
app.get("/api/colab/holerites/:func_id", (req, res) => ok(res, colab.calcularHolerite(req.params.func_id)));
app.post("/api/colab/holerite/explicar", (req, res) => ok(res, colab.explicarHolerite(req.body.termo)));
app.get("/api/colab/treinamentos",       (req, res) => ok(res, colab.listarTreinamentos(req.query.loja_id)));
app.put("/api/colab/treinamentos/:id/concluir", async (req, res) => {
  const r = colab.concluirTreinamento ? colab.concluirTreinamento(req.params.id, req.body.func_id) : { ok: true };
  if (r && r.erro) return erro(res, r.erro, 404);
  ok(res, r || { ok: true });
});
app.get("/api/colab/treinamentos/progresso/:func_id", (req, res) => ok(res, colab.progressoTreinamentos ? colab.progressoTreinamentos(req.params.func_id) : []));
app.get("/api/colab/checklist/:func_id",     (req, res) => ok(res, colab.checklistOnboarding ? colab.checklistOnboarding(req.params.func_id) : []));
app.put("/api/colab/checklist/:func_id/marcar", async (req, res) => {
  const r = colab.marcarChecklist ? colab.marcarChecklist(req.params.func_id, req.body.item_id) : { ok: true };
  if (r && r.erro) return erro(res, r.erro, 404);
  ok(res, r || { ok: true });
});
app.get("/api/colab/alertas-contratos", (_req, res) => ok(res, colab.alertasContratos ? colab.alertasContratos() : []));
app.get("/api/colab/aniversariantes",   (_req, res) => ok(res, colab.aniversariantesDoMes ? colab.aniversariantesDoMes() : []));

// =============================================================================
// DASHBOARD — Endpoint consolidado para o Next.js dashboard (/app/dashboard)
// =============================================================================
app.get("/api/dashboard", (req, res) => {
  try {
    const cmvData    = cmv.dashboardCMV               ? cmv.dashboardCMV()               : {};
    const vendasData = vendas.getDashboardTempoReal    ? vendas.getDashboardTempoReal()    : {};
    const faturamento = vendasData.totalHoje || cmvData.faturamento || 0;
    const custoTotal  = cmvData.custoTotal || 0;
    const lucro       = faturamento - custoTotal;
    const margem      = faturamento > 0 ? parseFloat(((lucro / faturamento) * 100).toFixed(1)) : 0;
    ok(res, {
      mes:          req.query.mes  ? parseInt(req.query.mes)  : new Date().getMonth() + 1,
      ano:          req.query.ano  ? parseInt(req.query.ano)  : new Date().getFullYear(),
      loja_id:      req.query.loja_id || "grupo",
      faturamento, custos: custoTotal, lucro, margem,
      distribuicao: {
        cmv:         cmvData.percentualCMV        || 0,
        mao_de_obra: cmvData.percentualMaoDeObra  || 0,
        operacional: cmvData.percentualOperacional || 0,
        impostos:    cmvData.percentualImpostos    || 0,
      },
      categorias: cmvData.categorias || [],
      vendas:     vendasData,
    });
  } catch (e) { erro(res, e.message); }
});

// =============================================================================
// START
// =============================================================================
app.listen(PORT, () => console.log(`[FoodERP] Servidor na porta ${PORT}`));
module.exports = app;
