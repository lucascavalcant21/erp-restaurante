// =============================================================================
// FOODERP -- banco_de_dados.js
// Motor de dados central: lojas, funcionarios, insumos e vendas
// Simula um banco NoSQL (estilo Firestore / MongoDB) em memoria,
// pronto para ser substituido por uma chamada real ao banco na nuvem.
// =============================================================================

"use strict";

// ---------------------------------------------------------------------------
// 1. LOJAS
// ---------------------------------------------------------------------------
const lojas = {
  loja_1: {
    id: "loja_1",
    nome: "Seldeestrela",
    endereco: "Rua das Flores, 142 - Centro",
    cidade: "Sao Paulo",
    telefone: "(11) 3200-0001",
    gerente_id: null,
    capacidade_mesas: 25,
    status: "aberta",
    horario: { abertura: "10:30", fechamento: "22:00" },
    metas_mensais: { faturamento: 150000, cmv_max_pct: 30, cmo_max_pct: 22 },
    faturamento_mes_atual: 131393,
    faturamento_hoje: 0,
    pedidos_hoje: 47,
    mesas_ocupadas: 17,
    cmv_pct_hoje: 0,
    cmo_pct: 20.1,
  },
  loja_2: {
    id: "loja_2",
    nome: "Tico Tico Saladas",
    endereco: "Shopping Paulista, Piso L2 - Loja 214",
    cidade: "Sao Paulo",
    telefone: "(11) 3200-0002",
    gerente_id: null,
    capacidade_mesas: 40,
    status: "aberta",
    horario: { abertura: "10:00", fechamento: "22:00" },
    metas_mensais: { faturamento: 180000, cmv_max_pct: 30, cmo_max_pct: 22 },
    faturamento_mes_atual: 168934,
    faturamento_hoje: 0,
    pedidos_hoje: 83,
    mesas_ocupadas: 35,
    cmv_pct_hoje: 0,
    cmo_pct: 21.3,
  },
  loja_3: {
    id: "loja_3",
    nome: "Burguer",
    endereco: "Av. Bela Vista, 890 - Zona Norte",
    cidade: "Sao Paulo",
    telefone: "(11) 3200-0003",
    gerente_id: null,
    capacidade_mesas: 15,
    status: "aberta",
    horario: { abertura: "11:00", fechamento: "21:00" },
    metas_mensais: { faturamento: 20000, cmv_max_pct: 30, cmo_max_pct: 22 },
    faturamento_mes_atual: 12513,
    faturamento_hoje: 0,
    pedidos_hoje: 14,
    mesas_ocupadas: 6,
    cmv_pct_hoje: 0,
    cmo_pct: 22.8,
  },
};

// ---------------------------------------------------------------------------
// 2. FUNCIONARIOS
// ---------------------------------------------------------------------------
const funcionarios = {}; // PRODUCAO — cadastre dados reais

// ---------------------------------------------------------------------------
// 3. INSUMOS (estoque por loja)
// ---------------------------------------------------------------------------
const insumos = {}; // PRODUCAO — cadastre dados reais

// ---------------------------------------------------------------------------
// 4. FORNECEDORES
// ---------------------------------------------------------------------------
const fornecedores = {}; // PRODUCAO — cadastre dados reais

// ---------------------------------------------------------------------------
// 5. CARDAPIO (receitas com insumos necessarios por prato)
// ---------------------------------------------------------------------------
const cardapio = {}; // PRODUCAO — cadastre dados reais

// ---------------------------------------------------------------------------
// 6. LOG DE VENDAS (ultimas 24h)
// ---------------------------------------------------------------------------
const vendas_recentes = []; // PRODUCAO — cadastre dados reais

// ---------------------------------------------------------------------------
// 7. CONFIGURACOES GLOBAIS
// ---------------------------------------------------------------------------
const config = {
  versao_api: "2.0.0",
  empresa: "Rede FoodERP",
  cnpj: "00.000.000/0001-00",
  moeda: "BRL",
  fuso_horario: "America/Sao_Paulo",
  alertas: {
    estoque_critico_pct: 0,
    estoque_atencao_pct: 0.3,
    cmv_alerta_pct: 30,
    cmo_alerta_pct: 22,
  },
  integracoes: {
    ifood_webhook_url: "https://api.ifood.com.br/v3/merchant/webhooks",
    saipos_api_url: "https://api.saipos.com/v2",
    anthropic_model: "claude-sonnet-4-6",
  },
};

// ---------------------------------------------------------------------------
// 8. FUNCOES UTILITARIAS DO BANCO
// ---------------------------------------------------------------------------

function getEstoquePorLoja(loja_id) {
  return Object.values(insumos)
    .filter((i) => i.loja_id === loja_id)
    .map((i) => {
      const status =
        i.quantidade_atual < i.quantidade_minima ? "critico"
        : i.quantidade_atual < i.quantidade_minima * 1.3 ? "atencao"
        : "ok";
      return { ...i, status };
    });
}

function getFuncionariosPorLoja(loja_id) {
  return Object.values(funcionarios).filter((f) => f.loja_id === loja_id);
}

function getAlertasEstoque() {
  return Object.values(insumos)
    .map((i) => {
      const status =
        i.quantidade_atual < i.quantidade_minima ? "critico"
        : i.quantidade_atual < i.quantidade_minima * 1.3 ? "atencao"
        : "ok";
      return { ...i, status };
    })
    .filter((i) => i.status !== "ok")
    .sort((a, b) => (a.quantidade_atual / a.quantidade_minima) - (b.quantidade_atual / b.quantidade_minima));
}

/**
 * Abate quantidade de um insumo apos uma venda.
 * Retorna { sucesso, saldo_restante, alerta }
 */
function abaterEstoque(insumo_id, loja_id, quantidade) {
  const chave = `${insumo_id}_${loja_id}`;
  const item = insumos[chave];
  if (!item) return { sucesso: false, erro: `Insumo '${chave}' nao encontrado.` };
  if (item.quantidade_atual < quantidade) {
    return { sucesso: false, erro: `Estoque insuficiente: ${item.quantidade_atual} ${item.unidade} disponiveis.` };
  }
  item.quantidade_atual = Math.max(0, +(item.quantidade_atual - quantidade).toFixed(3));
  item.status =
    item.quantidade_atual < item.quantidade_minima ? "critico"
    : item.quantidade_atual < item.quantidade_minima * 1.3 ? "atencao"
    : "ok";
  const alerta = item.status !== "ok"
    ? { nivel: item.status, mensagem: `${item.nome} em ${item.status.toUpperCase()} -- saldo: ${item.quantidade_atual} ${item.unidade}` }
    : null;
  return { sucesso: true, saldo_restante: item.quantidade_atual, alerta };
}

// ---------------------------------------------------------------------------
// 9. FILA DE NOTIFICACOES DO GERENTE
// ---------------------------------------------------------------------------
const notificacoes_gerente = [];
let _notif_counter = 1;

/**
 * Cria e enfileira uma notificacao para o painel do gerente.
 */
function criarNotificacao({ loja_id, tipo, nivel = "info", titulo, mensagem, acao = null }) {
  const notif = {
    id: `notif_${_notif_counter++}`,
    loja_id,
    tipo,
    nivel,  // "info" | "atencao" | "critico"
    titulo,
    mensagem,
    acao,   // { label, endpoint, payload } -- para botao de acao em 1 clique
    ts: new Date().toISOString(),
    lida: false,
  };
  notificacoes_gerente.unshift(notif);
  if (notificacoes_gerente.length > 100) notificacoes_gerente.pop();
  console.log(`[NOTIF] [${nivel.toUpperCase()}] ${titulo}`);
  return notif;
}

/**
 * Retorna notificacoes filtradas por loja e/ou status de leitura.
 */
function getNotificacoes(loja_id, opcoes = {}) {
  // Aceita: getNotificacoes() | getNotificacoes(loja_id) | getNotificacoes(null, {limit, apenasNaoLidas})
  if (typeof loja_id === 'object' && loja_id !== null) { opcoes = loja_id; loja_id = null; }
  const { apenasNaoLidas = false, limit = 100 } = opcoes;
  let lista = loja_id
    ? notificacoes_gerente.filter((n) => n.loja_id === loja_id)
    : [...notificacoes_gerente];
  if (apenasNaoLidas) lista = lista.filter((n) => !n.lida);
  return lista.slice(0, limit);
}

function marcarTodasNotificacoesLidas(loja_id) {
  notificacoes_gerente
    .filter(n => !loja_id || n.loja_id === loja_id)
    .forEach(n => { n.lida = true; });
  return true;
}

/**
 * Marca uma notificacao como lida.
 */
function marcarNotificacaoLida(notif_id) {
  const n = notificacoes_gerente.find((n) => n.id === notif_id);
  if (n) n.lida = true;
  return !!n;
}

// ---------------------------------------------------------------------------
// 10. MOTOR 1 -- processarVenda()
// ---------------------------------------------------------------------------

/**
 * Processa uma venda: valida ingredientes, abate estoque, atualiza KPIs da loja
 * e dispara notificacoes de alerta quando necessario.
 *
 * Estrategia "all-or-nothing": verifica TODOS os insumos antes de abater qualquer um.
 *
 * @param {object} params
 * @param {string} params.prato_id    - ID do prato vendido
 * @param {string} params.loja_id     - Loja onde ocorreu a venda
 * @param {number} [params.quantidade=1] - Quantas unidades vendidas
 * @param {string} [params.origem="manual"] - "ifood" | "saipos" | "manual"
 * @param {string} [params.pedido_id] - ID externo do pedido (iFood/Saipos)
 * @returns {object} Resultado completo da operacao
 */
function processarVenda({ prato_id, loja_id, quantidade = 1, origem = "manual", pedido_id = null }) {
  const prato = cardapio[prato_id];
  const loja  = lojas[loja_id];

  // Validacoes iniciais
  if (!prato) return { sucesso: false, erro: `Prato '${prato_id}' nao encontrado no cardapio.` };
  if (!loja)  return { sucesso: false, erro: `Loja '${loja_id}' nao encontrada.` };
  if (!prato.disponivel) return { sucesso: false, erro: `Prato '${prato.nome}' indisponivel no momento.` };

  // Fase 1: Validar disponibilidade de TODOS os insumos (sem abater ainda)
  const errosEstoque = [];
  for (const item of prato.insumos_necessarios) {
    const chave = `${item.insumo_id}_${loja_id}`;
    const estoque = insumos[chave];
    if (!estoque) {
      errosEstoque.push(`Insumo '${item.insumo_id}' nao cadastrado para ${loja.nome}.`);
      continue;
    }
    const qtd_necessaria = +(item.quantidade * quantidade).toFixed(3);
    if (estoque.quantidade_atual < qtd_necessaria) {
      errosEstoque.push(`${estoque.nome}: necessario ${qtd_necessaria}${item.unidade}, disponivel ${estoque.quantidade_atual}${item.unidade}.`);
    }
  }

  if (errosEstoque.length > 0) {
    return { sucesso: false, erro: "Estoque insuficiente para processar a venda.", detalhes: errosEstoque };
  }

  // Fase 2: Abater todos os insumos
  const relatorio_estoque = [];
  const alertas = [];

  for (const item of prato.insumos_necessarios) {
    const qtd_abater = +(item.quantidade * quantidade).toFixed(3);
    const resultado = abaterEstoque(item.insumo_id, loja_id, qtd_abater);
    relatorio_estoque.push({ insumo_id: item.insumo_id, abatido: qtd_abater, ...resultado });

    if (resultado.alerta) {
      alertas.push(resultado.alerta);

      // Dispara notificacao para o gerente
      criarNotificacao({
        loja_id,
        tipo: "estoque",
        nivel: resultado.alerta.nivel,
        titulo: `Estoque ${resultado.alerta.nivel.toUpperCase()}: ${insumos[`${item.insumo_id}_${loja_id}`]?.nome || item.insumo_id}`,
        mensagem: resultado.alerta.mensagem,
        acao: {
          label: "Ver Estoque",
          endpoint: `/api/estoque?loja_id=${loja_id}`,
          payload: null,
        },
      });
    }
  }

  // Fase 3: Atualizar KPIs da loja
  const cmv_venda = +(prato.cmv_unitario * quantidade).toFixed(2);
  const fat_venda  = +(prato.preco * quantidade).toFixed(2);

  loja.pedidos_hoje += 1;
  loja.faturamento_hoje = +((loja.faturamento_hoje || 0) + fat_venda).toFixed(2);
  loja.faturamento_mes_atual = +(loja.faturamento_mes_atual + fat_venda).toFixed(2);

  const fat_hoje = loja.faturamento_hoje;
  const cmv_acumulado_hoje = vendas_recentes
    .filter((v) => v.loja_id === loja_id && v.timestamp.startsWith(new Date().toISOString().slice(0, 10)))
    .reduce((acc, v) => acc + (cardapio[v.prato_id]?.cmv_unitario || 0) * v.quantidade, cmv_venda);

  loja.cmv_pct_hoje = fat_hoje > 0 ? +((cmv_acumulado_hoje / fat_hoje) * 100).toFixed(1) : 0;

  // Alerta de CMV alto
  if (loja.cmv_pct_hoje > loja.metas_mensais.cmv_max_pct) {
    criarNotificacao({
      loja_id,
      tipo: "cmv",
      nivel: "atencao",
      titulo: `CMV alto: ${loja.cmv_pct_hoje}% (meta: ${loja.metas_mensais.cmv_max_pct}%)`,
      mensagem: `O CMV da ${loja.nome} atingiu ${loja.cmv_pct_hoje}% hoje. Verifique os pratos com maior desperdicio.`,
      acao: { label: "Ver Relatorio CMV", endpoint: `/api/relatorio/cmv?loja_id=${loja_id}`, payload: null },
    });
  }

  // Fase 4: Registrar venda no log
  const venda = {
    id: pedido_id || `venda_${Date.now()}`,
    loja_id,
    origem,
    prato_id,
    prato_nome: prato.nome,
    quantidade,
    valor_total: fat_venda,
    cmv_total: cmv_venda,
    timestamp: new Date().toISOString(),
    status: "novo",
  };
  vendas_recentes.unshift(venda);
  if (vendas_recentes.length > 200) vendas_recentes.pop();

  console.log(`[VENDA] ${prato.nome} x${quantidade} -- R$${fat_venda} -- CMV R$${cmv_venda} -- Origem: ${origem}`);

  return {
    sucesso: true,
    venda,
    relatorio_estoque,
    alertas,
    cmv_venda,
    fat_acumulado: loja.faturamento_hoje,
    cmv_pct_hoje: loja.cmv_pct_hoje,
  };
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
module.exports = {
  lojas,
  funcionarios,
  insumos,
  fornecedores,
  cardapio,
  vendas_recentes,
  config,
  notificacoes_gerente,
  // Consultas
  getEstoquePorLoja,
  getFuncionariosPorLoja,
  getAlertasEstoque,
  getNotificacoes,
  // Mutacoes
  abaterEstoque,
  processarVenda,
  criarNotificacao,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
};
