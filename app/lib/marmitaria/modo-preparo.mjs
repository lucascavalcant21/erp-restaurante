// Modo de preparo do pré-preparo (dono, 17/11/2026): um passo por linha, sempre
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
