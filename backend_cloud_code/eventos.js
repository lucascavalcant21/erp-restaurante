// ============================================================
// MÓDULO 10 — PLANEJAMENTO E GESTÃO DE EVENTOS
// Seldeestrela | Tico Tico Saladas | Burguer
// ============================================================
'use strict';

// ─── BANCO DE DADOS IN-MEMORY ────────────────────────────────
const _eventos = {};      // keyed by evento_id
const _cardapios = {};    // keyed by evento_id → array de pratos
const _reservas = {};     // keyed by evento_id → array de reservas
const _custos = {};       // keyed by evento_id → array de custos gerais

let _seq = 1;
function _uid(prefix) { return prefix + '_' + (Date.now()) + '_' + (_seq++); }

// ─── SEED: HISTÓRICO DE EVENTOS PASSADOS ────────────────────
// [CLEAN SLATE — seed removido para produção]

// ─── HELPERS ────────────────────────────────────────────────
function _calcBreakEven(evento_id) {
  var evento = _eventos[evento_id];
  if (!evento) return null;
  var custos = _custos[evento_id] || [];
  var custo_total = custos.reduce(function(acc, c) { return acc + c.valor; }, 0);
  var reservas = _reservas[evento_id] || [];
  var mesas_vendidas = reservas.filter(function(r) { return r.status === 'confirmada'; }).length;
  var faturado = reservas.reduce(function(acc, r) { return acc + r.valor_pago; }, 0);
  var ingresso = evento.valor_ingresso || 0;
  var mesas_necessarias = ingresso > 0 ? Math.ceil(custo_total / ingresso) : 0;
  var falta_financeiro = Math.max(0, custo_total - faturado);
  var mesas_faltam = Math.max(0, mesas_necessarias - mesas_vendidas);
  var pct_ocupacao = evento.num_mesas > 0 ? Math.round((mesas_vendidas / evento.num_mesas) * 100) : 0;
  var pct_breakeven = mesas_necessarias > 0 ? Math.min(100, Math.round((mesas_vendidas / mesas_necessarias) * 100)) : 100;
  return {
    custo_total: custo_total,
    mesas_necessarias: mesas_necessarias,
    mesas_vendidas: mesas_vendidas,
    mesas_disponiveis: evento.num_mesas - mesas_vendidas,
    faturado: faturado,
    falta_financeiro: falta_financeiro,
    mesas_faltam: mesas_faltam,
    pct_ocupacao: pct_ocupacao,
    pct_breakeven: pct_breakeven,
    atingiu_breakeven: faturado >= custo_total,
    lucro_projetado: (evento.num_mesas * ingresso) - custo_total,
    lucro_atual: faturado - custo_total
  };
}

function _calcCustoCardapio(evento_id) {
  var pratos = _cardapios[evento_id] || [];
  return pratos.reduce(function(acc, p) { return acc + p.custo_unitario; }, 0);
}

// ─── EXPORTS ─────────────────────────────────────────────────

// EVENTOS
function listarEventos(req, res) {
  var lista = Object.values(_eventos);
  var status = req.query.status;
  var unidade = req.query.unidade;
  if (status) lista = lista.filter(function(e) { return e.status === status; });
  if (unidade) lista = lista.filter(function(e) { return e.unidade === unidade; });
  lista.sort(function(a, b) { return new Date(b.data_evento) - new Date(a.data_evento); });
  return res.json({ ok: true, eventos: lista, total: lista.length });
}

function getEvento(req, res) {
  var e = _eventos[req.params.id];
  if (!e) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var breakeven = _calcBreakEven(e.id);
  var cardapio = _cardapios[e.id] || [];
  var reservas = _reservas[e.id] || [];
  var custos = _custos[e.id] || [];
  // countdown
  var agora = Date.now();
  var inicio = new Date(e.data_evento).getTime();
  var diff = inicio - agora;
  var countdown = null;
  if (diff > 0) {
    var dias = Math.floor(diff / 86400000);
    var horas = Math.floor((diff % 86400000) / 3600000);
    var minutos = Math.floor((diff % 3600000) / 60000);
    var segundos = Math.floor((diff % 60000) / 1000);
    countdown = { dias: dias, horas: horas, minutos: minutos, segundos: segundos, ms_restantes: diff };
  }
  return res.json({ ok: true, evento: e, breakeven: breakeven, cardapio: cardapio, reservas: reservas, custos: custos, countdown: countdown });
}

function criarEvento(req, res) {
  var b = req.body;
  if (!b.nome || !b.data_evento || !b.unidade) return res.status(400).json({ ok: false, erro: 'nome, data_evento e unidade são obrigatórios' });
  var mesas = parseInt(b.num_mesas) || 10;
  var ppMesa = parseInt(b.pessoas_por_mesa) || 2;
  var unidades = { loja_1: 'Seldeestrela', loja_2: 'Tico Tico Saladas', loja_3: 'Burguer' };
  var id = _uid('evt');
  var evento = {
    id: id,
    nome: b.nome,
    unidade: b.unidade,
    unidade_nome: unidades[b.unidade] || b.unidade,
    descricao: b.descricao || '',
    status: 'ativo',
    data_evento: b.data_evento,
    data_fim: b.data_fim || '',
    criado_em: new Date().toISOString(),
    num_mesas: mesas,
    pessoas_por_mesa: ppMesa,
    capacidade_total: mesas * ppMesa,
    valor_ingresso: parseFloat(b.valor_ingresso) || 0,
    total_reservas: 0,
    faturamento_bruto: 0,
    custo_total_calculado: 0,
    lucro: 0,
    raio_x: null
  };
  _eventos[id] = evento;
  _cardapios[id] = [];
  _reservas[id] = [];
  _custos[id] = [];
  return res.json({ ok: true, evento: evento });
}

function atualizarEvento(req, res) {
  var e = _eventos[req.params.id];
  if (!e) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var b = req.body;
  var campos = ['nome', 'descricao', 'status', 'data_evento', 'data_fim', 'valor_ingresso'];
  campos.forEach(function(c) { if (b[c] !== undefined) e[c] = b[c]; });
  if (b.num_mesas !== undefined || b.pessoas_por_mesa !== undefined) {
    if (b.num_mesas !== undefined) e.num_mesas = parseInt(b.num_mesas);
    if (b.pessoas_por_mesa !== undefined) e.pessoas_por_mesa = parseInt(b.pessoas_por_mesa);
    e.capacidade_total = e.num_mesas * e.pessoas_por_mesa;
  }
  if (b.raio_x !== undefined) e.raio_x = b.raio_x;
  return res.json({ ok: true, evento: e });
}

function concluirEvento(req, res) {
  var e = _eventos[req.params.id];
  if (!e) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var b = req.body;
  var reservas = _reservas[e.id] || [];
  var custos = _custos[e.id] || [];
  var custo_total = custos.reduce(function(acc, c) { return acc + c.valor; }, 0);
  var faturado = parseFloat(b.faturamento_bruto) || reservas.reduce(function(acc, r) { return acc + r.valor_pago; }, 0);
  e.status = 'concluido';
  e.faturamento_bruto = faturado;
  e.custo_total_calculado = custo_total;
  e.lucro = faturado - custo_total;
  e.total_reservas = reservas.filter(function(r) { return r.status === 'confirmada'; }).length;
  e.raio_x = {
    confirmados: b.confirmados || e.total_reservas * e.pessoas_por_mesa,
    cancelamentos: b.cancelamentos || 0,
    ticket_medio: e.valor_ingresso || (e.total_reservas > 0 ? Math.round(faturado / e.total_reservas) : 0),
    nota_media: parseFloat(b.nota_media) || 0,
    observacoes: b.observacoes || ''
  };
  return res.json({ ok: true, evento: e });
}

// CARDÁPIO ISOLADO
function listarCardapio(req, res) {
  var pratos = _cardapios[req.params.id] || [];
  return res.json({ ok: true, pratos: pratos, custo_total_cardapio: _calcCustoCardapio(req.params.id) });
}

function adicionarPrato(req, res) {
  if (!_eventos[req.params.id]) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var b = req.body;
  if (!b.nome) return res.status(400).json({ ok: false, erro: 'nome é obrigatório' });
  var prato = {
    id: _uid('prato'),
    nome: b.nome,
    categoria: b.categoria || 'prato_principal',
    custo_unitario: parseFloat(b.custo_unitario) || 0,
    preco_venda: parseFloat(b.preco_venda) || 0,
    ingredientes: b.ingredientes || []
  };
  if (!_cardapios[req.params.id]) _cardapios[req.params.id] = [];
  _cardapios[req.params.id].push(prato);
  return res.json({ ok: true, prato: prato });
}

function removerPrato(req, res) {
  var pratos = _cardapios[req.params.id];
  if (!pratos) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var idx = pratos.findIndex(function(p) { return p.id === req.params.prato_id; });
  if (idx === -1) return res.status(404).json({ ok: false, erro: 'Prato não encontrado' });
  pratos.splice(idx, 1);
  return res.json({ ok: true });
}

// SALÃO & RESERVAS
function listarReservas(req, res) {
  var evento = _eventos[req.params.id];
  if (!evento) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var reservas = _reservas[req.params.id] || [];
  // Mapa de mesas
  var mesas_ocupadas = reservas.map(function(r) { return r.mesa; });
  var mesas_livres = [];
  for (var i = 1; i <= evento.num_mesas; i++) {
    if (mesas_ocupadas.indexOf(i) === -1) mesas_livres.push(i);
  }
  return res.json({ ok: true, reservas: reservas, mesas_ocupadas: mesas_ocupadas, mesas_livres: mesas_livres, total_reservas: reservas.length });
}

function criarReserva(req, res) {
  var evento = _eventos[req.params.id];
  if (!evento) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var b = req.body;
  if (!b.responsavel || !b.mesa) return res.status(400).json({ ok: false, erro: 'responsavel e mesa são obrigatórios' });
  var reservas = _reservas[req.params.id] || [];
  // Verificar se mesa já ocupada
  var mesaOcupada = reservas.find(function(r) { return r.mesa === parseInt(b.mesa); });
  if (mesaOcupada) return res.status(400).json({ ok: false, erro: 'Mesa ' + b.mesa + ' já está ocupada por ' + mesaOcupada.responsavel });
  var reserva = {
    id: _uid('res'),
    mesa: parseInt(b.mesa),
    responsavel: b.responsavel,
    pessoas: parseInt(b.pessoas) || evento.pessoas_por_mesa,
    pratos: b.pratos || [],
    status: b.status || 'pendente',
    valor_pago: parseFloat(b.valor_pago) || 0,
    obs: b.obs || '',
    criado_em: new Date().toISOString()
  };
  reservas.push(reserva);
  _reservas[req.params.id] = reservas;
  // Atualizar faturamento do evento
  evento.faturamento_bruto = reservas.reduce(function(acc, r) { return acc + r.valor_pago; }, 0);
  evento.total_reservas = reservas.filter(function(r) { return r.status === 'confirmada'; }).length;
  return res.json({ ok: true, reserva: reserva, breakeven: _calcBreakEven(req.params.id) });
}

function atualizarReserva(req, res) {
  var reservas = _reservas[req.params.id];
  if (!reservas) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var r = reservas.find(function(x) { return x.id === req.params.res_id; });
  if (!r) return res.status(404).json({ ok: false, erro: 'Reserva não encontrada' });
  var b = req.body;
  ['responsavel', 'pessoas', 'status', 'valor_pago', 'obs', 'pratos'].forEach(function(c) {
    if (b[c] !== undefined) r[c] = b[c];
  });
  // Recalcular evento
  var evento = _eventos[req.params.id];
  if (evento) {
    evento.faturamento_bruto = reservas.reduce(function(acc, x) { return acc + x.valor_pago; }, 0);
    evento.total_reservas = reservas.filter(function(x) { return x.status === 'confirmada'; }).length;
  }
  return res.json({ ok: true, reserva: r, breakeven: _calcBreakEven(req.params.id) });
}

function cancelarReserva(req, res) {
  var reservas = _reservas[req.params.id];
  if (!reservas) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var idx = reservas.findIndex(function(r) { return r.id === req.params.res_id; });
  if (idx === -1) return res.status(404).json({ ok: false, erro: 'Reserva não encontrada' });
  reservas.splice(idx, 1);
  _reservas[req.params.id] = reservas;
  var evento = _eventos[req.params.id];
  if (evento) {
    evento.faturamento_bruto = reservas.reduce(function(acc, r) { return acc + r.valor_pago; }, 0);
    evento.total_reservas = reservas.filter(function(r) { return r.status === 'confirmada'; }).length;
  }
  return res.json({ ok: true, breakeven: _calcBreakEven(req.params.id) });
}

// CUSTOS GERAIS
function listarCustos(req, res) {
  var custos = _custos[req.params.id] || [];
  var total = custos.reduce(function(acc, c) { return acc + c.valor; }, 0);
  return res.json({ ok: true, custos: custos, total: total });
}

function adicionarCusto(req, res) {
  if (!_eventos[req.params.id]) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var b = req.body;
  if (!b.descricao || !b.valor) return res.status(400).json({ ok: false, erro: 'descricao e valor são obrigatórios' });
  var custo = {
    id: _uid('custo'),
    descricao: b.descricao,
    categoria: b.categoria || 'outros',
    valor: parseFloat(b.valor),
    pago: b.pago || false
  };
  if (!_custos[req.params.id]) _custos[req.params.id] = [];
  _custos[req.params.id].push(custo);
  var breakeven = _calcBreakEven(req.params.id);
  return res.json({ ok: true, custo: custo, breakeven: breakeven });
}

function atualizarCusto(req, res) {
  var custos = _custos[req.params.id];
  if (!custos) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var c = custos.find(function(x) { return x.id === req.params.custo_id; });
  if (!c) return res.status(404).json({ ok: false, erro: 'Custo não encontrado' });
  var b = req.body;
  ['descricao', 'categoria', 'valor', 'pago'].forEach(function(campo) {
    if (b[campo] !== undefined) c[campo] = b[campo];
  });
  if (b.valor !== undefined) c.valor = parseFloat(b.valor);
  return res.json({ ok: true, custo: c, breakeven: _calcBreakEven(req.params.id) });
}

function removerCusto(req, res) {
  var custos = _custos[req.params.id];
  if (!custos) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var idx = custos.findIndex(function(c) { return c.id === req.params.custo_id; });
  if (idx === -1) return res.status(404).json({ ok: false, erro: 'Custo não encontrado' });
  custos.splice(idx, 1);
  return res.json({ ok: true, breakeven: _calcBreakEven(req.params.id) });
}

// BREAK-EVEN SNAPSHOT
function getBreakEven(req, res) {
  var be = _calcBreakEven(req.params.id);
  if (!be) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  return res.json({ ok: true, breakeven: be });
}

// KDS — prévia de pedidos por evento enviada à cozinha
function getPreviewCozinha(req, res) {
  var reservas = _reservas[req.params.id] || [];
  var preview = [];
  reservas.forEach(function(r) {
    r.pratos.forEach(function(p) {
      preview.push({ mesa: r.mesa, responsavel: r.responsavel, pessoa: p.pessoa, prato: p.prato_nome, obs: r.obs });
    });
  });
  preview.sort(function(a, b) { return a.mesa - b.mesa; });
  return res.json({ ok: true, preview_cozinha: preview, total_pratos: preview.length });
}

// RAIO-X DE EVENTO PASSADO
function getRaioX(req, res) {
  var e = _eventos[req.params.id];
  if (!e) return res.status(404).json({ ok: false, erro: 'Evento não encontrado' });
  var margem = e.faturamento_bruto > 0 ? Math.round((e.lucro / e.faturamento_bruto) * 100) : 0;
  return res.json({
    ok: true,
    raio_x: {
      evento: { id: e.id, nome: e.nome, unidade: e.unidade_nome, data: e.data_evento, status: e.status },
      financeiro: { faturamento: e.faturamento_bruto, custo: e.custo_total_calculado, lucro: e.lucro, margem_pct: margem },
      operacional: e.raio_x,
      comparativo: { capacidade: e.capacidade_total, ocupacao: e.raio_x ? e.raio_x.confirmados : 0, pct_ocupacao: e.capacidade_total > 0 && e.raio_x ? Math.round((e.raio_x.confirmados / e.capacidade_total) * 100) : 0 }
    }
  });
}

module.exports = {
  listarEventos, getEvento, criarEvento, atualizarEvento, concluirEvento,
  listarCardapio, adicionarPrato, removerPrato,
  listarReservas, criarReserva, atualizarReserva, cancelarReserva,
  listarCustos, adicionarCusto, atualizarCusto, removerCusto,
  getBreakEven, getPreviewCozinha, getRaioX
};
