/**
 * CMV em Tempo Real — Custo de Mercadoria Vendida
 * FoodERP | Seldeestrela, Tico Tico Saladas, Burguer
 *
 * Módulo responsável por:
 * - Calcular food cost % por prato (CMV = custo insumos / preço venda × 100)
 * - Monitorar CMV por unidade em tempo real
 * - Gerar alertas quando % ultrapassa meta
 * - Registrar snapshots diários para histórico de tendência
 * - Recomendar ajuste de preço ou custo para equilibrar margem
 */

// ---------------------------------------------------------------------------
// Banco de dados em memória
// ---------------------------------------------------------------------------

// Registros diários de CMV por unidade (snapshots)
// { loja_id: [ { data, cmv_percentual, receita_total, custo_total, pratos_criticos } ] }
const historicoCMV = {};

// Metas de CMV por loja (padrão mercado: 28-35% food service)
// Configurável pelo gestor
const metasCMV = {
  seldeestrela: { meta: 30, alerta_amarelo: 33, alerta_vermelho: 38 },
  tico_tico:    { meta: 28, alerta_amarelo: 32, alerta_vermelho: 36 },
  burguer:      { meta: 32, alerta_amarelo: 36, alerta_vermelho: 40 },
};

// Cache de últimas vendas registradas (alimentado por integração com estoque/cardápio)
// { prato_id: { nome, loja_id, preco_venda, custo_insumos, qtd_vendida_hoje } }
const vendasCache = {};

// Ajustes manuais de preço/custo sugeridos (log de recomendações geradas)
const recomendacoes = [];

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function _calcCMVPrato(prato) {
  if (!prato.preco_venda || prato.preco_venda === 0) return null;
  return parseFloat(((prato.custo_insumos / prato.preco_venda) * 100).toFixed(2));
}

function _status(cmv_pct, meta) {
  if (!meta) return 'neutro';
  if (cmv_pct <= meta.meta) return 'ok';
  if (cmv_pct <= meta.alerta_amarelo) return 'atencao';
  if (cmv_pct <= meta.alerta_vermelho) return 'alerta';
  return 'critico';
}

function _recomendacao(prato, cmv_pct, meta) {
  if (!meta || cmv_pct <= meta.alerta_amarelo) return null;
  const excesso = cmv_pct - meta.meta;
  // Sugestão 1: aumentar preço de venda
  const preco_ideal = parseFloat((prato.custo_insumos / (meta.meta / 100)).toFixed(2));
  const aumento = parseFloat((preco_ideal - prato.preco_venda).toFixed(2));
  // Sugestão 2: reduzir custo
  const custo_ideal = parseFloat((prato.preco_venda * (meta.meta / 100)).toFixed(2));
  const reducao = parseFloat((prato.custo_insumos - custo_ideal).toFixed(2));

  return {
    prato_id: prato.id,
    prato_nome: prato.nome,
    cmv_atual: cmv_pct,
    cmv_meta: meta.meta,
    excesso_percentual: parseFloat(excesso.toFixed(2)),
    opcao_a: {
      acao: 'Aumentar preço de venda',
      de: prato.preco_venda,
      para: preco_ideal,
      variacao: `+R$ ${aumento}`,
    },
    opcao_b: {
      acao: 'Reduzir custo dos insumos',
      de: prato.custo_insumos,
      para: custo_ideal,
      variacao: `-R$ ${reducao}`,
    },
  };
}

function _lojaId(id) {
  return id ? String(id).toLowerCase().replace(/\s+/g, '_') : null;
}

function _agora() {
  return new Date().toISOString();
}

function _hoje() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// CRUD — Metas de CMV
// ---------------------------------------------------------------------------

function getMetas(loja_id) {
  const id = _lojaId(loja_id);
  return metasCMV[id] || null;
}

function atualizarMeta(loja_id, { meta, alerta_amarelo, alerta_vermelho }) {
  const id = _lojaId(loja_id);
  if (!metasCMV[id]) {
    metasCMV[id] = {};
  }
  if (meta !== undefined) metasCMV[id].meta = parseFloat(meta);
  if (alerta_amarelo !== undefined) metasCMV[id].alerta_amarelo = parseFloat(alerta_amarelo);
  if (alerta_vermelho !== undefined) metasCMV[id].alerta_vermelho = parseFloat(alerta_vermelho);
  return { sucesso: true, meta: metasCMV[id] };
}

function listarMetas() {
  return Object.entries(metasCMV).map(([loja_id, meta]) => ({ loja_id, ...meta }));
}

// ---------------------------------------------------------------------------
// Registro de vendas / pratos (integração com cardápio + estoque)
// ---------------------------------------------------------------------------

function registrarPrato(dados) {
  const {
    id, nome, loja_id,
    preco_venda, custo_insumos,
    qtd_vendida_hoje = 0,
  } = dados;

  if (!id || !nome || !loja_id || preco_venda == null || custo_insumos == null) {
    return { erro: 'Campos obrigatórios: id, nome, loja_id, preco_venda, custo_insumos' };
  }

  vendasCache[id] = {
    id,
    nome,
    loja_id: _lojaId(loja_id),
    preco_venda: parseFloat(preco_venda),
    custo_insumos: parseFloat(custo_insumos),
    qtd_vendida_hoje: parseInt(qtd_vendida_hoje) || 0,
    atualizado_em: _agora(),
  };

  return { sucesso: true, prato: vendasCache[id] };
}

function atualizarVendasPrato(prato_id, { qtd_vendida_hoje, custo_insumos, preco_venda }) {
  const p = vendasCache[prato_id];
  if (!p) return { erro: 'Prato não encontrado no cache de vendas' };

  if (qtd_vendida_hoje !== undefined) p.qtd_vendida_hoje = parseInt(qtd_vendida_hoje);
  if (custo_insumos !== undefined) p.custo_insumos = parseFloat(custo_insumos);
  if (preco_venda !== undefined) p.preco_venda = parseFloat(preco_venda);
  p.atualizado_em = _agora();

  return { sucesso: true, prato: p };
}

// ---------------------------------------------------------------------------
// CMV por Prato — cálculo individual
// ---------------------------------------------------------------------------

function cmvPorPrato(prato_id) {
  const p = vendasCache[prato_id];
  if (!p) return { erro: 'Prato não encontrado' };

  const cmv_pct = _calcCMVPrato(p);
  const meta = metasCMV[p.loja_id];
  const status = _status(cmv_pct, meta);
  const rec = _recomendacao(p, cmv_pct, meta);
  const margem_contribuicao = parseFloat((p.preco_venda - p.custo_insumos).toFixed(2));
  const margem_pct = parseFloat((100 - cmv_pct).toFixed(2));

  return {
    prato_id: p.id,
    nome: p.nome,
    loja_id: p.loja_id,
    preco_venda: p.preco_venda,
    custo_insumos: p.custo_insumos,
    cmv_percentual: cmv_pct,
    margem_contribuicao,
    margem_percentual: margem_pct,
    status,
    meta_configurada: meta || null,
    recomendacao: rec,
    qtd_vendida_hoje: p.qtd_vendida_hoje,
    receita_hoje: parseFloat((p.preco_venda * p.qtd_vendida_hoje).toFixed(2)),
    custo_hoje: parseFloat((p.custo_insumos * p.qtd_vendida_hoje).toFixed(2)),
    atualizado_em: p.atualizado_em,
  };
}

// ---------------------------------------------------------------------------
// CMV por Unidade — visão consolidada da loja
// ---------------------------------------------------------------------------

function cmvPorUnidade(loja_id) {
  const id = _lojaId(loja_id);
  const pratos = Object.values(vendasCache).filter(p => p.loja_id === id);

  if (pratos.length === 0) {
    return {
      loja_id: id,
      total_pratos: 0,
      receita_total: 0,
      custo_total: 0,
      cmv_percentual: null,
      status: 'sem_dados',
      pratos_criticos: [],
      meta: metasCMV[id] || null,
    };
  }

  const receita_total = pratos.reduce((s, p) => s + (p.preco_venda * p.qtd_vendida_hoje), 0);
  const custo_total   = pratos.reduce((s, p) => s + (p.custo_insumos * p.qtd_vendida_hoje), 0);

  const cmv_pct = receita_total > 0
    ? parseFloat(((custo_total / receita_total) * 100).toFixed(2))
    : null;

  const meta = metasCMV[id];
  const status = _status(cmv_pct, meta);

  // Pratos que estão acima do alerta
  const pratos_criticos = pratos
    .map(p => {
      const pc = _calcCMVPrato(p);
      return { id: p.id, nome: p.nome, cmv_pct: pc, status: _status(pc, meta) };
    })
    .filter(p => p.status === 'alerta' || p.status === 'critico')
    .sort((a, b) => b.cmv_pct - a.cmv_pct);

  return {
    loja_id: id,
    total_pratos: pratos.length,
    receita_total: parseFloat(receita_total.toFixed(2)),
    custo_total: parseFloat(custo_total.toFixed(2)),
    cmv_percentual: cmv_pct,
    margem_pct: cmv_pct !== null ? parseFloat((100 - cmv_pct).toFixed(2)) : null,
    status,
    meta: meta || null,
    pratos_criticos,
    total_pratos_em_alerta: pratos_criticos.length,
  };
}

// ---------------------------------------------------------------------------
// Dashboard global — todas as unidades
// ---------------------------------------------------------------------------

function dashboardCMV() {
  const lojas = ['seldeestrela', 'tico_tico', 'burguer'];
  const unidades = lojas.map(id => cmvPorUnidade(id));

  const total_receita = unidades.reduce((s, u) => s + (u.receita_total || 0), 0);
  const total_custo   = unidades.reduce((s, u) => s + (u.custo_total || 0), 0);
  const cmv_global    = total_receita > 0
    ? parseFloat(((total_custo / total_receita) * 100).toFixed(2))
    : null;

  const alertas = unidades
    .filter(u => u.status === 'alerta' || u.status === 'critico')
    .map(u => ({
      loja_id: u.loja_id,
      cmv_pct: u.cmv_percentual,
      status: u.status,
      pratos_criticos: u.pratos_criticos.length,
    }));

  const todos_pratos_criticos = unidades.flatMap(u => u.pratos_criticos.map(p => ({
    ...p,
    loja_id: u.loja_id,
  })));

  return {
    cmv_global,
    receita_total_rede: parseFloat(total_receita.toFixed(2)),
    custo_total_rede: parseFloat(total_custo.toFixed(2)),
    unidades,
    alertas_unidades: alertas,
    top_pratos_criticos: todos_pratos_criticos.slice(0, 10),
    gerado_em: _agora(),
  };
}

// ---------------------------------------------------------------------------
// Listagem de todos os pratos com CMV calculado
// ---------------------------------------------------------------------------

function listarPratosComCMV(loja_id = null) {
  let pratos = Object.values(vendasCache);
  if (loja_id) pratos = pratos.filter(p => p.loja_id === _lojaId(loja_id));

  return pratos.map(p => {
    const cmv_pct = _calcCMVPrato(p);
    const meta = metasCMV[p.loja_id];
    return {
      id: p.id,
      nome: p.nome,
      loja_id: p.loja_id,
      preco_venda: p.preco_venda,
      custo_insumos: p.custo_insumos,
      cmv_percentual: cmv_pct,
      margem_contribuicao: parseFloat((p.preco_venda - p.custo_insumos).toFixed(2)),
      status: _status(cmv_pct, meta),
      qtd_vendida_hoje: p.qtd_vendida_hoje,
    };
  }).sort((a, b) => (b.cmv_percentual || 0) - (a.cmv_percentual || 0));
}

// ---------------------------------------------------------------------------
// Snapshot diário — registrar histórico de CMV
// ---------------------------------------------------------------------------

function registrarSnapshotDiario(loja_id) {
  const id = _lojaId(loja_id);
  const dados = cmvPorUnidade(id);
  const hoje = _hoje();

  if (!historicoCMV[id]) historicoCMV[id] = [];

  // Remove snapshot do mesmo dia se já existir (atualiza)
  const idx = historicoCMV[id].findIndex(s => s.data === hoje);
  const snapshot = {
    data: hoje,
    cmv_percentual: dados.cmv_percentual,
    receita_total: dados.receita_total,
    custo_total: dados.custo_total,
    status: dados.status,
    pratos_criticos: dados.pratos_criticos.length,
  };

  if (idx >= 0) {
    historicoCMV[id][idx] = snapshot;
  } else {
    historicoCMV[id].push(snapshot);
    // Manter apenas 90 dias
    if (historicoCMV[id].length > 90) historicoCMV[id].shift();
  }

  return { sucesso: true, snapshot };
}

function historicoUnidade(loja_id, dias = 30) {
  const id = _lojaId(loja_id);
  const hist = historicoCMV[id] || [];
  return hist.slice(-Math.abs(dias));
}

// ---------------------------------------------------------------------------
// Recomendações — gerar e listar
// ---------------------------------------------------------------------------

function gerarRecomendacoes(loja_id = null) {
  let pratos = Object.values(vendasCache);
  if (loja_id) pratos = pratos.filter(p => p.loja_id === _lojaId(loja_id));

  const novas = pratos
    .map(p => {
      const cmv_pct = _calcCMVPrato(p);
      const meta = metasCMV[p.loja_id];
      return _recomendacao(p, cmv_pct, meta);
    })
    .filter(Boolean)
    .sort((a, b) => b.cmv_atual - a.cmv_atual);

  // Salvar no log
  novas.forEach(r => {
    const existe = recomendacoes.find(x => x.prato_id === r.prato_id);
    if (existe) {
      Object.assign(existe, r, { gerado_em: _agora() });
    } else {
      recomendacoes.push({ ...r, gerado_em: _agora(), status: 'pendente' });
    }
  });

  return novas;
}

function listarRecomendacoes() {
  return recomendacoes.sort((a, b) => b.cmv_atual - a.cmv_atual);
}

function resolverRecomendacao(prato_id) {
  const r = recomendacoes.find(x => x.prato_id === prato_id);
  if (!r) return { erro: 'Recomendação não encontrada' };
  r.status = 'resolvida';
  r.resolvido_em = _agora();
  return { sucesso: true, recomendacao: r };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Metas
  getMetas,
  atualizarMeta,
  listarMetas,
  // Pratos
  registrarPrato,
  atualizarVendasPrato,
  listarPratosComCMV,
  cmvPorPrato,
  // Unidade / Dashboard
  cmvPorUnidade,
  dashboardCMV,
  // Histórico
  registrarSnapshotDiario,
  historicoUnidade,
  // Recomendações
  gerarRecomendacoes,
  listarRecomendacoes,
  resolverRecomendacao,
};
