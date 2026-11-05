// ENTRADA E SAÍDA DA MARMITARIA (pedido do dono, 05/11/2026): a marmitaria é
// uma unidade própria, com uma senha para entrar e sair. Dentro dela, o aparelho
// fica preso às telas da marmitaria. A trava é da tela; quem protege os dados
// é a separação por unidade no banco. Funções puras (testes em acesso.test.mjs).

export const UNIDADE_MARMITARIA = "marmitaria";
const CHAVE = "hefisto:marmitaria:dentro";

// O banco fala de "PIN"; aqui é a senha da marmitaria.
export function textoDaSenha(erro) {
  return String(erro || "Senha recusada.").replace("Senha incorreto", "Senha incorreta").replace("O Senha ficou bloqueado", "A senha ficou bloqueada")
    .replace("Senha bloqueado", "Senha bloqueada").replace("Senha incorreta. A senha", "Senha incorreta. A senha");
}

export const senhaValida = (s) => /^[0-9]{4,8}$/.test(String(s ?? ""));

export function ehRotaDaMarmitaria(caminho) {
  return caminho === "/dashboard/marmitaria" || String(caminho || "").startsWith("/dashboard/marmitaria/");
}

/** Dentro da marmitaria, qualquer outra tela volta para ela. */
export const rotaBloqueada = (dentro, caminho) => !!dentro && !ehRotaDaMarmitaria(caminho);

/**
 * Tela que a pessoa tentou abrir dentro da marmitaria. Depois da senha, ela segue
 * para lá. Só aceita caminho interno: o valor vem da URL.
 */
export function destinoDaSaida(valor) {
  const caminho = String(valor || "");
  if (!/^\/dashboard(\/|\?|$)/.test(caminho) || caminho.includes("//") || caminho.includes("\\")) return "/dashboard";
  return ehRotaDaMarmitaria(caminho.split("?")[0]) ? "/dashboard" : caminho;
}

/**
 * Unidade de quem está fora da marmitaria. Ela só abre pela senha: sem isso o
 * administrador, que não tem unidade principal, caía nela por ser a primeira da
 * lista, e o restaurante parecia sem funcionários.
 */
export function unidadeForaDaMarmitaria(unidades = [], ...preferidas) {
  const existe = (id) => id && id !== UNIDADE_MARMITARIA && unidades.some((u) => u.id === id);
  return preferidas.find(existe) || unidades.find((u) => u.id !== UNIDADE_MARMITARIA)?.id || preferidas.find(Boolean) || "";
}

export function lerEntrada(armazem) {
  try {
    const v = JSON.parse(armazem?.getItem(CHAVE) || "null");
    return v && typeof v === "object" ? v : null;
  } catch { return null; }
}

export function gravarEntrada(armazem, unidadeAnterior) {
  try { armazem?.setItem(CHAVE, JSON.stringify({ unidadeAnterior: unidadeAnterior || null })); } catch { /* segue na memória */ }
}

export function limparEntrada(armazem) {
  try { armazem?.removeItem(CHAVE); } catch { /* nada a limpar */ }
}
