const db = require("./banco_de_dados");
const path = require("path");
const fs = require("fs");

let POLITICAS = {};
try {
  POLITICAS = JSON.parse(fs.readFileSync(path.join(__dirname, "politicas.json"), "utf8"));
} catch (e) {
  POLITICAS = {
    limites_financeiros: { compra_automatica_max_reais: 200 },
    permissoes: { ajustar_escala_automaticamente: true, alertar_fornecedor_estoque_critico: true },
    alertas: { estoque_critico_threshold_pct: 20, cmv_alto_threshold_pct: 38, ausencias_criticas_threshold: 2, pedidos_pico_threshold: 60 }
  };
}

const _log_atividades = [];
let _log_counter = 1;

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

function registrarLog({ tipo, nivel = "info", titulo, descricao, acao_executada = false, requer_aprovacao = false, dados = null }) {
  const entrada = {
    id: "log_" + (_log_counter++),
    tipo, nivel, titulo, descricao, acao_executada, requer_aprovacao,
    aprovado: requer_aprovacao ? null : true,
    dados, ts: new Date().toISOString()
  };
  _log_atividades.unshift(entrada);
  if (_log_atividades.length > 200) _log_atividades.pop();
  if (db.criarNotificacao) {
    db.criarNotificacao({
      loja_id: dados && dados.loja_id ? dados.loja_id : "rede",
      tipo, nivel,
      titulo: "[Heitor] " + titulo,
      mensagem: descricao,
      acao: requer_aprovacao ? { label: "Aprovar", log_id: entrada.id } : null
    });
  }
  return entrada;
}

function getLog(limit = 50) { return _log_atividades.slice(0, limit); }

function aprovarAcao(log_id) {
  const entrada = _log_atividades.find(l => l.id === log_id);
  if (!entrada) return { ok: false, erro: "Log nao encontrado" };
  entrada.aprovado = true;
  entrada.aprovado_em = new Date().toISOString();
  return { ok: true, entrada };
}

function rejeitarAcao(log_id, motivo = "") {
  const entrada = _log_atividades.find(l => l.id === log_id);
  if (!entrada) return { ok: false, erro: "Log nao encontrado" };
  entrada.aprovado = false;
  entrada.rejeitado_em = new Date().toISOString();
  entrada.motivo_rejeicao = motivo;
  return { ok: true, entrada };
}

const LIMITE = POLITICAS.limites_financeiros ? POLITICAS.limites_financeiros.compra_automatica_max_reais : 200;

// ── Gestão dinâmica de unidades ───────────────────────────────────────────────
let _unidades = (POLITICAS.unidades_ativas && POLITICAS.unidades_ativas.length)
  ? POLITICAS.unidades_ativas.map(u => ({ ...u }))
  : [
      { id: "loja_1", nome: "Seldeestrela",      status: "ativa", cor: "#6c63ff" },
      { id: "loja_2", nome: "Tico Tico Saladas", status: "ativa", cor: "#22c55e" },
      { id: "loja_3", nome: "Burguer",            status: "ativa", cor: "#f59e0b" }
    ];

const _CORES = ["#6c63ff","#22c55e","#f59e0b","#ef4444","#3b82f6","#a855f7","#ec4899","#14b8a6"];

function getUnidades() { return _unidades.slice(); }

function adicionarUnidade(nome) {
  if (!nome || !nome.trim()) return { ok: false, erro: "Nome obrigatorio" };
  const id = "loja_" + Date.now();
  const unidade = { id, nome: nome.trim(), status: "ativa", cor: _CORES[_unidades.length % _CORES.length] };
  _unidades.push(unidade);
  registrarLog({ tipo: "config", nivel: "info",
    titulo: "Unidade adicionada — " + unidade.nome,
    descricao: "Nova unidade '" + unidade.nome + "' adicionada ao grupo. Heitor ja iniciou monitoramento.",
    acao_executada: true, requer_aprovacao: false, dados: { unidade } });
  return { ok: true, unidade };
}

function renomearUnidade(id, novo_nome) {
  const u = _unidades.find(x => x.id === id);
  if (!u) return { ok: false, erro: "Unidade nao encontrada" };
  const nome_antigo = u.nome;
  u.nome = novo_nome.trim();
  registrarLog({ tipo: "config", nivel: "info",
    titulo: "Unidade renomeada — " + nome_antigo + " → " + u.nome,
    descricao: "Heitor atualizou o monitoramento para refletir o novo nome.",
    acao_executada: true, requer_aprovacao: false, dados: { id, nome_antigo, novo_nome: u.nome } });
  return { ok: true, unidade: u };
}

function removerUnidade(id) {
  const idx = _unidades.findIndex(x => x.id === id);
  if (idx === -1) return { ok: false, erro: "Unidade nao encontrada" };
  const [u] = _unidades.splice(idx, 1);
  registrarLog({ tipo: "config", nivel: "warning",
    titulo: "Unidade removida — " + u.nome,
    descricao: "Unidade '" + u.nome + "' removida do grupo. Heitor interrompeu o monitoramento.",
    acao_executada: true, requer_aprovacao: false, dados: { unidade: u } });
  return { ok: true, unidade: u };
}

function alterarStatusUnidade(id, status) {
  const u = _unidades.find(x => x.id === id);
  if (!u) return { ok: false, erro: "Unidade nao encontrada" };
  u.status = status;
  return { ok: true, unidade: u };
}

const SYSTEM_PROMPT = `Voce e o Heitor, Gerente Regional Autonomo do FoodERP.
- Monitora 3 unidades em tempo real: Seldeestrela (loja_1), Tico Tico Saladas (loja_2) e Burguer (loja_3)
- Age de forma autonoma dentro das politicas definidas
- Usa os nomes reais das unidades nas respostas, nunca 'loja_1', 'loja_2', 'loja_3'
- Respostas diretas com numeros reais, maximo 5 linhas
- Permissoes autonomas: ajustar escala, alertar fornecedor, notificar
- Precisa de aprovacao: remanejamento, compras acima de R$${LIMITE}
- Nunca executa: demissoes, fechamento de loja, mudanca de precos
- Quando agir, avisa: "Acao registrada no log."`;

function buildContexto() {
  const lojas        = toArray(db.lojas);
  const cardapio     = toArray(db.cardapio);
  const funcionarios = toArray(db.funcionarios);
  const insumos      = toArray(db.insumos);
  const vendas       = toArray(db.vendas_recentes);
  const notificacoes = db.getNotificacoes ? db.getNotificacoes() : [];

  const resumo_lojas = lojas.map(l => ({
    id: l.id, nome: l.nome,
    pedidos_hoje: l.pedidos_hoje || 0,
    faturamento_hoje: l.faturamento_hoje || 0,
    faturamento_mes: l.faturamento_mes_atual || 0,
    cmv_pct: l.cmv_pct_hoje || l.cmv_pct || 0
  }));

  const alertas_estoque = insumos
    .filter(i => i.quantidade_atual != null && i.quantidade_minima != null && i.quantidade_atual <= i.quantidade_minima)
    .map(i => i.nome)
    .slice(0, 5);

  const ausentes_hoje = funcionarios.filter(f =>
    f.ausencias && f.ausencias.some(a => a.data === new Date().toISOString().split("T")[0])
  ).map(f => ({ nome: f.nome, loja_id: f.loja_id, cargo: f.cargo }));

  return {
    lojas: resumo_lojas, alertas_estoque, ausentes_hoje,
    vendas_recentes: vendas.slice(0, 10),
    notificacoes_pendentes: notificacoes,
    log_recente: _log_atividades.slice(0, 5),
    timestamp: new Date().toISOString(),
    politicas: { limite_autonomo: LIMITE, permissoes: POLITICAS.permissoes || {} }
  };
}

function ajustarEscala(funcionario_ausente, loja_id) {
  if (!POLITICAS.permissoes || !POLITICAS.permissoes.ajustar_escala_automaticamente) return null;
  return registrarLog({
    tipo: "escala", nivel: "warning",
    titulo: "Escala ajustada — " + funcionario_ausente + " ausente",
    descricao: "Heitor identificou ausencia de " + funcionario_ausente + " na " + loja_id + " e iniciou busca por substituto.",
    acao_executada: true, requer_aprovacao: false,
    dados: { loja_id, funcionario: funcionario_ausente }
  });
}

function alertarFornecedor(insumo_nome, loja_id, quantidade_atual) {
  if (!POLITICAS.permissoes || !POLITICAS.permissoes.alertar_fornecedor_estoque_critico) return null;
  return registrarLog({
    tipo: "estoque", nivel: "critical",
    titulo: "Alerta de estoque critico — " + insumo_nome,
    descricao: "Heitor detectou estoque critico de " + insumo_nome + " (" + quantidade_atual + " un) na " + loja_id + ". Alerta enviado ao fornecedor.",
    acao_executada: true, requer_aprovacao: false,
    dados: { loja_id, insumo: insumo_nome, quantidade_atual }
  });
}

function sugerirRemanejamento(insumo_nome, loja_origem, loja_destino, quantidade) {
  return registrarLog({
    tipo: "remanejamento", nivel: "info",
    titulo: "Sugestao de remanejamento — " + insumo_nome,
    descricao: "Heitor sugere transferir " + quantidade + " un de " + insumo_nome + " de " + loja_origem + " para " + loja_destino + ". Aguardando aprovacao.",
    acao_executada: false, requer_aprovacao: true,
    dados: { insumo: insumo_nome, loja_origem, loja_destino, quantidade }
  });
}

const _triggers_disparados = new Set();

function verificarTriggers() {
  const ctx = buildContexto();
  const acoes = [];
  const hoje = new Date().toISOString().split("T")[0];
  const insumos = toArray(db.insumos);
  const lojas = ctx.lojas || [];

  insumos.forEach(ins => {
    if (ins.quantidade_atual == null || ins.quantidade_minima == null) return;
    if (ins.quantidade_atual <= ins.quantidade_minima) {
      const key = "estoque_" + ins.id + "_" + hoje;
      if (!_triggers_disparados.has(key)) {
        _triggers_disparados.add(key);
        const log = alertarFornecedor(ins.nome, ins.loja_id || "rede", ins.quantidade_atual);
        if (log) acoes.push(log);
      }
    }
  });

  const cmv_threshold = POLITICAS.alertas ? POLITICAS.alertas.cmv_alto_threshold_pct : 38;
  lojas.forEach(l => {
    if (l.cmv_pct > cmv_threshold) {
      const key = "cmv_" + l.id + "_" + hoje;
      if (!_triggers_disparados.has(key)) {
        _triggers_disparados.add(key);
        const log = registrarLog({
          tipo: "financeiro", nivel: "warning",
          titulo: "CMV alto — " + l.nome,
          descricao: "Heitor detectou CMV de " + l.cmv_pct.toFixed(1) + "% em " + l.nome + " (meta: " + cmv_threshold + "%).",
          acao_executada: true, requer_aprovacao: false,
          dados: { loja_id: l.id, cmv_pct: l.cmv_pct }
        });
        acoes.push(log);
      }
    }
  });

  const pico_threshold = POLITICAS.alertas ? POLITICAS.alertas.pedidos_pico_threshold : 60;
  lojas.forEach(l => {
    if (l.pedidos_hoje >= pico_threshold) {
      const key = "pico_" + l.id + "_" + hoje;
      if (!_triggers_disparados.has(key)) {
        _triggers_disparados.add(key);
        const log = registrarLog({
          tipo: "operacional", nivel: "info",
          titulo: "Pico de demanda — " + l.nome,
          descricao: "Heitor detectou " + l.pedidos_hoje + " pedidos hoje em " + l.nome + ". Recomendando reforco de equipe.",
          acao_executada: true, requer_aprovacao: false,
          dados: { loja_id: l.id, pedidos: l.pedidos_hoje }
        });
        acoes.push(log);
      }
    }
  });

  const ausencias_threshold = POLITICAS.alertas ? POLITICAS.alertas.ausencias_criticas_threshold : 2;
  if (ctx.ausentes_hoje && ctx.ausentes_hoje.length >= ausencias_threshold) {
    const key = "ausencias_" + hoje;
    if (!_triggers_disparados.has(key)) {
      _triggers_disparados.add(key);
      ctx.ausentes_hoje.forEach(f => {
        const log = ajustarEscala(f.nome, f.loja_id);
        if (log) acoes.push(log);
      });
    }
  }

  return acoes;
}

async function chatComHeitor(historico) {
  const contexto = buildContexto();
  const msgs = [
    { role: "user", content: "CONTEXTO DAS LOJAS:\n" + JSON.stringify(contexto, null, 2) },
    { role: "assistant", content: "Dados recebidos. Pronto para analisar e agir." },
    ...historico
  ];

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, system: SYSTEM_PROMPT, messages: msgs })
      });
      const data = await resp.json();
      if (data.content && data.content[0]) {
        return { resposta: data.content[0].text, simulado: false, modelo: "claude-sonnet-4-6" };
      }
    } catch (e) { console.error("Erro API Anthropic:", e.message); }
  }

  const ultima = historico[historico.length - 1];
  const pergunta = ultima ? ultima.content.toLowerCase() : "";
  return { resposta: gerarRespostaSimulada(pergunta, contexto), simulado: true, modelo: "simulado" };
}

function gerarRespostaSimulada(pergunta, ctx) {
  const lojas = ctx.lojas || [];
  const total_pedidos = lojas.reduce((s, l) => s + l.pedidos_hoje, 0);
  const total_fat = lojas.reduce((s, l) => s + l.faturamento_hoje, 0);

  if (pergunta.includes("estoque")) {
    const al = ctx.alertas_estoque || [];
    return al.length > 0
      ? "Heitor detectou " + al.length + " insumo(s) critico(s): " + al.join(", ") + ". Alertas enviados aos fornecedores. Acao registrada no log."
      : "Estoque dentro dos parametros em todas as lojas.";
  }
  if (pergunta.includes("faturamento") || pergunta.includes("vendas")) {
    return "Rede com R$" + total_fat.toFixed(2) + " hoje em " + total_pedidos + " pedidos. " + lojas.map(l => l.nome + ": R$" + l.faturamento_hoje.toFixed(2)).join(" | ") + ".";
  }
  if (pergunta.includes("rh") || pergunta.includes("falta") || pergunta.includes("ausencia")) {
    const ausentes = ctx.ausentes_hoje || [];
    return ausentes.length > 0
      ? ausentes.length + " ausencia(s) hoje. Heitor ja iniciou busca por substitutos. Acao registrada no log."
      : "Equipe completa em todas as unidades hoje.";
  }
  if (pergunta.includes("comparativo") || pergunta.includes("melhor")) {
    if (!lojas.length) return "Sem dados de lojas no momento.";
    const melhor = lojas.reduce((a, b) => a.faturamento_hoje > b.faturamento_hoje ? a : b);
    return "Melhor unidade hoje: " + melhor.nome + " com R$" + melhor.faturamento_hoje.toFixed(2) + " e " + melhor.pedidos_hoje + " pedidos.";
  }
  if (pergunta.includes("marketing") || pergunta.includes("estrategia")) {
    return "Com " + total_pedidos + " pedidos hoje, recomendo campanha de fidelidade no horario de baixo movimento (14h-17h). Desconto de 10% pode aumentar volume em 25%.";
  }
  if (pergunta.includes("log") || pergunta.includes("atividade")) {
    const logs = _log_atividades.slice(0, 3);
    return logs.length === 0
      ? "Nenhuma acao autonoma registrada ainda. Monitorando a rede."
      : "Ultimas acoes: " + logs.map(l => "[" + l.tipo + "] " + l.titulo).join(" | ") + ".";
  }
  const al_txt = ctx.alertas_estoque && ctx.alertas_estoque.length > 0 ? ctx.alertas_estoque.length + " alertas de estoque." : "Estoque ok.";
  return "Rede: " + total_pedidos + " pedidos, R$" + total_fat.toFixed(2) + " hoje. " + al_txt + " Pergunte sobre estoque, faturamento, CMV, RH ou comparativo.";
}

async function gerarAnaliseRede() {
  const ctx = buildContexto();
  const lojas = ctx.lojas || [];
  return {
    resumo: {
      total_pedidos: lojas.reduce((s, l) => s + l.pedidos_hoje, 0),
      total_faturamento: lojas.reduce((s, l) => s + l.faturamento_hoje, 0),
      alertas_estoque: (ctx.alertas_estoque || []).length,
      ausentes_hoje: (ctx.ausentes_hoje || []).length,
      acoes_pendentes: _log_atividades.filter(l => l.requer_aprovacao && l.aprovado === null).length
    },
    lojas, log_recente: _log_atividades.slice(0, 10), timestamp: ctx.timestamp
  };
}

module.exports = {
  chatComHeitor, chatComAgente: chatComHeitor,
  gerarAnaliseRede, verificarTriggers, buildContexto,
  getLog, registrarLog, aprovarAcao, rejeitarAcao,
  ajustarEscala, alertarFornecedor, sugerirRemanejamento,
  getUnidades, adicionarUnidade, renomearUnidade, removerUnidade, alterarStatusUnidade,
  SYSTEM_PROMPT, POLITICAS
};
