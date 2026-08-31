// Erro de "chunk" é o app aberto na versão antiga enquanto o servidor já tem a
// nova: o navegador pede um arquivo cujo nome tem o hash antigo e leva 404.
// Acontece toda vez que se publica com alguém com a tela aberta — e a pessoa
// não fez nada de errado, então a tela não pode culpá-la nem pedir gíria de
// programador ("limpe o cache", "Ctrl+Shift+R").

const SINAIS = [
  "loading chunk",
  "chunkloaderror",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
];

export function ehErroDeChunk(erro) {
  const texto = `${erro?.name || ""} ${erro?.message || erro || ""}`.toLowerCase();
  if (!texto.trim()) return false;
  return SINAIS.some(s => texto.includes(s));
}

// Quantas vezes vale recarregar antes de desistir e mostrar o botão.
//
// Recarregar em laço é pior que a falha: a tela pisca para sempre e a pessoa
// não consegue nem ler o que houve. Dois é o suficiente — se a segunda ainda
// falhou, o problema não é versão velha.
export const MAX_TENTATIVAS = 2;

/**
 * Decide se deve recarregar agora. Guarda a contagem no sessionStorage, que
 * morre junto com a aba: uma sessão nova volta a ter as duas chances.
 *
 * `armazem` é injetável para poder testar sem navegador.
 */
export function deveRecarregar(armazem, chave = "hefisto_reload_chunk", limite = MAX_TENTATIVAS) {
  if (!armazem) return false;          // sem storage, não arrisca laço
  try {
    const tentativas = Number(armazem.getItem(chave) || 0);
    if (!Number.isFinite(tentativas) || tentativas >= limite) return false;
    armazem.setItem(chave, String(tentativas + 1));
    return true;
  } catch {
    // Modo privativo pode recusar o storage. Sem onde contar, não recarrega:
    // melhor um botão do que um laço infinito.
    return false;
  }
}

/** Zera a contagem. Chamar quando a tela abrir bem, para a próxima vez ter as duas chances. */
export function limparTentativas(armazem, chave = "hefisto_reload_chunk") {
  try { armazem?.removeItem(chave); } catch { /* sem storage, nada a limpar */ }
}
