// "R$ 7,83 · 12,63%" — valor em reais e quanto ele pesa sobre uma base (o
// preço de venda de um produto, o faturamento do mês). FONTE ÚNICA de conta e
// formato para todo o ERP: qualquer tela que mostre um custo ao lado da venda
// usa estas funções, para o mesmo número não sair com arredondamento diferente
// em cada lugar. Funções puras (testes em valor-percentual.test.mjs).

// Ausente não é zero: null, undefined e "" viram NaN (sem dado).
const num = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// Arredondamento financeiro em 2 casas, sem o erro de ponto flutuante de
// Math.round(x * 100) (1,005 virava 1,00).
export function arred2(v) {
  const n = num(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;
}

// Quanto `valor` representa de `base`, em %, com 2 casas. Base zero, negativa
// ou ausente não tem percentual: devolve null (a tela mostra "—"), em vez de
// Infinity ou 0% inventado.
export function percentualDe(valor, base) {
  const v = num(valor);
  const b = num(base);
  if (!Number.isFinite(v) || !Number.isFinite(b) || b <= 0) return null;
  return arred2((v / b) * 100);
}

// Diferença em pontos percentuais (23,77% − 15% = +8,77 p.p.).
export function diferencaPP(pct, metaPct) {
  const a = num(pct);
  const b = num(metaPct);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return arred2(a - b);
}

// ─── Formato pt-BR ──────────────────────────────────────────────────────────
// Espaço comum (não o NBSP do Intl) entre "R$" e o número: o texto fica igual
// em tela, PDF e teste.

export function fmtReais(v) {
  const n = num(v);
  if (!Number.isFinite(n)) return "—";
  const s = Math.abs(arred2(n)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 && arred2(n) !== 0 ? "-" : ""}R$ ${s}`;
}

export function fmtPct(p, casas = 2) {
  const n = num(p);
  if (p === null || p === undefined || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function fmtPP(pp) {
  const n = num(pp);
  if (pp === null || pp === undefined || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${s} p.p.`;
}

// "R$ 7,83 · 12,63%". Sem base válida, só o valor.
export function fmtValorPct(valor, base) {
  const p = percentualDe(valor, base);
  return p === null ? fmtReais(valor) : `${fmtReais(valor)} · ${fmtPct(p)}`;
}

// ─── Natureza do número ─────────────────────────────────────────────────────
// Todo valor de custo diz de onde veio. Rateio nunca aparece como se fosse
// custo direto daquele prato.
export const NATUREZA = {
  real: { id: "real", rotulo: "Real", ajuda: "Medido em dados do sistema." },
  calculado: { id: "calculado", rotulo: "Ficha técnica", ajuda: "Calculado pela ficha técnica." },
  estimado: { id: "estimado", rotulo: "Estimado", ajuda: "Estimativa a partir de dados do sistema." },
  rateado: { id: "rateado", rotulo: "Rateado", ajuda: "Custo do mês dividido pelos produtos; não é custo direto deste prato." },
  configurado: { id: "configurado", rotulo: "Configurado", ajuda: "Percentual ou valor informado nas configurações." },
};
