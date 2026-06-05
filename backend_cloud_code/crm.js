// ============================================================
// MÓDULO 11 — CRM & MARKETING
// Clientes · Campanhas · NPS · Fidelidade · Avaliações
// ============================================================
'use strict';

const _clientes = {};
const _campanhas = {};
const _avaliacoes = {};
const _contatos = {};   // histórico de contato por cliente
let _seq = 1;
function _uid(p) { return p + '_' + Date.now() + '_' + (_seq++); }

// ── HELPERS ─────────────────────────────────────────────────
function _calcNivel(pontos) {
  if (pontos >= 5000) return { nivel: 'Diamante', cor: '#60a5fa', icone: '💎' };
  if (pontos >= 2000) return { nivel: 'Ouro', cor: '#fbbf24', icone: '🥇' };
  if (pontos >= 500)  return { nivel: 'Prata', cor: '#94a3b8', icone: '🥈' };
  return { nivel: 'Bronze', cor: '#cd7c54', icone: '🥉' };
}

function _calcNPS(avaliacoes) {
  if (!avaliacoes.length) return { nps: null, promotores: 0, neutros: 0, detratores: 0, total: 0 };
  const promotores  = avaliacoes.filter(a => a.nota >= 9).length;
  const detratores  = avaliacoes.filter(a => a.nota <= 6).length;
  const total       = avaliacoes.length;
  const nps         = Math.round(((promotores - detratores) / total) * 100);
  return { nps, promotores, neutros: total - promotores - detratores, detratores, total };
}

// ══════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════
function listarClientes(req, res) {
  let lista = Object.values(_clientes);
  const { loja_id, nivel, busca } = req.query;
  if (loja_id) lista = lista.filter(c => c.loja_id === loja_id);
  if (nivel)   lista = lista.filter(c => c.nivel === nivel);
  if (busca) {
    const b = busca.toLowerCase();
    lista = lista.filter(c =>
      c.nome.toLowerCase().includes(b) ||
      (c.telefone || '').includes(b) ||
      (c.email || '').toLowerCase().includes(b)
    );
  }
  lista = lista.map(c => ({ ...c, ..._calcNivel(c.pontos || 0) }));
  lista.sort((a, b) => (b.pontos || 0) - (a.pontos || 0));
  return res.json({ ok: true, clientes: lista, total: lista.length });
}

function getCliente(req, res) {
  const c = _clientes[req.params.id];
  if (!c) return res.status(404).json({ ok: false, erro: 'Cliente não encontrado' });
  const historico = _contatos[req.params.id] || [];
  const avals = Object.values(_avaliacoes).filter(a => a.cliente_id === req.params.id);
  return res.json({ ok: true, cliente: { ...c, ..._calcNivel(c.pontos || 0) }, historico, avaliacoes: avals });
}

function criarCliente(req, res) {
  const b = req.body;
  if (!b.nome) return res.status(400).json({ ok: false, erro: 'nome é obrigatório' });
  const id = _uid('cli');
  const cliente = {
    id,
    nome: b.nome,
    telefone: b.telefone || '',
    email: b.email || '',
    data_nascimento: b.data_nascimento || '',
    loja_id: b.loja_id || 'loja_1',
    pontos: 0,
    total_visitas: 0,
    total_gasto: 0,
    ultima_visita: null,
    preferencias: b.preferencias || [],
    observacoes: b.observacoes || '',
    origem: b.origem || 'balcao',
    status: 'ativo',
    criado_em: new Date().toISOString()
  };
  _clientes[id] = cliente;
  _contatos[id] = [];
  return res.json({ ok: true, cliente: { ...cliente, ..._calcNivel(0) } });
}

function atualizarCliente(req, res) {
  const c = _clientes[req.params.id];
  if (!c) return res.status(404).json({ ok: false, erro: 'Cliente não encontrado' });
  const campos = ['nome','telefone','email','data_nascimento','loja_id','preferencias','observacoes','status'];
  campos.forEach(f => { if (req.body[f] !== undefined) c[f] = req.body[f]; });
  return res.json({ ok: true, cliente: { ...c, ..._calcNivel(c.pontos || 0) } });
}

function registrarVisita(req, res) {
  const c = _clientes[req.params.id];
  if (!c) return res.status(404).json({ ok: false, erro: 'Cliente não encontrado' });
  const b = req.body;
  const valor = parseFloat(b.valor_gasto) || 0;
  const pontos_ganhos = Math.floor(valor);  // 1 ponto por R$1
  c.total_visitas = (c.total_visitas || 0) + 1;
  c.total_gasto   = parseFloat(((c.total_gasto || 0) + valor).toFixed(2));
  c.pontos        = (c.pontos || 0) + pontos_ganhos;
  c.ultima_visita = new Date().toISOString();
  if (!_contatos[req.params.id]) _contatos[req.params.id] = [];
  _contatos[req.params.id].unshift({
    tipo: 'visita',
    data: new Date().toISOString(),
    valor_gasto: valor,
    pontos_ganhos,
    pedido: b.pedido || '',
    loja_id: b.loja_id || c.loja_id
  });
  return res.json({ ok: true, cliente: { ...c, ..._calcNivel(c.pontos) }, pontos_ganhos });
}

function resgatarPontos(req, res) {
  const c = _clientes[req.params.id];
  if (!c) return res.status(404).json({ ok: false, erro: 'Cliente não encontrado' });
  const pontos = parseInt(req.body.pontos) || 0;
  if (pontos > c.pontos) return res.status(400).json({ ok: false, erro: `Pontos insuficientes (disponível: ${c.pontos})` });
  c.pontos -= pontos;
  if (!_contatos[req.params.id]) _contatos[req.params.id] = [];
  _contatos[req.params.id].unshift({
    tipo: 'resgate',
    data: new Date().toISOString(),
    pontos_resgatados: pontos,
    descricao: req.body.descricao || 'Resgate de pontos'
  });
  return res.json({ ok: true, cliente: { ...c, ..._calcNivel(c.pontos) } });
}

function resumoFidelidade(req, res) {
  const clientes = Object.values(_clientes);
  const niveis = { Diamante: 0, Ouro: 0, Prata: 0, Bronze: 0 };
  let total_pontos = 0;
  clientes.forEach(c => {
    const n = _calcNivel(c.pontos || 0);
    niveis[n.nivel]++;
    total_pontos += (c.pontos || 0);
  });
  const aniversariantes = clientes.filter(c => {
    if (!c.data_nascimento) return false;
    const hoje = new Date();
    const nasc = new Date(c.data_nascimento);
    return nasc.getMonth() === hoje.getMonth() && nasc.getDate() === hoje.getDate();
  });
  return res.json({
    ok: true,
    resumo: {
      total_clientes: clientes.length,
      ativos: clientes.filter(c => c.status === 'ativo').length,
      total_pontos_emitidos: total_pontos,
      niveis,
      aniversariantes_hoje: aniversariantes.length
    }
  });
}

// ══════════════════════════════════════════════
// CAMPANHAS
// ══════════════════════════════════════════════
const CANAIS = ['whatsapp', 'instagram', 'email', 'sms', 'push'];
const STATUS_CAMP = ['rascunho', 'agendada', 'ativa', 'concluida', 'pausada'];

function listarCampanhas(req, res) {
  let lista = Object.values(_campanhas);
  if (req.query.status) lista = lista.filter(c => c.status === req.query.status);
  lista.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  return res.json({ ok: true, campanhas: lista, total: lista.length });
}

function criarCampanha(req, res) {
  const b = req.body;
  if (!b.nome || !b.canal) return res.status(400).json({ ok: false, erro: 'nome e canal são obrigatórios' });
  const id = _uid('camp');
  const campanha = {
    id,
    nome: b.nome,
    canal: b.canal,
    objetivo: b.objetivo || 'engajamento',
    mensagem: b.mensagem || '',
    segmento: b.segmento || 'todos',
    data_inicio: b.data_inicio || null,
    data_fim: b.data_fim || null,
    status: 'rascunho',
    orcamento: parseFloat(b.orcamento) || 0,
    desconto_pct: parseFloat(b.desconto_pct) || 0,
    codigo_promocional: b.codigo_promocional || '',
    metricas: { enviados: 0, visualizados: 0, cliques: 0, conversoes: 0, receita_gerada: 0 },
    criado_em: new Date().toISOString()
  };
  _campanhas[id] = campanha;
  return res.json({ ok: true, campanha });
}

function atualizarCampanha(req, res) {
  const c = _campanhas[req.params.id];
  if (!c) return res.status(404).json({ ok: false, erro: 'Campanha não encontrada' });
  const campos = ['nome','canal','objetivo','mensagem','segmento','data_inicio','data_fim','status','orcamento','desconto_pct','codigo_promocional'];
  campos.forEach(f => { if (req.body[f] !== undefined) c[f] = req.body[f]; });
  return res.json({ ok: true, campanha: c });
}

function ativarCampanha(req, res) {
  const c = _campanhas[req.params.id];
  if (!c) return res.status(404).json({ ok: false, erro: 'Campanha não encontrada' });
  c.status = 'ativa';
  c.data_inicio = c.data_inicio || new Date().toISOString();
  // Simula envio baseado no segmento
  const clientes = Object.values(_clientes).filter(cl => {
    if (c.segmento === 'todos') return true;
    if (c.segmento === 'diamante') return _calcNivel(cl.pontos).nivel === 'Diamante';
    if (c.segmento === 'ouro')     return _calcNivel(cl.pontos).nivel === 'Ouro';
    if (c.segmento === 'inativos') {
      if (!cl.ultima_visita) return true;
      return (Date.now() - new Date(cl.ultima_visita)) > 30 * 86400000;
    }
    return true;
  });
  c.metricas.enviados = clientes.length;
  return res.json({ ok: true, campanha: c, destinatarios: clientes.length });
}

function registrarMetrica(req, res) {
  const c = _campanhas[req.params.id];
  if (!c) return res.status(404).json({ ok: false, erro: 'Campanha não encontrada' });
  const b = req.body;
  if (b.visualizacoes) c.metricas.visualizados += parseInt(b.visualizacoes);
  if (b.cliques)       c.metricas.cliques       += parseInt(b.cliques);
  if (b.conversoes)    c.metricas.conversoes     += parseInt(b.conversoes);
  if (b.receita)       c.metricas.receita_gerada += parseFloat(b.receita);
  // Calcular ROI
  const roi = c.orcamento > 0
    ? parseFloat(((c.metricas.receita_gerada - c.orcamento) / c.orcamento * 100).toFixed(1))
    : 0;
  return res.json({ ok: true, metricas: c.metricas, roi_pct: roi });
}

// ══════════════════════════════════════════════
// NPS & AVALIAÇÕES
// ══════════════════════════════════════════════
function listarAvaliacoes(req, res) {
  let lista = Object.values(_avaliacoes);
  if (req.query.loja_id) lista = lista.filter(a => a.loja_id === req.query.loja_id);
  if (req.query.tipo) lista = lista.filter(a => {
    const n = a.nota;
    if (req.query.tipo === 'promotor') return n >= 9;
    if (req.query.tipo === 'neutro')   return n >= 7 && n <= 8;
    if (req.query.tipo === 'detrator') return n <= 6;
    return true;
  });
  lista.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  const nps = _calcNPS(lista);
  return res.json({ ok: true, avaliacoes: lista, nps, total: lista.length });
}

function registrarAvaliacao(req, res) {
  const b = req.body;
  if (!b.nota || !b.loja_id) return res.status(400).json({ ok: false, erro: 'nota e loja_id são obrigatórios' });
  const nota = parseInt(b.nota);
  if (nota < 1 || nota > 10) return res.status(400).json({ ok: false, erro: 'nota deve ser entre 1 e 10' });
  const id = _uid('aval');
  const avaliacao = {
    id,
    nota,
    cliente_id: b.cliente_id || null,
    cliente_nome: b.cliente_nome || 'Anônimo',
    loja_id: b.loja_id,
    comentario: b.comentario || '',
    categoria: b.categoria || 'geral',  // atendimento, comida, ambiente, entrega
    canal: b.canal || 'presencial',
    respondido: false,
    resposta: '',
    criado_em: new Date().toISOString()
  };
  _avaliacoes[id] = avaliacao;
  // Adicionar pontos de fidelidade se cliente identificado
  if (b.cliente_id && _clientes[b.cliente_id]) {
    _clientes[b.cliente_id].pontos = (_clientes[b.cliente_id].pontos || 0) + 50;
  }
  return res.json({ ok: true, avaliacao, tipo: nota >= 9 ? 'promotor' : nota >= 7 ? 'neutro' : 'detrator' });
}

function responderAvaliacao(req, res) {
  const a = _avaliacoes[req.params.id];
  if (!a) return res.status(404).json({ ok: false, erro: 'Avaliação não encontrada' });
  a.respondido = true;
  a.resposta = req.body.resposta || '';
  a.respondido_em = new Date().toISOString();
  return res.json({ ok: true, avaliacao: a });
}

function getNPS(req, res) {
  let lista = Object.values(_avaliacoes);
  if (req.query.loja_id) lista = lista.filter(a => a.loja_id === req.query.loja_id);
  // Últimos 30 dias
  const trinta_dias = new Date(Date.now() - 30 * 86400000).toISOString();
  const recentes = lista.filter(a => a.criado_em >= trinta_dias);
  const nps_geral  = _calcNPS(lista);
  const nps_mensal = _calcNPS(recentes);
  // Por categoria
  const cats = {};
  lista.forEach(a => {
    if (!cats[a.categoria]) cats[a.categoria] = [];
    cats[a.categoria].push(a);
  });
  const nps_por_categoria = {};
  for (const cat in cats) nps_por_categoria[cat] = _calcNPS(cats[cat]);
  return res.json({ ok: true, nps_geral, nps_mensal, nps_por_categoria, total_avaliacoes: lista.length });
}

// ══════════════════════════════════════════════
// DASHBOARD CRM
// ══════════════════════════════════════════════
function dashboardCRM(req, res) {
  const clientes = Object.values(_clientes);
  const campanhas = Object.values(_campanhas);
  const avaliacoes = Object.values(_avaliacoes);
  const nps = _calcNPS(avaliacoes);
  const agora = new Date();
  const mesAtual = agora.getMonth();
  const anoAtual = agora.getFullYear();
  // Novos clientes este mês
  const novosEsteMes = clientes.filter(c => {
    const d = new Date(c.criado_em);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;
  // Ticket médio
  const clientesComCompra = clientes.filter(c => c.total_gasto > 0);
  const ticketMedio = clientesComCompra.length
    ? parseFloat((clientesComCompra.reduce((a, c) => a + c.total_gasto, 0) / clientesComCompra.length).toFixed(2))
    : 0;
  // Campanhas ativas
  const campanhasAtivas = campanhas.filter(c => c.status === 'ativa').length;
  // Taxa de resposta NPS
  const respondidas = avaliacoes.filter(a => a.respondido).length;
  return res.json({
    ok: true,
    dashboard: {
      total_clientes: clientes.length,
      novos_mes: novosEsteMes,
      ticket_medio: ticketMedio,
      campanhas_ativas: campanhasAtivas,
      nps: nps.nps,
      nps_total_respostas: nps.total,
      taxa_resposta_nps: avaliacoes.length > 0 ? Math.round((respondidas / avaliacoes.length) * 100) : 0,
      top_clientes: clientes
        .sort((a, b) => (b.pontos || 0) - (a.pontos || 0))
        .slice(0, 5)
        .map(c => ({ id: c.id, nome: c.nome, pontos: c.pontos, ..._calcNivel(c.pontos || 0) }))
    }
  });
}

module.exports = {
  listarClientes, getCliente, criarCliente, atualizarCliente,
  registrarVisita, resgatarPontos, resumoFidelidade,
  listarCampanhas, criarCampanha, atualizarCampanha, ativarCampanha, registrarMetrica,
  listarAvaliacoes, registrarAvaliacao, responderAvaliacao, getNPS,
  dashboardCRM, CANAIS, STATUS_CAMP
};
