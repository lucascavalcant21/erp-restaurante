// MOTOR DE LUCRO HÉFISTO (pedido do dono, 05/11/2026): a lógica própria do
// sistema. Roda só no servidor, para a regra não ir no código do navegador.
// Recebe números já calculados, escolhe o que fazer primeiro e estima quanto
// vale. Cálculo determinístico: nenhum modelo de linguagem participa.
//
// Etapa 1: regras. O aprendizado com o resultado real entra quando houver
// histórico de vendas e de promoções.

if (typeof window !== "undefined") throw new Error("motor-lucro é só do servidor");

const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sinais = { alta: 3, media: 2, baixa: 1 };

// Com poucas vendas, a estimativa vale menos.
const confianca = (vendidas) => (vendidas >= 100 ? "alta" : vendidas >= 20 ? "media" : "baixa");

function mediana(lista) {
  const v = [...lista].sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * entrada: { metaPct, itens: [{ id, nome, preco, lucro, lucroPct, vendidas, precoParaMeta, lucroNoPrecoDaMeta }],
 *            combos: [{ id, nome, lucro, diferenca }], promocoes: [{ id, nome, rotulo, lucro, prejuizo, vezes }],
 *            mudancas: [{ insumoId, nome, subiu, pct, pratos: [{ id, nome, custoAntes, custoDepois }] }] }
 * As vendas são dos últimos 30 dias, então o impacto já é por mês.
 */
export function motorDeLucro({ metaPct = null, itens = [], combos = [], promocoes = [], mudancas = [] } = {}) {
  const meta = metaPct === null || metaPct === "" ? null : num(metaPct);
  const vendaPorId = new Map(itens.map((i) => [i.id, num(i.vendidas)]));
  const recs = [];
  const add = (r) => recs.push({ ...r, impactoMes: r.impactoMes == null ? null : r2(r.impactoMes) });

  for (const i of itens) {
    const vendidas = num(i.vendidas);
    const lucro = num(i.lucro);
    if (lucro < 0) {
      add({ id: `prejuizo-${i.id}`, tipo: "preco", titulo: `${i.nome} dá prejuízo`, motivo: `Cada pedido perde ${r2(-lucro)} reais.`,
        acao: i.precoParaMeta > 0 ? `Suba o preço para ${r2(i.precoParaMeta)} reais ou revise a ficha.` : "Revise o preço e a ficha.",
        impactoMes: vendidas > 0 ? -lucro * vendidas : null, confianca: confianca(vendidas), urgente: true });
      continue;
    }
    if (meta !== null && num(i.lucroPct) < meta && num(i.precoParaMeta) > num(i.preco)) {
      const ganho = num(i.lucroNoPrecoDaMeta) - lucro;
      add({ id: `preco-${i.id}`, tipo: "preco", titulo: `Ajuste o preço de ${i.nome}`, motivo: `Sobram ${r2(i.lucroPct)}% e a meta é ${r2(meta)}%.`,
        acao: `Passe de ${r2(i.preco)} para ${r2(i.precoParaMeta)} reais.`, impactoMes: vendidas > 0 ? ganho * vendidas : null, confianca: confianca(vendidas) });
    }
  }

  const vendas = itens.map((i) => num(i.vendidas));
  const medianaVendas = mediana(vendas);
  const margens = itens.map((i) => num(i.lucroPct));
  const medianaMargem = mediana(margens);
  if (vendas.some((v) => v > 0)) {
    for (const i of itens) {
      const vendidas = num(i.vendidas);
      if (num(i.lucroPct) > medianaMargem && vendidas < medianaVendas) {
        add({ id: `promover-${i.id}`, tipo: "destaque", titulo: `Destaque ${i.nome}`, motivo: "Dá mais lucro que a média e vende menos que os outros.",
          acao: "Coloque no topo do cardápio ou em um combo.", impactoMes: (medianaVendas - vendidas) * num(i.lucro), confianca: confianca(medianaVendas) });
      }
    }
  }

  for (const c of combos) {
    if (num(c.lucro) < 0) add({ id: `combo-${c.id}`, tipo: "combo", titulo: `Combo ${c.nome} dá prejuízo`, motivo: `Cada pedido perde ${r2(-num(c.lucro))} reais.`, acao: "Suba o preço ou troque um item.", impactoMes: null, confianca: "baixa", urgente: true });
  }
  for (const p of promocoes) {
    if (p.prejuizo) add({ id: `promo-${p.id}`, tipo: "promocao", titulo: `Tire ${p.rotulo} de ${p.nome}`, motivo: "Essa promoção dá prejuízo em cada pedido.", acao: "Use um desconto menor.", impactoMes: null, confianca: "baixa", urgente: true });
    else if (num(p.vezes) >= 2) add({ id: `promo-${p.id}`, tipo: "promocao", titulo: `Reveja ${p.rotulo} de ${p.nome}`, motivo: `Precisa vender ${r2(p.vezes)} vezes mais para empatar.`, acao: "Só mantenha se as vendas subirem nessa proporção.", impactoMes: null, confianca: "baixa" });
  }

  for (const m of mudancas) {
    if (!m.subiu) continue;
    const perda = (m.pratos || []).reduce((t, p) => t + (num(p.custoDepois) - num(p.custoAntes)) * (vendaPorId.get(`m-${p.id}`) || 0), 0);
    if (!(num(m.pct) >= 5)) continue;
    add({ id: `custo-${m.insumoId}`, tipo: "custo", titulo: `${m.nome} subiu ${r2(m.pct)}%`, motivo: `Afeta ${(m.pratos || []).length} prato(s).`, acao: "Procure outro fornecedor ou reveja o preço dos pratos.",
      impactoMes: perda > 0 ? perda : null, confianca: confianca(Math.max(0, ...(m.pratos || []).map((p) => vendaPorId.get(`m-${p.id}`) || 0))) });
  }

  // Urgente primeiro; depois o que vale mais dinheiro; sem estimativa fica por último.
  return recs.sort((a, b) => Number(!!b.urgente) - Number(!!a.urgente)
    || (b.impactoMes ?? -1) - (a.impactoMes ?? -1) || sinais[b.confianca] - sinais[a.confianca]).slice(0, 6);
}
