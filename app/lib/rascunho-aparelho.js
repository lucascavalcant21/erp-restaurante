// Rascunho no aparelho (dono, 17/11/2026: "o sistema atualiza e some a ficha
// que eu estava criando"). O que está sendo montado e ainda não foi salvo fica
// guardado neste aparelho a cada mudança; se a tela recarregar (atualização do
// app, puxar para atualizar, queda de conexão), volta do ponto onde parou.
// Some ao salvar ou ao cancelar. Validade: 7 dias. Só no navegador; erro de
// armazenamento nunca derruba a tela.

const PREFIXO = "hefisto:rascunho:";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export function guardarRascunho(chave, dados) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFIXO + chave, JSON.stringify({ em: Date.now(), dados }));
  } catch { /* sem espaço ou modo privado: segue sem rascunho */ }
}

export function lerRascunho(chave) {
  try {
    if (typeof window === "undefined") return null;
    const bruto = window.localStorage.getItem(PREFIXO + chave);
    if (!bruto) return null;
    const r = JSON.parse(bruto);
    if (!r || typeof r !== "object" || Date.now() - Number(r.em || 0) > VALIDADE_MS) { apagarRascunho(chave); return null; }
    return r.dados ?? null;
  } catch { return null; }
}

export function apagarRascunho(chave) {
  try { if (typeof window !== "undefined") window.localStorage.removeItem(PREFIXO + chave); } catch { /* idem */ }
}
