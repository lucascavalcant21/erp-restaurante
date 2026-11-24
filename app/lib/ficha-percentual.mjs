// Quanto cada ingrediente pesa na receita, em % do peso total (dono, 24/11/2026:
// "esse peso aqui é tantos por cento da receita… entre parênteses").
// Peso: kg e g direto; L e ml contam 1 ml ≈ 1 g (ESTIMATIVA, avisada na tela).
// Unidade (un), embalagem e linha sem quantidade ficam fora da conta.

const FATOR_G = { g: 1, kg: 1000, mg: 0.001, ml: 1, l: 1000 };

export function gramasDaLinha(l) {
  if (!l || l.tipo === "embalagem") return null;
  const f = FATOR_G[String(l.unidade || "").toLowerCase()];
  const q = Number(l.quantidade);
  return f && Number.isFinite(q) && q > 0 ? q * f : null;
}

/** { pcts: [número|null por linha], totalG, temLiquido, foraDaConta } */
export function percentuaisDePeso(linhas = []) {
  const gramas = linhas.map(gramasDaLinha);
  const totalG = gramas.reduce((s, g) => s + (g || 0), 0);
  const temLiquido = linhas.some((l, i) => gramas[i] != null && /^(ml|l)$/i.test(String(l.unidade || "")));
  const foraDaConta = linhas.filter((l, i) => gramas[i] == null && l?.tipo !== "embalagem").length;
  const pcts = gramas.map((g) => (g != null && totalG > 0 ? (g / totalG) * 100 : null));
  return { pcts, totalG, temLiquido, foraDaConta };
}

export function textoPct(p) {
  if (p == null) return "";
  const casas = p < 10 ? 1 : 0;
  return `(${p.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%)`;
}

export function textoPeso(g) {
  if (!(g > 0)) return "";
  return g >= 1000 ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : `${Math.round(g).toLocaleString("pt-BR")} g`;
}
