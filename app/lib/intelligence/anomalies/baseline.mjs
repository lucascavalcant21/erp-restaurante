// BASELINE PRÓPRIO DA EMPRESA — estatística simples, sem machine learning.
//
// Nada de régua universal ("CMV > 30% é ruim"): cada valor é comparado com a
// história DA PRÓPRIA unidade em períodos comparáveis (mesmo dia da semana,
// mesma janela da semana, mesmo produto). Sem amostras suficientes, o
// detector não dispara — diz que o histórico é insuficiente.

const r2 = (n) => Math.round(Number(n) * 100) / 100;

export function estatisticas(valores) {
  const xs = (valores || []).map(Number).filter(Number.isFinite);
  const n = xs.length;
  if (!n) return { n: 0, media: null, desvio: null, mediana: null };
  const media = xs.reduce((t, x) => t + x, 0) / n;
  const desvio = n > 1 ? Math.sqrt(xs.reduce((t, x) => t + (x - media) ** 2, 0) / (n - 1)) : 0;
  const ord = [...xs].sort((a, b) => a - b);
  const mediana = n % 2 ? ord[(n - 1) / 2] : (ord[n / 2 - 1] + ord[n / 2]) / 2;
  return { n, media, desvio, mediana };
}

/**
 * Compara `atual` com o histórico comparável.
 * @returns {{suficiente:boolean, n:number, media:number|null, desvio:number|null, diferenca:number|null, diferencaPct:number|null, z:number|null}}
 */
export function compararComBaseline(atual, historico, { minAmostras = 3 } = {}) {
  const e = estatisticas(historico);
  if (e.n < minAmostras || !Number.isFinite(Number(atual))) {
    return { suficiente: false, n: e.n, minimo: minAmostras, media: e.media, desvio: e.desvio, diferenca: null, diferencaPct: null, z: null };
  }
  const a = Number(atual);
  const diferenca = a - e.media;
  return {
    suficiente: true, n: e.n, minimo: minAmostras,
    media: r2(e.media), desvio: r2(e.desvio),
    diferenca: r2(diferenca),
    diferencaPct: e.media !== 0 ? r2((diferenca / Math.abs(e.media)) * 100) : null,
    z: e.desvio > 0 ? r2(diferenca / e.desvio) : null,
  };
}

/**
 * Desvio relevante? Os dois critérios precisam concordar: o tamanho relativo
 * (pct) e, quando há variação no histórico, a distância em desvios (z). Assim
 * uma oscilação normal da casa não vira alerta.
 */
export function desvioRelevante(b, { pctMin, zMin = 1.5, direcao = "ambas" }) {
  if (!b?.suficiente || b.diferencaPct == null) return false;
  const pctOk = direcao === "queda" ? b.diferencaPct <= -pctMin : direcao === "alta" ? b.diferencaPct >= pctMin : Math.abs(b.diferencaPct) >= pctMin;
  const zOk = b.z == null ? true : direcao === "queda" ? b.z <= -zMin : direcao === "alta" ? b.z >= zMin : Math.abs(b.z) >= zMin;
  return pctOk && zOk;
}

/**
 * Limiares padrão. São o PONTO DE PARTIDA: a unidade pode ajustar (memória /
 * preferências), e todos são relativos ao histórico próprio.
 */
export const LIMIARES_PADRAO = Object.freeze({
  minAmostras: 3,
  faturamentoQuedaPct: 20,
  faturamentoAltaPct: 20,
  faturamentoZ: 1.5,
  comprasAltaPct: 30,
  perdasAltaPct: 50,
  precoVariacaoPct: 10,
  contagemDivergenciaPct: 10,
  contagemCriticaPct: 25,
  cmvAltaPontos: 1,
  vencimentoDias: 3,
});

export function limiares(personalizados = {}) {
  const out = { ...LIMIARES_PADRAO };
  for (const [k, v] of Object.entries(personalizados || {})) {
    if (k in out && Number.isFinite(Number(v)) && Number(v) >= 0) out[k] = Number(v);
  }
  return Object.freeze(out);
}
