// Formatação das respostas: texto (tela e voz) montado SÓ a partir das
// métricas com contrato. Nenhum número aqui é calculado ou inventado — vem do
// Metrics Engine com fonte, período e confiança; "dados parciais" e "dados
// insuficientes" aparecem escritos, nunca escondidos.

import { DADOS_INSUFICIENTES, ROTULO_NATUREZA } from "../core/contratos.mjs";
import { ddmm } from "../core/periodos.mjs";

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v, casas = 3) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });
const sinal = (v) => (v > 0 ? "+" : "");

export function valorFormatado(m) {
  if (!m || m.valor == null) return null;
  switch (m.unidade) {
    case "BRL": return brl(m.valor);
    case "%": return `${num(m.valor, 1)}%`;
    case "lotes": return `${m.valor} lote(s)`;
    case "itens": return `${m.valor} item(ns)`;
    default: return `${num(m.valor)} ${m.unidade}`;
  }
}

export function comparacaoFormatada(m) {
  const c = m?.comparacao;
  if (!c) return null;
  if (c.unidadeDiferenca === "p.p.") return `${sinal(c.diferenca)}${num(c.diferenca, 1)} p.p. sobre ${c.periodo.rotulo} (${num(c.valor, 1)}%)`;
  const base = m.unidade === "BRL" ? brl(c.valor) : `${num(c.valor)} ${m.unidade}`;
  return `${c.diferencaPct != null ? `${sinal(c.diferencaPct)}${num(c.diferencaPct, 1)}%` : ""} em relação a ${c.periodo.rotulo} (${base})`.trim();
}

/** Uma frase sobre a métrica; DADOS INSUFICIENTES e sem permissão escritos por extenso. */
export function fraseDaMetrica(m, rotulo) {
  if (!m) return `${rotulo}: ${DADOS_INSUFICIENTES}.`;
  if (m.status === "sem_permissao") return `${rotulo}: ${m.motivo}`;
  if (m.status === "insuficiente") return `${rotulo}: ${DADOS_INSUFICIENTES}. ${m.motivo}`;
  const partes = [`${rotulo}: ${valorFormatado(m)}`];
  if (m.natureza && m.natureza !== "REAL") partes[0] += ` (${ROTULO_NATUREZA[m.natureza]})`;
  if (m.periodo?.rotulo) partes[0] += ` — ${m.periodo.rotulo}`;
  const cmp = comparacaoFormatada(m);
  if (cmp) partes.push(cmp);
  let t = `${partes.join(", ")}.`;
  if (m.status === "parcial") t = `Dados parciais. ${t}`;
  return t;
}

export const blocoMetrica = (m, rotulo) => ({ tipo: "metrica", rotulo, metrica: m });
export const blocoLista = (titulo, itens) => ({ tipo: "lista", titulo, itens: itens.filter(Boolean) });
export const blocoInsight = (insight) => ({ tipo: "insight", insight });
export const blocoTexto = (texto, qualificador = null) => ({ tipo: "texto", texto, qualificador });

export { brl, num, ddmm };
