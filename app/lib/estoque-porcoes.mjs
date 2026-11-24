// PORÇÕES DO ESTOQUE (dono, 24/11/2026): "100 unidades de frango empanado…
// dividi em 5 pacotes de 20"; "1 kg de lemon pepper… 10 pacotes de 100 g. Já
// vou saber que tenho o total, mas que ele está porcionado dessa forma."
//
// O saldo continua no estoque (estoque_itens, pelas RPCs). Aqui fica só COMO o
// saldo está dividido, por local e produto, em config_sistema.params.estoque_porcoes:
//   { "<estoque_id>:<insumo_id>": { linhas: [{ id, qtd, tamanho }], atualizado_em } }
// tamanho na unidade do saldo (kg, g, L, ml, un). Retirar uma porção pela tela
// do estoque desconta a porção daqui; se o saldo mudar por outro caminho, a tela
// avisa que a divisão não confere (nunca inventa a divisão nova).

const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const idNovo = () => `po-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const chavePorcao = (estoqueId, insumoId) => `${estoqueId}:${insumoId}`;

export function normalizarPorcoes(reg) {
  const linhas = (Array.isArray(reg?.linhas) ? reg.linhas : [])
    .map((l) => ({ id: l?.id || idNovo(), qtd: Math.max(0, Math.round(n(l?.qtd))), tamanho: r6(Math.max(0, n(l?.tamanho))) }))
    .filter((l) => l.qtd > 0 && l.tamanho > 0);
  // mesmas porções juntas (5 de 20 + 2 de 20 = 7 de 20), maiores primeiro
  const porTamanho = new Map();
  for (const l of linhas) {
    const atual = porTamanho.get(l.tamanho);
    if (atual) atual.qtd += l.qtd; else porTamanho.set(l.tamanho, { ...l });
  }
  return { linhas: [...porTamanho.values()].sort((a, b) => b.tamanho - a.tamanho), atualizado_em: reg?.atualizado_em || null };
}

export const totalPorcoes = (reg) => r6(normalizarPorcoes(reg).linhas.reduce((s, l) => s + l.qtd * l.tamanho, 0));

/** Confere a divisão com o saldo. { total, saldo, diferenca, confere } */
export function conferirPorcoes(reg, saldo) {
  const total = totalPorcoes(reg);
  const diferenca = r6(n(saldo) - total);
  return { total, saldo: r6(n(saldo)), diferenca, confere: Math.abs(diferenca) < 1e-6 };
}

/** Divide o saldo em porções iguais; o que sobra vira uma porção menor. */
export function dividirIgual(saldo, tamanho) {
  const s = n(saldo); const t = n(tamanho);
  if (!(s > 0) || !(t > 0)) return { linhas: [], erro: "Diga o saldo e o tamanho de cada porção." };
  const inteiras = Math.floor(r6(s / t));
  const sobra = r6(s - inteiras * t);
  const linhas = [];
  if (inteiras > 0) linhas.push({ id: idNovo(), qtd: inteiras, tamanho: r6(t) });
  if (sobra > 1e-6) linhas.push({ id: idNovo(), qtd: 1, tamanho: sobra });
  return { linhas, erro: null };
}

/**
 * Tira `quantidade` das porções: precisa ser k porções inteiras de um mesmo
 * tamanho. Devolve { reg, k, tamanho } ou null (não bate com nenhuma porção).
 */
export function retirarPorcoes(reg, quantidade) {
  const q = r6(n(quantidade));
  if (!(q > 0)) return null;
  const atual = normalizarPorcoes(reg);
  for (const l of atual.linhas) {
    const k = q / l.tamanho;
    if (Math.abs(k - Math.round(k)) < 1e-6 && Math.round(k) >= 1 && Math.round(k) <= l.qtd) {
      const kk = Math.round(k);
      const linhas = atual.linhas.map((x) => (x.id === l.id ? { ...x, qtd: x.qtd - kk } : x)).filter((x) => x.qtd > 0);
      return { reg: { linhas, atualizado_em: new Date().toISOString() }, k: kk, tamanho: l.tamanho };
    }
  }
  return null;
}

const fmt = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** "100 g", "0,5 kg" → mais legível: kg < 1 vira g; L < 1 vira ml. */
export function tamanhoLegivel(tamanho, unidade) {
  const u = String(unidade || "").toLowerCase();
  if (u === "kg" && tamanho < 1) return `${fmt(r6(tamanho * 1000))} g`;
  if (u === "l" && tamanho < 1) return `${fmt(r6(tamanho * 1000))} ml`;
  return `${fmt(tamanho)} ${u === "l" ? "L" : unidade || ""}`.trim();
}

/** "5 pacotes de 20 un + 1 pacote de 15 un" */
export function textoPorcoes(reg, unidade, nome = "pacote") {
  const { linhas } = normalizarPorcoes(reg);
  if (!linhas.length) return "";
  return linhas.map((l) => `${l.qtd} ${l.qtd === 1 ? nome : `${nome}s`} de ${tamanhoLegivel(l.tamanho, unidade)}`).join(" + ");
}
