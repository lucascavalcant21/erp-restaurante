// Nome das bases (pedido do dono, 23/11/2026): o que era "pré-preparo" agora se
// chama BASE, e o nome sempre termina com "(base)": "Arroz branco (base)".
// Assim a base nunca se confunde com o prato de mesmo nome ("Arroz branco").

const SUFIXO = /\s*(?:[-–·]\s*)?\(?\s*(?:base|pr[eé][ -]?preparo)\s*\)?\s*$/i;

/** "Arroz branco" ou "Arroz branco - base" → "Arroz branco (base)". Vazio fica vazio. */
export function nomeDeBase(nome) {
  const limpo = String(nome ?? "").replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  const sem = limpo.replace(SUFIXO, "").trim();
  return `${sem || limpo} (base)`;
}

/** "Arroz branco (base)" → "Arroz branco". */
export function nomeSemBase(nome) {
  const limpo = String(nome ?? "").replace(/\s+/g, " ").trim();
  return limpo.replace(SUFIXO, "").trim() || limpo;
}
