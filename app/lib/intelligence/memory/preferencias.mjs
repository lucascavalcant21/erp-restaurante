// PREFERÊNCIAS DA UNIDADE — o que o Héfisto vigia e com que sensibilidade, e
// as METAS de faturamento. Poucas opções, de propósito: o padrão funciona bem
// sem ninguém configurar nada (todos os alertas ligados, sensibilidade normal,
// sem meta).
//
// Meta é digitada por gente. O sistema NUNCA inventa meta: sem meta mensal,
// semanal ou diária configurada, a Central mostra DADOS INSUFICIENTES. A partir
// da meta mensal, o sistema pode SUGERIR a distribuição por dia/semana — sempre
// com o selo SUGESTÃO, nunca como realizado.

import { s } from "../schemas/schema.mjs";
import { LIMIARES_PADRAO, limiares as limiaresValidos } from "../anomalies/baseline.mjs";

export const CATEGORIAS_ALERTA = Object.freeze(["estoque", "financeiro", "compras", "rh", "vendas"]);
export const ROTULO_CATEGORIA = Object.freeze({ estoque: "Estoque", financeiro: "Financeiro", compras: "Compras", rh: "RH", vendas: "Vendas" });
export const SENSIBILIDADES = Object.freeze(["baixa", "normal", "alta"]);

export const PREFERENCIAS_PADRAO = Object.freeze({
  alertas: Object.freeze(Object.fromEntries(CATEGORIAS_ALERTA.map((c) => [c, true]))),
  sensibilidade: "normal",
  metas: Object.freeze({ mensal: null, semanal: null, diaria: null }),
  limiares: Object.freeze({}),
});

const meta = () => s.opcional(s.number({ min: 1, max: 1e9 }));

/** O que a tela de configurações pode mandar (tudo opcional; o que vier substitui). */
export const preferenciasSchema = s.object({
  alertas: s.opcional(s.object(Object.fromEntries(CATEGORIAS_ALERTA.map((c) => [c, s.boolean()])))),
  sensibilidade: s.opcional(s.enum(SENSIBILIDADES)),
  metas: s.opcional(s.object({ mensal: meta(), semanal: meta(), diaria: meta() })),
});

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const numOuNull = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) || Number(v) <= 0 ? null : r2(v));

/** Linha do banco (intelligence_preferencias) → preferências completas, com padrão no que faltar. */
export function preferenciasDaLinha(linha) {
  const alertas = { ...PREFERENCIAS_PADRAO.alertas };
  if (linha?.alertas && typeof linha.alertas === "object") {
    for (const c of CATEGORIAS_ALERTA) if (typeof linha.alertas[c] === "boolean") alertas[c] = linha.alertas[c];
  }
  return Object.freeze({
    alertas: Object.freeze(alertas),
    sensibilidade: SENSIBILIDADES.includes(linha?.sensibilidade) ? linha.sensibilidade : "normal",
    metas: Object.freeze({
      mensal: numOuNull(linha?.meta_faturamento_mensal),
      semanal: numOuNull(linha?.meta_faturamento_semanal),
      diaria: numOuNull(linha?.meta_faturamento_diaria),
    }),
    limiares: Object.freeze(linha?.limiares && typeof linha.limiares === "object" ? { ...linha.limiares } : {}),
    atualizadoEm: linha?.updated_at || null,
  });
}

/** Preferências + alteração validada → linha a gravar (só colunas conhecidas). */
export function linhaDePreferencias(unidadeId, atual, mudanca, authUserId, agora = new Date()) {
  const p = atual || PREFERENCIAS_PADRAO;
  const alertas = { ...p.alertas, ...(mudanca.alertas || {}) };
  const metas = mudanca.metas ? { ...p.metas, ...mudanca.metas } : p.metas;
  return {
    unidade_id: unidadeId,
    alertas,
    sensibilidade: mudanca.sensibilidade || p.sensibilidade,
    meta_faturamento_mensal: numOuNull(metas.mensal),
    meta_faturamento_semanal: numOuNull(metas.semanal),
    meta_faturamento_diaria: numOuNull(metas.diaria),
    limiares: p.limiares || {},
    atualizado_por: authUserId,
    updated_at: agora.toISOString(),
  };
}

// Sensibilidade mexe nos limiares PERCENTUAIS e no desvio (z): "alta" avisa
// antes (limiar menor), "baixa" só avisa o que for grande. Limiar
// personalizado da unidade (limiares) continua valendo por cima.
const FATOR = { baixa: 1.5, normal: 1, alta: 0.7 };
const PERCENTUAIS = ["faturamentoQuedaPct", "faturamentoAltaPct", "comprasAltaPct", "perdasAltaPct", "precoVariacaoPct", "contagemDivergenciaPct", "contagemCriticaPct"];

export function limiaresDasPreferencias(prefs) {
  const f = FATOR[prefs?.sensibilidade] ?? 1;
  const base = { ...LIMIARES_PADRAO };
  for (const k of PERCENTUAIS) base[k] = Math.round(LIMIARES_PADRAO[k] * f * 10) / 10;
  base.faturamentoZ = Math.round(LIMIARES_PADRAO.faturamentoZ * (f === 1 ? 1 : f > 1 ? 4 / 3 : 0.8) * 100) / 100;
  base.cmvAltaPontos = Math.round(LIMIARES_PADRAO.cmvAltaPontos * f * 10) / 10;
  base.vencimentoDias = LIMIARES_PADRAO.vencimentoDias + (prefs?.sensibilidade === "alta" ? 2 : prefs?.sensibilidade === "baixa" ? -1 : 0);
  return limiaresValidos({ ...base, ...(prefs?.limiares || {}) });
}

/** O insight entra? (categoria desligada → não aparece). Módulo sem categoria (ex.: geral) sempre entra. */
export function alertaLigado(prefs, modulo) {
  if (!CATEGORIAS_ALERTA.includes(modulo)) return true;
  return prefs?.alertas?.[modulo] !== false;
}
