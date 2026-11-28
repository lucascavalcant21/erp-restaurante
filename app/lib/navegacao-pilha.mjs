// Pilha das telas abertas na sessão, para o "voltar" levar à tela anterior de
// verdade (dono, 28/11/2026: "toda vez que apertar em voltar ele volta para a
// tela do administrador"). Guardada no sessionStorage pelo ERPContext.

export const LIMITE_PILHA = 30;

/** Nova pilha ao chegar em `atual`. Voltar (atual = penúltima) desempilha. */
export function atualizarPilha(pilha = [], atual = "") {
  const p = Array.isArray(pilha) ? pilha.filter((x) => typeof x === "string") : [];
  if (!atual || p[p.length - 1] === atual) return p;
  if (p[p.length - 2] === atual) return p.slice(0, -1);
  return [...p, atual].slice(-LIMITE_PILHA);
}

/** Há uma tela anterior do próprio app para onde voltar? */
export const temTelaAnterior = (pilha = []) => Array.isArray(pilha) && pilha.length >= 2;
