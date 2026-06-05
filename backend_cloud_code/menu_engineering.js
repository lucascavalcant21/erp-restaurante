/**
 * Menu Engineering — Matriz de Popularidade × Margem
 * FoodERP | Seldeestrela, Tico Tico Saladas, Burguer
 *
 * Classificação BCG adaptada para restaurantes (método Kasavana & Smith):
 *
 *  STARS       → Alta popularidade + Alta margem     ✅ Destaque no cardápio
 *  PLOWHORSES  → Alta popularidade + Baixa margem    🔄 Reduzir custo ou aumentar preço
 *  PUZZLES     → Baixa popularidade + Alta margem    🎯 Melhorar promoção / posicionamento
 *  DOGS        → Baixa popularidade + Baixa margem   ❌ Candidatos a remoção
 *
 * Popularidade: % de vendas do prato vs. média esperada (1/n pratos × 70%)
 * Margem: comparado à média de margem de contribuição da loja
 */

// ---------------------------------------------------------------------------
// Banco de dados em memória
// ---------------------------------------------------------------------------

// Histórico de análises salvas
// { loja_id: [ { data, periodo_inicio, periodo_fim, pratos, resumo } ] }
const historicoAnalises = {};

// Período de análise padrão (dias)
const CONFIG_PERIODO_PADRAO = 30;

// Cache de dados de pratos para análise
// { prato_id: { nome, loja_id, preco_venda, custo_insumos, qtd_vendida, categoria } }
const pratosCache = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _lojaId(id) {
  return id ? String(id).toLowerCase().replace(/\s+/g, '_') : null;
}

function _agora() {
  return new Date().toISOString();
}

function _hoje() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Classifica cada prato segundo Kasavana & Smith
 * @param {Array} pratos - lista com { id, nome, qtd_vendida, margem_contribuicao }
 * @returns pratos com campo .classificacao e .quadrante
 */
function _classificar(pratos) {
  if (!pratos.length) return [];

  // Popularidade: um prato é popular se vende ≥ (1/n × 70%) do total de vendas
  const total_vendas = pratos.reduce((s, p) => s + p.qtd_vendida, 0);
  const n = pratos.length;
  const limiar_popularidade = total_vendas > 0 ? (total_vendas / n) * 0.70 : 0;

  // Margem: popular_alta se margem ≥ média de margem da loja
  const soma_margens = pratos.reduce((s, p) => s + p.margem_contribuicao, 0);
  const media_margem = soma_margens / n;

  return pratos.map(p => {
    const alta_popularidade = p.qtd_vendida >= limiar_popularidade;
    const alta_margem = p.margem_contribuicao >= media_margem;

    let classificacao, quadrante, descricao, acao;

    if (alta_popularidade && alta_margem) {
      classificacao = 'star';
      quadrante = '⭐ Star';
      descricao = 'Alta popularidade e alta margem — o melhor do cardápio';
      acao = 'Manter destaque. Proteger qualidade. Usar como âncora de preço.';
    } else if (alta_popularidade && !alta_margem) {
      classificacao = 'plowhorse';
      quadrante = '🐴 Plowhorse';
      descricao = 'Muito vendido, mas margem abaixo da média';
      acao = 'Reduzir custo de insumos ou reposicionar preço discretamente.';
    } else if (!alta_popularidade && alta_margem) {
      classificacao = 'puzzle';
      quadrante = '🧩 Puzzle';
      descricao = 'Boa margem, mas pouco pedido';
      acao = 'Melhorar destaque no cardápio, treinar garçons para sugestão ativa.';
    } else {
      classificacao = 'dog';
      quadrante = '🐕 Dog';
      descricao = 'Baixa popularidade e baixa margem';
      acao = 'Avaliar remoção ou reformulação completa do prato.';
    }

    const pct_popularidade = total_vendas > 0
      ? parseFloat(((p.qtd_vendida / total_vendas) * 100).toFixed(2))
      : 0;

    const cmv_pct = p.preco_venda > 0
      ? parseFloat(((p.custo_insumos / p.preco_venda) * 100).toFixed(2))
      : null;

    return {
      ...p,
      classificacao,
      quadrante,
      descricao,
      acao,
      alta_popularidade,
      alta_margem,
      pct_participacao_vendas: pct_popularidade,
      media_margem_loja: parseFloat(media_margem.toFixed(2)),
      limiar_popularidade: parseFloat(limiar_popularidade.toFixed(1)),
      cmv_percentual: cmv_pct,
    };
  });
}

// ---------------------------------------------------------------------------
// Registro de pratos para análise
// ---------------------------------------------------------------------------

function registrarPrato(dados) {
  const {
    id, nome, loja_id,
    preco_venda, custo_insumos,
    qtd_vendida = 0,
    categoria = 'Geral',
  } = dados;

  if (!id || !nome || !loja_id || preco_venda == null || custo_insumos == null) {
    return { erro: 'Campos obrigatórios: id, nome, loja_id, preco_venda, custo_insumos' };
  }

  const margem = parseFloat((parseFloat(preco_venda) - parseFloat(custo_insumos)).toFixed(2));

  pratosCache[id] = {
    id,
    nome,
    loja_id: _lojaId(loja_id),
    preco_venda: parseFloat(preco_venda),
    custo_insumos: parseFloat(custo_insumos),
    margem_contribuicao: margem,
    qtd_vendida: parseInt(qtd_vendida) || 0,
    categoria,
    atualizado_em: _agora(),
  };

  return { sucesso: true, prato: pratosCache[id] };
}

function atualizarQtdVendida(prato_id, qtd_vendida) {
  const p = pratosCache[prato_id];
  if (!p) return { erro: 'Prato não encontrado' };
  p.qtd_vendida = parseInt(qtd_vendida) || 0;
  p.atualizado_em = _agora();
  return { sucesso: true };
}

function listarPratos(loja_id = null) {
  let lista = Object.values(pratosCache);
  if (loja_id) lista = lista.filter(p => p.loja_id === _lojaId(loja_id));
  return lista;
}

// ---------------------------------------------------------------------------
// Análise principal — gera matriz completa para uma loja
// ---------------------------------------------------------------------------

function analisarCardapio(loja_id, opcoes = {}) {
  const id = _lojaId(loja_id);
  let pratos = Object.values(pratosCache).filter(p => p.loja_id === id);

  if (pratos.length === 0) {
    return {
      loja_id: id,
      total_pratos: 0,
      pratos: [],
      resumo: { stars: 0, plowhorses: 0, puzzles: 0, dogs: 0 },
      mensagem: 'Nenhum prato cadastrado para análise.',
    };
  }

  // Filtrar por categoria se informado
  if (opcoes.categoria) {
    pratos = pratos.filter(p =>
      p.categoria.toLowerCase() === opcoes.categoria.toLowerCase()
    );
  }

  const classificados = _classificar(pratos);

  const resumo = {
    stars:      classificados.filter(p => p.classificacao === 'star').length,
    plowhorses: classificados.filter(p => p.classificacao === 'plowhorse').length,
    puzzles:    classificados.filter(p => p.classificacao === 'puzzle').length,
    dogs:       classificados.filter(p => p.classificacao === 'dog').length,
  };

  const receita_total = classificados.reduce((s, p) => s + (p.preco_venda * p.qtd_vendida), 0);
  const custo_total   = classificados.reduce((s, p) => s + (p.custo_insumos * p.qtd_vendida), 0);
  const margem_total  = receita_total - custo_total;
  const cmv_geral     = receita_total > 0
    ? parseFloat(((custo_total / receita_total) * 100).toFixed(2))
    : null;

  const total_vendas = classificados.reduce((s, p) => s + p.qtd_vendida, 0);

  // Top performers
  const top_stars = classificados
    .filter(p => p.classificacao === 'star')
    .sort((a, b) => b.qtd_vendida - a.qtd_vendida)
    .slice(0, 5);

  const top_dogs = classificados
    .filter(p => p.classificacao === 'dog')
    .sort((a, b) => a.margem_contribuicao - b.margem_contribuicao)
    .slice(0, 5);

  const resultado = {
    loja_id: id,
    total_pratos: classificados.length,
    total_vendas,
    receita_total: parseFloat(receita_total.toFixed(2)),
    custo_total: parseFloat(custo_total.toFixed(2)),
    margem_total: parseFloat(margem_total.toFixed(2)),
    cmv_geral,
    resumo,
    pratos: classificados,
    top_stars,
    top_dogs,
    insights: _gerarInsights(resumo, classificados, cmv_geral),
    gerado_em: _agora(),
  };

  // Salvar snapshot
  if (!historicoAnalises[id]) historicoAnalises[id] = [];
  historicoAnalises[id].push({
    data: _hoje(),
    resumo,
    cmv_geral,
    total_pratos: classificados.length,
    total_vendas,
  });
  if (historicoAnalises[id].length > 60) historicoAnalises[id].shift();

  return resultado;
}

// ---------------------------------------------------------------------------
// Dashboard global — todas as unidades
// ---------------------------------------------------------------------------

function dashboardMenuEngineering() {
  const lojas = ['seldeestrela', 'tico_tico', 'burguer'];

  const analises = lojas.map(id => {
    const a = analisarCardapio(id);
    return {
      loja_id: id,
      total_pratos: a.total_pratos,
      resumo: a.resumo,
      cmv_geral: a.cmv_geral,
      receita_total: a.receita_total,
    };
  });

  const total_stars      = analises.reduce((s, a) => s + a.resumo.stars, 0);
  const total_plowhorses = analises.reduce((s, a) => s + a.resumo.plowhorses, 0);
  const total_puzzles    = analises.reduce((s, a) => s + a.resumo.puzzles, 0);
  const total_dogs       = analises.reduce((s, a) => s + a.resumo.dogs, 0);

  return {
    analises,
    consolidado: {
      stars: total_stars,
      plowhorses: total_plowhorses,
      puzzles: total_puzzles,
      dogs: total_dogs,
      total: total_stars + total_plowhorses + total_puzzles + total_dogs,
    },
    gerado_em: _agora(),
  };
}

// ---------------------------------------------------------------------------
// Insights automáticos
// ---------------------------------------------------------------------------

function _gerarInsights(resumo, pratos, cmv_geral) {
  const insights = [];
  const total = pratos.length;

  if (!total) return insights;

  const pct_dogs = ((resumo.dogs / total) * 100).toFixed(0);
  const pct_stars = ((resumo.stars / total) * 100).toFixed(0);

  if (resumo.dogs > total * 0.3) {
    insights.push({
      tipo: 'alerta',
      icone: '🐕',
      texto: `${pct_dogs}% do cardápio são Dogs. Avalie remover ou reformular esses pratos para liberar capacidade operacional.`,
    });
  }

  if (resumo.stars < total * 0.2) {
    insights.push({
      tipo: 'atencao',
      icone: '⭐',
      texto: `Apenas ${pct_stars}% dos pratos são Stars. Invista em promover os Puzzles com boa margem.`,
    });
  }

  if (resumo.plowhorses > resumo.stars) {
    insights.push({
      tipo: 'oportunidade',
      icone: '🐴',
      texto: `Há mais Plowhorses do que Stars. Rever preço ou custo desses pratos pode aumentar significativamente a margem da loja.`,
    });
  }

  const top_puzzle = pratos
    .filter(p => p.classificacao === 'puzzle')
    .sort((a, b) => b.margem_contribuicao - a.margem_contribuicao)[0];

  if (top_puzzle) {
    insights.push({
      tipo: 'oportunidade',
      icone: '🎯',
      texto: `"${top_puzzle.nome}" é o melhor Puzzle — margem R$ ${top_puzzle.margem_contribuicao} mas baixa venda. Coloque-o em destaque no cardápio.`,
    });
  }

  if (cmv_geral && cmv_geral > 38) {
    insights.push({
      tipo: 'critico',
      icone: '🔴',
      texto: `CMV geral em ${cmv_geral}% — acima do limite saudável para food service (≤35%). Ação imediata necessária.`,
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Histórico de análises
// ---------------------------------------------------------------------------

function historicoAnalise(loja_id, dias = 30) {
  const id = _lojaId(loja_id);
  const hist = historicoAnalises[id] || [];
  return hist.slice(-Math.abs(dias));
}

// ---------------------------------------------------------------------------
// Simulador: impacto de mudança de preço/custo
// ---------------------------------------------------------------------------

function simularMudanca(prato_id, { novo_preco, novo_custo, nova_qtd }) {
  const p = pratosCache[prato_id];
  if (!p) return { erro: 'Prato não encontrado' };

  const preco   = novo_preco  !== undefined ? parseFloat(novo_preco)  : p.preco_venda;
  const custo   = novo_custo  !== undefined ? parseFloat(novo_custo)  : p.custo_insumos;
  const qtd     = nova_qtd    !== undefined ? parseInt(nova_qtd)      : p.qtd_vendida;

  const margem_nova = parseFloat((preco - custo).toFixed(2));
  const cmv_novo    = preco > 0 ? parseFloat(((custo / preco) * 100).toFixed(2)) : null;

  const margem_atual = p.margem_contribuicao;
  const cmv_atual    = p.preco_venda > 0 ? parseFloat(((p.custo_insumos / p.preco_venda) * 100).toFixed(2)) : null;

  // Recalcular classificação com novos valores
  const pratos_simulados = Object.values(pratosCache)
    .filter(x => x.loja_id === p.loja_id)
    .map(x => x.id === prato_id
      ? { ...x, preco_venda: preco, custo_insumos: custo, margem_contribuicao: margem_nova, qtd_vendida: qtd }
      : x
    );

  const classificados_sim = _classificar(pratos_simulados);
  const prato_sim = classificados_sim.find(x => x.id === prato_id);

  return {
    prato_id,
    nome: p.nome,
    antes: {
      preco_venda: p.preco_venda,
      custo_insumos: p.custo_insumos,
      margem_contribuicao: margem_atual,
      cmv_percentual: cmv_atual,
      qtd_vendida: p.qtd_vendida,
      classificacao: null, // calculado separado se necessário
    },
    depois: {
      preco_venda: preco,
      custo_insumos: custo,
      margem_contribuicao: margem_nova,
      cmv_percentual: cmv_novo,
      qtd_vendida: qtd,
      classificacao: prato_sim ? prato_sim.classificacao : null,
      quadrante: prato_sim ? prato_sim.quadrante : null,
    },
    delta_margem: parseFloat((margem_nova - margem_atual).toFixed(2)),
    delta_cmv: cmv_novo !== null && cmv_atual !== null
      ? parseFloat((cmv_novo - cmv_atual).toFixed(2))
      : null,
    impacto_receita_mensal: parseFloat(((preco - p.preco_venda) * qtd * 30).toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Pratos
  registrarPrato,
  atualizarQtdVendida,
  listarPratos,
  // Análise
  analisarCardapio,
  dashboardMenuEngineering,
  historicoAnalise,
  // Simulador
  simularMudanca,
};
