// Modo de preparo da base (dono, 17/11/2026): um passo por linha, sempre
// numerado ("1. …", "2. …"), no mesmo formato que o resto do Héfisto lê
// (treinamento, Green Dot, aulas). Linha em branco some; número digitado à mão
// é refeito na ordem.
export function numerarPassos(texto) {
  const linhas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return "";
  return linhas.map((l, i) => `${i + 1}. ${l.replace(/^(\d+\s*[.)º°-]\s*|[-•*]\s+)/, "").trim()}`).join("\n").slice(0, 4000);
}

/** "1. Refogar o alho — 1 a 2 min: …" → [{ n: 1, texto }] para mostrar em lista. */
export function passosDoPreparo(texto) {
  return String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l, i) => ({ n: i + 1, texto: l.replace(/^\d+\s*[.)º°-]\s*/, "") }));
}

/**
 * Soma dos ingredientes do lote, para ter uma base do rendimento (dono,
 * 17/11/2026: "conforme ponho as gramas e os ml, o sistema já calcula o peso").
 * g/kg somam como peso; ml/L entram como se fosse 1 g por ml (ESTIMATIVA, a
 * densidade real muda); unidades não entram e são contadas à parte.
 */
export function pesoDosIngredientes(itens = []) {
  let gramas = 0; let comMl = false; let semPeso = 0;
  for (const it of itens) {
    const q = Number(String(it?.qtd ?? "").replace(/\./g, "").replace(",", ".")) || 0;
    if (!(q > 0)) continue;
    const u = String(it?.un || "").toLowerCase();
    if (u === "g") gramas += q;
    else if (u === "kg") gramas += q * 1000;
    else if (u === "ml") { gramas += q; comMl = true; }
    else if (u === "l") { gramas += q * 1000; comMl = true; }
    else semPeso += 1;
  }
  return { gramas: Math.round(gramas * 10) / 10, estimativa: comMl, semPeso };
}
