// Porções no estoque (dono, 17/11/2026): "uso a mesma quantidade de queijo nas
// parmegianas (30 g); comprei 3 kg, o sistema já acusa que dá 100 porções; de
// frango, uma média de 11 porções; ele me dá a previsão do que comprar; no fim
// do dia faço a repesagem e dou baixa, e ele mostra quantas porções tenho".
//
// A porção vem das fichas técnicas das marmitas (consumoDaMarmita, a mesma
// conta da baixa de produção). Se o item entra com quantidades diferentes em
// marmitas diferentes, a porção é a mais usada (moda) e as outras aparecem
// como variação. Tudo em quantidade de SALDO (a unidade do estoque). Sem ficha
// usando o item, não há porção: DADOS INSUFICIENTES, nunca um número inventado.

import { consumoDaMarmita } from "./nucleo.mjs";

const r3 = (n) => Math.round(n * 1000) / 1000;

/** insumo_id → { porcao, usos: [{ marmita, quantidade }], variacoes: [quantidades] } (quantidade por 1 marmita). */
export function porcoesDosItens({ marmitas = [], fichas = [], insumos = new Map(), espelho = new Map() } = {}) {
  const usos = new Map();
  for (const m of marmitas) {
    if (m?.ativo === false) continue;
    const { precisa } = consumoDaMarmita({ marmita: m, quantidade: 1, fichas, insumos, espelho });
    for (const [id, a] of precisa) {
      if (!(a.q > 0)) continue;
      if (!usos.has(id)) usos.set(id, []);
      usos.get(id).push({ marmita: m.nome_receita || m.nome_comercial || "Marmita", marmitaId: m.id, quantidade: r3(a.q) });
    }
  }
  const out = new Map();
  for (const [id, lista] of usos) {
    const contagem = new Map();
    for (const u of lista) contagem.set(u.quantidade, (contagem.get(u.quantidade) || 0) + 1);
    const porcao = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    out.set(id, { porcao, usos: lista, variacoes: [...contagem.keys()].filter((q) => q !== porcao).sort((a, b) => a - b) });
  }
  return out;
}

/** saldo ÷ porção, com uma casa ("11,5 porções"). null quando não há porção. */
export function porcoesDoSaldo(saldo, porcao) {
  if (!(porcao > 0) || !Number.isFinite(Number(saldo))) return null;
  return Math.max(0, Math.floor((Number(saldo) / porcao) * 10) / 10);
}

/**
 * Quantas de cada marmita dá para montar com o estoque (a peça que acaba primeiro
 * manda) e o que comprar para chegar a uma meta de pratos.
 */
export function pratosPossiveis({ marmitas = [], fichas = [], insumos = new Map(), espelho = new Map(), saldo = new Map(), meta = null } = {}) {
  return marmitas.filter((m) => m?.ativo !== false).map((m) => {
    const { precisa, faltas } = consumoDaMarmita({ marmita: m, quantidade: 1, fichas, insumos, espelho });
    let pratos = Infinity; let limita = null;
    const comprar = [];
    for (const [id, a] of precisa) {
      if (!(a.q > 0)) continue;
      const tem = Number(saldo.get(id)) || 0;
      const d = Math.floor(tem / a.q + 1e-9);
      if (d < pratos) { pratos = d; limita = { insumoId: id, nome: a.nome, porcao: r3(a.q), saldo: r3(tem) }; }
      if (meta > 0 && tem < a.q * meta) comprar.push({ insumoId: id, nome: a.nome, falta: r3(a.q * meta - tem) });
    }
    if (!precisa.size || faltas.length) return { marmita: m, pratos: null, limita: null, comprar: [], motivo: faltas[0] || "Ficha técnica sem itens." };
    return { marmita: m, pratos: pratos === Infinity ? null : pratos, limita, comprar, motivo: null };
  });
}

/** Repesagem do fim do dia: o que baixar. Peso maior que o saldo não vira entrada (entrada vem de Compras). */
export function baixaDaRepesagem(saldo, pesado) {
  const s = Number(saldo) || 0; const p = Number(pesado);
  if (!Number.isFinite(p) || p < 0) return { erro: "Informe quanto pesou agora." };
  if (p > s + 1e-9) return { erro: `O peso (${p}) é maior que o saldo do sistema (${r3(s)}). Se chegou mercadoria, lance a entrada em Compras; depois repese.` };
  return { baixa: r3(s - p), erro: null };
}

/**
 * Quanto da base dá para FAZER com a matéria-prima do estoque (dono:
 * "60 g de sassami + trigo + panko + 30 g de água viram um frango empanado de
 * 144 g; com o trigo e o panko que tenho, dá para quantos frangos?"). A receita
 * é do lote (fichas_ingredientes, na unidade do cadastro) e rende
 * rendimento_porcoes na rendimento_unidade; o resultado sai nessa unidade.
 * Água e itens sem cadastro de estoque não limitam (não têm saldo controlado).
 */
export function producaoPossivelDoPreparo({ ficha, insumos = new Map(), saldo = new Map(), fatorSaldo = () => 1 } = {}) {
  const rend = Number(ficha?.rendimento_porcoes) || 0;
  if (!(rend > 0)) return { quantidade: null, limita: null, motivo: "A receita não diz quanto rende." };
  let melhor = Infinity; let limita = null;
  for (const fi of ficha?.fichas_ingredientes || []) {
    const ins = insumos.get(fi.insumo_id);
    const q = Number(fi.quantidade) || 0;
    if (!ins || !(q > 0)) continue;
    if (/^agua\b|^água\b/i.test(String(ins.nome || "").trim())) continue;
    const porUnidade = (q * fatorSaldo(ins)) / rend; // em saldo, por 1 unidade do rendimento
    const tem = Number(saldo.get(fi.insumo_id)) || 0;
    const da = Math.floor((tem / porUnidade) * 10) / 10;
    if (da < melhor) { melhor = da; limita = { insumoId: fi.insumo_id, nome: ins.nome, porUnidade: r3(porUnidade), saldo: r3(tem) }; }
  }
  if (melhor === Infinity) return { quantidade: null, limita: null, motivo: "A receita não tem ingredientes com estoque." };
  return { quantidade: Math.max(0, melhor), limita, motivo: null };
}
