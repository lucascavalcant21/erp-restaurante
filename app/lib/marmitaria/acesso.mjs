// A marmitaria é um negócio à parte, com unidade própria no banco. O acesso é
// pelo login: o dono escolhe as páginas de cada usuário em Configurações >
// Usuários (decisão do dono, 05/11/2026). A senha única da marmitaria saiu.
// As telas da marmitaria usam sempre esta unidade, sem trocar a unidade do app.

export const UNIDADE_MARMITARIA = "marmitaria";
const CHAVE_ANTIGA = "hefisto:marmitaria:dentro";

/**
 * Unidade do app ao abrir. Nunca a marmitaria, a não ser que seja a única que a
 * pessoa enxerga: o administrador, sem unidade principal, caía nela por ser a
 * primeira da lista, e o restaurante parecia sem funcionários.
 */
export function unidadeForaDaMarmitaria(unidades = [], ...preferidas) {
  const existe = (id) => id && id !== UNIDADE_MARMITARIA && unidades.some((u) => u.id === id);
  return preferidas.find(existe) || unidades.find((u) => u.id !== UNIDADE_MARMITARIA)?.id || preferidas.find(Boolean) || "";
}

/** Solta o aparelho que ficou preso na trava da senha. */
export function limparEntradaAntiga(armazem) {
  try { armazem?.removeItem(CHAVE_ANTIGA); } catch { /* nada a limpar */ }
}
