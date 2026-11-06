// O acesso à marmitaria é pelo login: o dono escolhe as páginas de cada usuário em
// Configurações > Usuários (decisão do dono, 05/11/2026). A senha única saiu.

export { UNIDADE_MARMITARIA } from "../negocios.mjs";

const CHAVE_ANTIGA = "hefisto:marmitaria:dentro";

/** Solta o aparelho que ficou preso na trava da senha. */
export function limparEntradaAntiga(armazem) {
  try { armazem?.removeItem(CHAVE_ANTIGA); } catch { /* nada a limpar */ }
}
