// Dinheiro no bolso (regra do dono, 06/11/2026): a meta de lucro é fixa. Vale em
// porcentagem do preço ou em reais. O que passa dela é a margem de segurança; o que
// falta para ela aparece como falta. Serve a Marmitaria, Restaurante e Eventos.

const r2 = (v) => Math.round(v * 100) / 100;
const num = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Em reais, a meta não muda com o preço; em porcentagem, acompanha o preço. */
export function metaEmReais({ preco, metaPct = null, metaReais = null } = {}) {
  const reais = num(metaReais);
  if (reais !== null && reais > 0) return r2(reais);
  const pct = num(metaPct);
  const p = num(preco);
  return pct !== null && pct >= 0 && p !== null && p > 0 ? r2(p * (pct / 100)) : null;
}

/** Quanto fica no bolso a esse preço, comparado à meta. Sem lucro calculado, não há número. */
export function noBolso({ lucro, preco, metaPct = null, metaReais = null } = {}) {
  const l = num(lucro);
  if (l === null) return null;
  const meta = metaEmReais({ preco, metaPct, metaReais });
  if (meta === null) return { lucro: r2(l), meta: null, margem: null, falta: null, estado: "sem_meta", rotuloMeta: null };
  const diferenca = r2(l - meta);
  return {
    lucro: r2(l), meta,
    margem: diferenca > 0 ? diferenca : 0,
    falta: diferenca < 0 ? r2(-diferenca) : 0,
    estado: l < 0 ? "prejuizo" : diferenca < 0 ? "abaixo" : "na_meta",
    // Só em reais (pedido do dono, 06/11/2026): "(25%)" ao lado de "R$ 25,00" confunde.
    rotuloMeta: "Meta de lucro",
  };
}
