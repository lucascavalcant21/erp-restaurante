// Motor financeiro central do Héfisto — dinheiro em CENTAVOS inteiros.
// (Expansão Financeira, fase 2, autorizada pelo dono em 27/11/2026.)
//
// Regra: todo valor monetário dentro do motor é um inteiro de centavos; o
// ponto flutuante só aparece nos percentuais. Arredondar é sempre explícito:
// para cima quando a margem não pode cair (preço mínimo), meio-para-cima no
// resto. Valor ausente nunca vira zero: as funções devolvem null e quem chama
// diz DADOS INSUFICIENTES.

/** Reais (número ou "1.234,56") → centavos inteiros; vazio/ inválido → null. */
export function centavos(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  let n = valor;
  if (typeof n === "string") {
    const t = n.trim().replace(/^R\$\s*/i, "");
    if (!t) return null;
    // "1.234,56" (pt-BR) ou "1234.56"
    n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  }
  if (!Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 100);
}

/** Centavos → reais (número com 2 casas). */
export const reais = (c) => (c === null || c === undefined ? null : c / 100);

/** "R$ 23,41" */
export function textoReais(c) {
  if (c === null || c === undefined) return "—";
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Percentual (23 ou "23%") → fração (0.23); vazio → null. */
export function fracao(pct) {
  if (pct === null || pct === undefined || pct === "") return null;
  const n = typeof pct === "string" ? Number(pct.replace("%", "").replace(",", ".").trim()) : Number(pct);
  return Number.isFinite(n) ? n / 100 : null;
}

/** Centavos × fator, meio-para-cima (0,5 centavo sobe). */
export function multiplicar(c, fator) {
  if (c === null || fator === null || fator === undefined) return null;
  return Math.round(c * fator + 1e-9);
}

/** Valor exato em centavos (fração) → centavo de cima: nunca reduz a margem. */
export const centavoDeCima = (exato) => Math.ceil(exato - 1e-9);

/**
 * Preço comercial: o primeiro preço ≥ mínimo cujos centavos estão em `finais`
 * (padrão ,90). Ex.: 23,41 → 23,90; 23,95 → 24,90. Nunca abaixo do mínimo.
 */
export function precoComercial(minimoC, finais = [90]) {
  if (minimoC === null || !(minimoC > 0)) return null;
  const lista = [...new Set(finais.map((f) => Math.round(Number(f))))].filter((f) => f >= 0 && f <= 99).sort((a, b) => a - b);
  if (!lista.length) return minimoC;
  const real = Math.floor(minimoC / 100);
  for (const r of [real, real + 1]) {
    for (const f of lista) {
      const c = r * 100 + f;
      if (c >= minimoC) return c;
    }
  }
  return minimoC;
}
