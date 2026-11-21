// Fila de gravações sem internet (dono, 21/11/2026: "usar o Héfisto offline,
// fazer cadastros e, quando se conectar, os dados se atualizam").
//
// Quando uma gravação falha por falta de rede, ela vai para a fila do aparelho
// (localStorage) e é reenviada, na ordem, quando a internet volta. Toda
// gravação que entra aqui precisa ser idempotente no banco (id ou chave
// gerados na tela) ou recusar a repetição (nome já cadastrado).

const CHAVE = "hefisto:fila-offline:v1";
const handlers = new Map();
const ouvintes = new Set();

const armazem = () => {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
};

export function lerFila() {
  try { return JSON.parse(armazem()?.getItem(CHAVE) || "[]"); } catch { return []; }
}
function gravarFila(fila) {
  try { armazem()?.setItem(CHAVE, JSON.stringify(fila)); } catch { /* aparelho sem espaço: a gravação segue em memória até recarregar */ }
  for (const f of ouvintes) { try { f(fila); } catch { /* ouvinte com erro não para a fila */ } }
}

/** Avisa a tela quando a fila muda. Devolve a função para parar de ouvir. */
export function ouvirFila(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

export const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** Erro de rede (não de regra): "Failed to fetch", "Sem conexão com o banco", timeout… */
export function erroDeRede(erro) {
  const m = String(erro?.message || erro || "");
  return /Failed to fetch|NetworkError|Load failed|fetch failed|network|timeout|Sem conexão com o banco/i.test(m);
}

export function registrar(tipo, fn) { handlers.set(tipo, fn); }

export function enfileirar({ tipo, args = [], rotulo = "" }) {
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tipo, args, rotulo, em: new Date().toISOString(), tentativas: 0 };
  gravarFila([...lerFila(), item]);
  return item;
}

/**
 * Envolve uma gravação: sem rede (ou erro de rede), guarda na fila e devolve
 * { error: null, offline: true }; com rede, grava na hora.
 */
export function comFila(tipo, fn, rotulo = "") {
  registrar(tipo, fn);
  return async (...args) => {
    const r1 = (texto) => (typeof rotulo === "function" ? rotulo(...args) : rotulo) || texto;
    if (offline()) { enfileirar({ tipo, args, rotulo: r1(tipo) }); return { error: null, offline: true }; }
    try {
      const r = await fn(...args);
      if (r?.error && erroDeRede(r.error)) { enfileirar({ tipo, args, rotulo: r1(tipo) }); return { ...r, error: null, offline: true }; }
      return r;
    } catch (e) {
      if (erroDeRede(e)) { enfileirar({ tipo, args, rotulo: r1(tipo) }); return { error: null, offline: true }; }
      throw e;
    }
  };
}

let enviando = null;
/**
 * Reenvia a fila na ordem. Para no primeiro erro de rede (tenta de novo
 * depois). Erro de regra (ex.: "já existe") não trava a fila: o item sai e
 * fica em `recusados` para a tela mostrar.
 */
export async function enviarFila() {
  if (enviando) return enviando;
  enviando = (async () => {
    let enviados = 0;
    const recusados = [];
    for (;;) {
      const fila = lerFila();
      if (!fila.length || offline()) break;
      const [item, ...resto] = fila;
      const fn = handlers.get(item.tipo);
      if (!fn) { gravarFila(resto); recusados.push({ ...item, erro: "Tipo de gravação desconhecido." }); continue; }
      let r;
      try { r = await fn(...(item.args || [])); } catch (e) { r = { error: e?.message || String(e) }; }
      if (r?.error && erroDeRede(r.error)) { gravarFila([{ ...item, tentativas: (item.tentativas || 0) + 1 }, ...resto]); break; }
      gravarFila(resto);
      if (r?.error && !/já existe|duplicate|idempotente/i.test(String(r.error))) recusados.push({ ...item, erro: String(r.error) });
      else enviados++;
    }
    return { enviados, recusados, pendentes: lerFila().length };
  })();
  try { return await enviando; } finally { enviando = null; }
}

// ─── Cópia da última leitura (para abrir as telas sem internet) ─────────────
const CHAVE_CACHE = (nome) => `hefisto:cache:${nome}`;
export function guardarCopia(nome, dados) {
  try { armazem()?.setItem(CHAVE_CACHE(nome), JSON.stringify({ em: new Date().toISOString(), dados })); } catch { /* sem espaço: segue sem cópia */ }
}
export function lerCopia(nome) {
  try { return JSON.parse(armazem()?.getItem(CHAVE_CACHE(nome)) || "null"); } catch { return null; }
}
