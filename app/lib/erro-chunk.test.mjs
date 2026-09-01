// Testes da recuperação de versão velha. O risco aqui não é falhar em
// reconhecer o erro — é recarregar em laço e deixar a tela piscando para
// sempre, que é pior que a falha original.
import { ehErroDeChunk, deveRecarregar, limparTentativas, MAX_TENTATIVAS } from "./erro-chunk.mjs";

let falhas = 0;
function conferir(nome, recebido, esperado) {
  const ok = String(recebido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `  (recebido ${recebido}, esperado ${esperado})`}`);
}

// Armazém de mentira, com a mesma cara do sessionStorage.
const memoria = (inicial = {}) => {
  const m = { ...inicial };
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    _ver: k => m[k],
  };
};

// ── Reconhecer o erro ──────────────────────────────────────────────────────
conferir("ChunkLoadError pelo nome", ehErroDeChunk({ name: "ChunkLoadError", message: "x" }), true);
conferir("a mensagem real da Vercel",
  ehErroDeChunk({ message: "Loading chunk 1954 failed. (error: https://.../layout-f67be.js)" }), true);
conferir("import dinamico que falhou",
  ehErroDeChunk({ message: "Failed to fetch dynamically imported module: /a.js" }), true);
conferir("string solta tambem vale", ehErroDeChunk("Loading chunk 12 failed"), true);

conferir("erro comum nao e de chunk", ehErroDeChunk({ message: "dinheiro is not defined" }), false);
conferir("erro sem mensagem nao e de chunk", ehErroDeChunk({}), false);
conferir("nulo nao e de chunk", ehErroDeChunk(null), false);
// "failed to fetch" sozinho e queda de rede, nao versao velha: recarregar nao
// resolve e a pessoa fica no laco enquanto a internet nao volta.
conferir("queda de rede nao conta como chunk", ehErroDeChunk({ message: "Failed to fetch" }), false);

// ── Não entrar em laço ─────────────────────────────────────────────────────
const s = memoria();
conferir("1a tentativa recarrega", deveRecarregar(s), true);
conferir("2a tentativa recarrega", deveRecarregar(s), true);
conferir(`na ${MAX_TENTATIVAS + 1}a desiste e mostra o botao`, deveRecarregar(s), false);
conferir("a contagem ficou registrada", s._ver("hefisto_reload_chunk"), String(MAX_TENTATIVAS));

limparTentativas(s);
conferir("depois de limpar, volta a ter as duas chances", deveRecarregar(s), true);

// Sem storage (modo privativo pode recusar): melhor botao que laco infinito.
conferir("sem armazem nao recarrega", deveRecarregar(null), false);
const quebrado = { getItem() { throw new Error("bloqueado"); }, setItem() {}, removeItem() {} };
conferir("armazem que estoura nao recarrega", deveRecarregar(quebrado), false);

// Valor sujo no storage nao pode virar recarga infinita.
conferir("contagem invalida nao recarrega", deveRecarregar(memoria({ hefisto_reload_chunk: "abc" })), false);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
