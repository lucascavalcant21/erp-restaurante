// AUDITORIA DO INTELLIGENCE CORE — todo pedido, consulta, recomendação,
// proposta, confirmação e execução vira um evento persistido, com o
// correlation id que liga a cadeia inteira:
//   pedido → intenção → dados consultados → recomendação → ação proposta →
//   confirmação → execução → resultado/erro (+ antes/depois da entidade)
//
// Nunca entra: token, chave de API, senha/PIN, CPF, cartão. Texto do usuário
// é guardado com esses padrões mascarados e com tamanho limitado. Dados
// consultados entram como DESCRIÇÃO da consulta (tabela, filtros, nº de
// linhas), não como as linhas.

const LIMITE_TEXTO = 500;

const PADROES = [
  [/\b(sk-ant-[A-Za-z0-9_\-]{6,})/g, "[chave-removida]"],
  [/\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{5,}/g, "[token-removido]"],
  [/\b(bearer)\s+[A-Za-z0-9._\-]{8,}/gi, "$1 [token-removido]"],
  [/\b(senha|password|pin|token|segredo|secret)\s*[:=]?\s*\S+/gi, "$1 [removido]"],
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf-removido]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[numero-removido]"],
];

export function redigir(texto) {
  let t = String(texto ?? "");
  for (const [re, sub] of PADROES) t = t.replace(re, sub);
  return t.length > LIMITE_TEXTO ? `${t.slice(0, LIMITE_TEXTO)}…` : t;
}

function limparConsultas(consultas = []) {
  return consultas.slice(0, 40).map((c) => ({
    tabela: c.tabela, linhas: c.linhas ?? null, erro: c.erro ?? null,
    filtros: (c.filtros || []).slice(0, 12).map((f) => f.map((x) => (typeof x === "string" ? x.slice(0, 60) : x))),
  }));
}

export const ETAPA_AUDITORIA = Object.freeze({
  PEDIDO: "pedido", CONSULTA: "consulta", RECOMENDACAO: "recomendacao", PROPOSTA: "acao_proposta",
  CONFIRMACAO: "acao_confirmada", CANCELAMENTO: "acao_cancelada", EXECUCAO: "acao_executada", FALHA: "acao_falhou",
  BLOQUEIO: "bloqueio", FEEDBACK: "feedback", BRIEF: "resumo_diario",
});

/**
 * Evento de auditoria. Tenant e usuário vêm SEMPRE do escopo do servidor.
 * @param {object} escopo   escopo autêntico
 * @param {object} e
 */
export function eventoDeAuditoria(escopo, e) {
  return {
    correlation_id: String(e.correlationId || "").slice(0, 80),
    request_id: String(escopo.requestId || "").slice(0, 80) || null,
    unidade_id: escopo.unidadeId,
    empresa_id: escopo.empresaId,
    auth_user_id: escopo.userId,
    usuario_erp_id: escopo.usuarioErpId,
    canal: e.canal || "web",
    etapa: e.etapa,
    comando: e.comando != null ? redigir(e.comando) : null,
    intencao: e.intencao ?? null,
    agentes: e.agentes ?? null,
    consultas: e.consultas ? limparConsultas(e.consultas) : null,
    recomendacao: e.recomendacao != null ? redigir(e.recomendacao) : null,
    acao_id: e.acaoId ?? null,
    acao_tipo: e.acaoTipo ?? null,
    risco: e.risco ?? null,
    entidade_tipo: e.entidadeTipo ?? null,
    entidade_id: e.entidadeId ?? null,
    antes: e.antes ?? null,
    depois: e.depois ?? null,
    resultado: e.resultado ?? null,
    erro: e.erro != null ? redigir(e.erro) : null,
    latencia_ms: Number.isFinite(e.latenciaMs) ? Math.round(e.latenciaMs) : null,
    provedor_ia: e.provedor ?? null,
    modelo_ia: e.modelo ?? null,
    tokens_entrada: e.tokensEntrada ?? null,
    tokens_saida: e.tokensSaida ?? null,
    fallback: e.fallback ?? null,
    created_at: (e.agora || new Date()).toISOString(),
  };
}

/** Grava sem derrubar a resposta de LEITURA (falha fica marcada). Ações usam exigirAuditoria. */
export async function auditar(store, escopo, e) {
  try {
    await store.registrarEvento(eventoDeAuditoria(escopo, e));
    return true;
  } catch {
    return false;
  }
}

/** Para ações: sem auditoria gravada, a ação não segue (falha fechada). */
export async function exigirAuditoria(store, escopo, e) {
  try {
    await store.registrarEvento(eventoDeAuditoria(escopo, e));
  } catch {
    const err = new Error("Auditoria indisponível: por segurança, nenhuma ação foi executada.");
    err.codigo = "AUDITORIA_INDISPONIVEL";
    throw err;
  }
}
