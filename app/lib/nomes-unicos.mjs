// Nome repetido (dono, 24/11/2026): "não permitir duas bases com o mesmo nome,
// nem dois ingredientes, pratos ou drinks". Compara sem acento, sem diferença
// de maiúscula e sem espaço sobrando. Nome que já existia repetido (cadastro
// antigo) ainda salva se não mudou; só não deixa criar nem renomear para um
// nome que já está em uso.

export function chaveDoNome(nome) {
  return String(nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * O primeiro item da lista com o mesmo nome (outro registro), ou null.
 * opcoes: { idAtual, nomeOriginal, campo = "nome" }
 */
export function nomeRepetido(nome, lista = [], { idAtual = null, nomeOriginal = null, campo = "nome" } = {}) {
  const chave = chaveDoNome(nome);
  if (!chave) return null;
  if (idAtual && nomeOriginal != null && chaveDoNome(nomeOriginal) === chave) return null;
  return (lista || []).find((x) => x && x.id !== idAtual && chaveDoNome(x[campo]) === chave) || null;
}

/** Grupos com o mesmo nome (para mostrar o que limpar). [{ nome, itens }] */
export function gruposRepetidos(lista = [], campo = "nome") {
  const m = new Map();
  for (const x of lista || []) {
    const k = chaveDoNome(x?.[campo]);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return [...m.values()].filter((g) => g.length > 1).map((itens) => ({ nome: itens[0][campo], itens }));
}
