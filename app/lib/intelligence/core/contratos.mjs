// HEFISTO INTELLIGENCE CORE — CONTRATOS DE RESPOSTA
//
// Regra que não se negocia: nenhum número sai do Intelligence Core sem dizer
// DE ONDE veio (fonte e consulta), DE QUANDO (período), DE QUEM (unidade/
// empresa), QUANTO DÁ PARA CONFIAR (completude e confiança) e QUANDO foi
// apurado. Sem base → "DADOS INSUFICIENTES", nunca um valor.
//
// E REAL, ESTIMATIVA, PROJEÇÃO e SIMULAÇÃO nunca se misturam: cada métrica
// carrega uma natureza só, e o contrato recusa um valor REAL sem fonte.

export const NATUREZA = Object.freeze({
  REAL: "REAL",               // apurado de registros do ERP
  ESTIMATIVA: "ESTIMATIVA",   // calculado sobre um parâmetro (ex.: custo médio, % configurado)
  PROJECAO: "PROJECAO",       // extrapolação no tempo
  SIMULACAO: "SIMULACAO",     // "e se" com valores informados — nunca gravado como realizado
});

export const ROTULO_NATUREZA = Object.freeze({
  REAL: "Real",
  ESTIMATIVA: "ESTIMATIVA",
  PROJECAO: "PROJEÇÃO",
  SIMULACAO: "SIMULAÇÃO",
});

export const CONFIANCA = Object.freeze({ ALTA: "alta", MEDIA: "media", BAIXA: "baixa", NENHUMA: "nenhuma" });

export const COBERTURA = Object.freeze({
  COMPLETOS: "completos",
  PARCIAIS: "parciais",
  INSUFICIENTES: "insuficientes",
});

export const ROTULO_COBERTURA = Object.freeze({
  completos: "Dados completos",
  parciais: "Dados parciais",
  insuficientes: "Dados insuficientes",
});

export const DADOS_INSUFICIENTES = "DADOS INSUFICIENTES";
export const FRASE_SEM_BASE = "Não possuo informação suficiente para calcular isso.";

export class ErroDeContrato extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroDeContrato";
  }
}

const NATUREZAS = new Set(Object.values(NATUREZA));
const CONFIANCAS = new Set(Object.values(CONFIANCA));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function congelarFundo(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) congelarFundo(v);
  }
  return o;
}

function periodoValido(p) {
  return p && ISO.test(String(p.de)) && ISO.test(String(p.ate)) && p.de <= p.ate;
}

function fontesValidas(fontes) {
  return Array.isArray(fontes) && fontes.length > 0 && fontes.every((f) => f && typeof f.tabela === "string" && f.tabela);
}

/**
 * Métrica apurada. Recusa (lança ErroDeContrato) qualquer valor sem a
 * procedência completa — é o que impede um número sem base de chegar à tela.
 *
 * @param {object} p
 * @param {string} p.metrica            id estável (ex.: "faturamento")
 * @param {number|null} p.valor
 * @param {string} p.unidade            "BRL" | "%" | "kg" | "un" | ...
 * @param {{de:string, ate:string, rotulo?:string}} p.periodo
 * @param {Array<{tabela:string, descricao?:string}>} p.fontes
 * @param {Array<object>} p.consultas   consultas executadas (tabela + filtros), para auditoria
 * @param {{unidadeId:string, empresaId:string|null}} p.escopo
 * @param {number} p.completude         0..1
 * @param {string} p.confianca          alta | media | baixa
 * @param {string} [p.natureza]         REAL (padrão) | ESTIMATIVA | PROJECAO | SIMULACAO
 * @param {string} p.apuradoEm          ISO datetime
 * @param {object|null} [p.comparacao]  { valor, periodo, diferenca, diferencaPct, natureza }
 * @param {string[]} [p.observacoes]
 * @param {object} [p.detalhes]
 */
export function metrica(p) {
  const erros = [];
  if (!p?.metrica) erros.push("metrica sem id");
  if (!Number.isFinite(p?.valor)) erros.push("valor não numérico (use insuficiente())");
  if (!p?.unidade) erros.push("sem unidade de medida");
  if (!periodoValido(p?.periodo)) erros.push("sem período válido");
  if (!fontesValidas(p?.fontes)) erros.push("sem fonte");
  if (!p?.escopo?.unidadeId) erros.push("sem unidade/empresa");
  if (!(Number.isFinite(p?.completude) && p.completude > 0 && p.completude <= 1)) erros.push("completude fora de (0, 1]");
  if (!CONFIANCAS.has(p?.confianca) || p.confianca === CONFIANCA.NENHUMA) erros.push("confiança inválida");
  const natureza = p?.natureza || NATUREZA.REAL;
  if (!NATUREZAS.has(natureza)) erros.push("natureza inválida");
  if (!p?.apuradoEm || Number.isNaN(Date.parse(p.apuradoEm))) erros.push("sem horário da apuração");
  if (p?.completude < 1 && !(p?.observacoes || []).length) erros.push("dado parcial sem explicação do que falta");
  if (p?.comparacao && p.comparacao.natureza && p.comparacao.natureza !== natureza) erros.push("comparação mistura naturezas");
  if (erros.length) throw new ErroDeContrato(`Métrica "${p?.metrica || "?"}" recusada: ${erros.join("; ")}.`);

  return congelarFundo({
    metrica: p.metrica,
    status: p.completude < 1 ? "parcial" : "ok",
    cobertura: p.completude < 1 ? COBERTURA.PARCIAIS : COBERTURA.COMPLETOS,
    valor: p.valor,
    unidade: p.unidade,
    natureza,
    periodo: { ...p.periodo },
    comparacao: p.comparacao ? { ...p.comparacao, natureza } : null,
    fontes: p.fontes.map((f) => ({ ...f })),
    consultas: (p.consultas || []).map((c) => ({ ...c })),
    escopo: { unidadeId: p.escopo.unidadeId, empresaId: p.escopo.empresaId ?? null },
    completude: Math.round(p.completude * 1000) / 1000,
    confianca: p.confianca,
    apuradoEm: p.apuradoEm,
    observacoes: [...(p.observacoes || [])],
    detalhes: p.detalhes ?? null,
  });
}

/**
 * "DADOS INSUFICIENTES". Nunca carrega valor — e diz o que falta.
 */
export function insuficiente({ metrica: id, motivo, faltando = [], periodo = null, fontes = [], consultas = [], escopo = null, apuradoEm, detalhes = null }) {
  if (!id) throw new ErroDeContrato("insuficiente() sem id da métrica.");
  if (!motivo) throw new ErroDeContrato(`insuficiente("${id}") sem motivo.`);
  return congelarFundo({
    metrica: id,
    status: "insuficiente",
    cobertura: COBERTURA.INSUFICIENTES,
    valor: null,
    rotulo: DADOS_INSUFICIENTES,
    motivo,
    faltando: [...faltando],
    periodo: periodo ? { ...periodo } : null,
    fontes: fontes.map((f) => ({ ...f })),
    consultas: consultas.map((c) => ({ ...c })),
    escopo: escopo ? { unidadeId: escopo.unidadeId, empresaId: escopo.empresaId ?? null } : null,
    confianca: CONFIANCA.NENHUMA,
    apuradoEm: apuradoEm || new Date().toISOString(),
    detalhes,
  });
}

/** O usuário não tem a permissão da tela de onde o dado vem: nem consulta. */
export function semPermissao({ metrica: id, capacidade, apuradoEm }) {
  return congelarFundo({
    metrica: id,
    status: "sem_permissao",
    cobertura: null,
    valor: null,
    motivo: `Você não tem permissão para consultar ${capacidade}.`,
    confianca: CONFIANCA.NENHUMA,
    apuradoEm: apuradoEm || new Date().toISOString(),
  });
}

export const ehInsuficiente = (m) => m?.status === "insuficiente";
export const ehSemPermissao = (m) => m?.status === "sem_permissao";
export const temValor = (m) => m && (m.status === "ok" || m.status === "parcial") && Number.isFinite(m.valor);

/** Confiança a partir da completude (regra única para todas as métricas). */
export function confiancaPorCompletude(completude, { minimoAlta = 1, minimoMedia = 0.8 } = {}) {
  if (!(completude > 0)) return CONFIANCA.NENHUMA;
  if (completude >= minimoAlta) return CONFIANCA.ALTA;
  if (completude >= minimoMedia) return CONFIANCA.MEDIA;
  return CONFIANCA.BAIXA;
}
