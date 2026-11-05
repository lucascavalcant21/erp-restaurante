// PAINEL DE LUCRO DA MARMITARIA (pedidos do dono, 05/11/2026): o que subiu ou
// caiu de custo e quanto isso mexeu no prato e no lucro; quais pratos, combos e
// promoções dão mais lucro; e sugestões de combinação para manter a média.
// Conta determinística sobre as linhas do Cardápio. Funções puras (testes em
// painel-lucro.test.mjs).

import { custoDaMarmita, precoSugerido, r2 } from "./nucleo.mjs";
import { precoNormalizadoDoInsumo } from "../ingredientes-utils.mjs";
import { MODELOS_COMBO, simularOferta } from "./promocoes.mjs";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pctDe = (antes, depois) => (antes > 0 ? r2(((depois - antes) / antes) * 100) : null);
const LIMITE_COMBINACOES = 3000;

function comPrecoAntigo(insumos, fichas, insumoId, precoAntigo) {
  const antigo = { ...insumos.get(insumoId), preco_normalizado: precoAntigo };
  const mapa = new Map(insumos);
  mapa.set(insumoId, antigo);
  // Pré-preparo guarda uma cópia do ingrediente dentro da ficha.
  const lista = fichas.map((f) => (!(f.fichas_ingredientes || []).some((i) => i.insumo_id === insumoId) ? f : {
    ...f, fichas_ingredientes: f.fichas_ingredientes.map((i) => (i.insumo_id === insumoId ? { ...i, insumos: { ...(i.insumos || antigo), preco_normalizado: precoAntigo } } : i)),
  }));
  return { insumos: mapa, fichas: lista };
}

/**
 * Cada insumo que mudou de preço no período, comparando o primeiro preço do
 * período com o de hoje, e o efeito em cada prato que o usa. O preço de venda
 * fica igual: a diferença de custo sai direto do lucro.
 */
export function mudancasDeCusto({ historico = [], marmitas = [], fichas = [], insumos = new Map(), linhas = [] } = {}) {
  const porInsumo = new Map();
  for (const h of historico || []) {
    if (!h?.insumo_id || !(num(h.preco_normalizado_anterior) > 0)) continue;
    if (!porInsumo.has(h.insumo_id)) porInsumo.set(h.insumo_id, []);
    porInsumo.get(h.insumo_id).push(h);
  }
  const lucroDe = new Map(linhas.filter((l) => l.secao === "marmitas" && l.ficha).map((l) => [l.ficha.id, l.lucro]));
  const custoCom = (m, ctx) => custoDaMarmita({ itens: m.itens, embalagens: m.embalagens, fichas: ctx.fichas, insumos: ctx.insumos }).total;
  const saida = [];
  for (const [insumoId, lista] of porInsumo) {
    const ins = insumos.get(insumoId);
    if (!ins) continue;
    const [primeiro] = lista;
    const ultimo = lista[lista.length - 1];
    const precoAntes = num(primeiro.preco_normalizado_anterior);
    const precoAgora = precoNormalizadoDoInsumo(ins);
    if (!(precoAgora > 0) || Math.abs(precoAgora - precoAntes) < 0.0001) continue;
    const antes = comPrecoAntigo(insumos, fichas, insumoId, precoAntes);
    const pratos = [];
    for (const m of marmitas) {
      if (m.ativo === false) continue;
      const custoDepois = custoCom(m, { insumos, fichas });
      const custoAntes = custoCom(m, antes);
      if (Math.abs(custoDepois - custoAntes) < 0.005) continue;
      const lucroDepois = lucroDe.get(m.id) ?? null;
      pratos.push({
        id: m.id, nome: m.nome_receita, custoAntes, custoDepois, custoPct: pctDe(custoAntes, custoDepois),
        lucroDepois, lucroAntes: lucroDepois === null ? null : r2(lucroDepois + custoDepois - custoAntes),
      });
    }
    if (!pratos.length) continue;
    // Mesma embalagem de compra: mostra o valor pago. Mudou o tamanho: compara por unidade.
    const mesmaCompra = num(primeiro.valor_anterior) > 0 && num(primeiro.embalagem_quantidade_anterior) === num(ultimo.embalagem_quantidade_nova);
    saida.push({
      insumoId, nome: ins.nome, embalagem: String(ins.tipo || "") === "embalagem" || String(ins.departamento || "") === "embalagens",
      valorAntes: mesmaCompra ? num(primeiro.valor_anterior) : precoAntes,
      valorAgora: mesmaCompra ? num(ultimo.valor_novo) : r2(precoAgora),
      porUnidade: !mesmaCompra, pct: pctDe(precoAntes, precoAgora), subiu: precoAgora > precoAntes,
      data: String(ultimo.created_at || "").slice(0, 10), pratos: pratos.sort((a, b) => Math.abs(b.custoDepois - b.custoAntes) - Math.abs(a.custoDepois - a.custoAntes)),
    });
  }
  return saida.sort((a, b) => Number(b.subiu) - Number(a.subiu) || Math.abs(b.pct) - Math.abs(a.pct));
}

/** Ranking de pratos, combos e promoções na plataforma escolhida. */
export function painelDeLucro({ linhas = [], vendas = [] } = {}) {
  const vendidas = new Map();
  for (const v of vendas || []) if (v?.ficha_id) vendidas.set(v.ficha_id, (vendidas.get(v.ficha_id) || 0) + num(v.quantidade));
  const pratos = linhas.filter((l) => l.secao === "marmitas" && l.lucro != null).map((l) => {
    const q = vendidas.get(l.ficha?.id) || 0;
    return { id: l.id, nome: l.nome, categoria: l.categoria, lucro: l.lucro, lucroPct: l.lucroPct, markup: l.markup, cmvPct: l.cmvPct, vendidas: q, ganho: q > 0 ? r2(q * l.lucro) : null };
  }).sort((a, b) => b.lucro - a.lucro);
  const vendidos = pratos.filter((p) => p.vendidas > 0);
  const pesoTotal = vendidos.reduce((t, p) => t + p.vendidas, 0);
  const mediaPct = !pratos.length ? null : pesoTotal > 0
    ? r2(vendidos.reduce((t, p) => t + p.lucroPct * p.vendidas, 0) / pesoTotal)
    : r2(pratos.reduce((t, p) => t + p.lucroPct, 0) / pratos.length);
  const comparar = (l) => ({
    id: l.id, nome: l.nome, rotulo: l.rotulo, lucro: l.lucro, lucroPct: l.lucroPct,
    lucroSem: l.sim?.sem?.lucro ?? null, diferenca: l.lucro != null && l.sim?.sem?.lucro != null ? r2(l.lucro - l.sim.sem.lucro) : null,
    vezes: l.sim?.vezesParaEmpatar ?? null, prejuizo: !!l.sim?.prejuizo,
  });
  const ordem = (a, b) => (b.lucro ?? -Infinity) - (a.lucro ?? -Infinity);
  return {
    pratos, mediaPct, mediaPonderada: pesoTotal > 0,
    maisGanho: [...vendidos].sort((a, b) => b.ganho - a.ganho),
    combos: linhas.filter((l) => l.secao === "combos" && l.lucro != null).map(comparar).sort(ordem),
    promocoes: linhas.filter((l) => l.secao === "promocoes" && l.lucro != null).map(comparar).sort(ordem),
  };
}

export const OFERTAS_PADRAO = [
  { id: "cheio", rotulo: "Sem promoção", oferta: { tipo: "nenhuma" } },
  { id: "d10", rotulo: "10% de desconto", oferta: { tipo: "desconto_pct", valor: 10 } },
  { id: "d20", rotulo: "20% de desconto", oferta: { tipo: "desconto_pct", valor: 20 } },
  { id: "3p2", rotulo: "3 por 2", oferta: { tipo: "leve_pague", leve: 3, pague: 2 } },
  { id: "2p1", rotulo: "2 por 1", oferta: { tipo: "leve_pague", leve: 2, pague: 1 } },
];

/** A mesma marmita em cada tipo de promoção, do que mais sobra para o que menos sobra. */
export function compararPromocoes({ item, comum }) {
  if (!item) return [];
  return OFERTAS_PADRAO.map((o) => {
    const s = simularOferta({ itens: [{ ...item, qtd: 1 }], oferta: o.oferta, ...comum });
    return { id: o.id, rotulo: o.rotulo, paga: s.com.pedido?.paga ?? null, unidades: s.com.pedido?.unidades ?? 1, lucro: s.com.lucro ?? null, lucroPct: s.com.lucroPct ?? null,
      lucroPorUnidade: s.com.lucro == null ? null : r2(s.com.lucro / (s.com.pedido?.unidades || 1)), prejuizo: s.prejuizo, vezes: o.id === "cheio" ? null : s.vezesParaEmpatar };
  }).sort((a, b) => (b.lucro ?? -Infinity) - (a.lucro ?? -Infinity));
}

function combinacoes(grupos, catalogo) {
  let lista = [[]];
  for (const g of grupos) {
    const opcoes = (catalogo[g] || []).filter((i) => i.preco > 0 && i.custo != null);
    const proxima = [];
    for (const atual of lista) {
      for (const o of opcoes) {
        // Duas vagas do mesmo grupo: itens diferentes e sem repetir a dupla invertida.
        const anterior = [...atual].reverse().find((x) => x.grupo === g);
        if (anterior && opcoes.indexOf(o) <= opcoes.findIndex((x) => x.id === anterior.id)) continue;
        if (proxima.length < LIMITE_COMBINACOES) proxima.push([...atual, { ...o, grupo: g }]);
      }
    }
    lista = proxima;
  }
  return lista;
}

/** Preço do combo que dá a margem-alvo, com equipe e custos fixos dentro do custo. */
function precoParaAlvo(itens, comum, alvoPct) {
  if (alvoPct == null) return null;
  const custo = itens.reduce((t, i) => t + i.custo, 0);
  const marmitas = itens.filter((i) => i.grupo === "marmita").length;
  const embutido = (comum.embutidos?.totalPorMarmita || 0) * marmitas;
  return precoSugerido({ custoTecnico: custo + embutido, canal: { ...comum.canal, itens_por_pedido: 1 }, tributosPct: comum.tributosPct, margemAlvoPct: alvoPct }).preco;
}

/**
 * Testa todas as combinações de um tipo de combo com o mesmo desconto sobre a
 * soma dos itens. `alvoPct` é a meta do dono ou, sem meta, a média dos pratos.
 */
export function sugerirCombos({ catalogo, modeloId, comum, descontoPct = 10, alvoPct = null, limite = 3 }) {
  const modelo = MODELOS_COMBO.find((m) => m.id === modeloId) || MODELOS_COMBO[0];
  const avaliadas = combinacoes(modelo.grupos, catalogo).map((itens) => {
    const soma = itens.reduce((t, i) => t + i.preco, 0);
    const preco = r2(Math.floor(soma * (1 - num(descontoPct) / 100) * 100) / 100);
    const s = simularOferta({ itens: itens.map((i) => ({ ...i, qtd: 1 })), oferta: { tipo: "preco_fixo", valor: preco }, ...comum });
    return {
      id: itens.map((i) => i.id).join("+"), modelo: modelo.id, itens, soma: r2(soma), preco, lucro: s.com.lucro ?? null, lucroPct: s.com.lucroPct ?? null,
      precoParaAlvo: precoParaAlvo(itens, comum, alvoPct),
      noAlvo: alvoPct != null && s.com.lucroPct != null && s.com.lucroPct >= num(alvoPct),
    };
  }).filter((c) => c.lucro != null).sort((a, b) => b.lucro - a.lucro);
  const melhores = avaliadas.slice(0, limite);
  const vistos = new Set(melhores.map((c) => c.id));
  // Só aponta a ruim se ela ficar abaixo do alvo, ou se der prejuízo.
  const piores = avaliadas.slice(-limite).reverse().filter((c) => !vistos.has(c.id) && (c.lucro < 0 || (alvoPct != null && !c.noAlvo)));
  return { total: avaliadas.length, melhores, piores };
}

/** No mesmo preço do combo, a troca de um item que mais aumenta o lucro. */
export function melhorTroca({ itens, preco, catalogo, comum }) {
  const lucroCom = (lista) => simularOferta({ itens: lista.map((i) => ({ ...i, qtd: 1 })), oferta: { tipo: "preco_fixo", valor: preco }, ...comum }).com.lucro ?? null;
  const atual = lucroCom(itens);
  if (atual === null) return null;
  let melhor = null;
  itens.forEach((sai, i) => {
    for (const entra of catalogo[sai.grupo] || []) {
      if (entra.custo == null || !(entra.preco > 0) || itens.some((x) => x.id === entra.id)) continue;
      const lucro = lucroCom(itens.map((x, j) => (j === i ? { ...entra, grupo: sai.grupo } : x)));
      if (lucro !== null && lucro - atual >= 0.01 && (!melhor || lucro > melhor.lucro)) melhor = { sai, entra, lucro, ganho: r2(lucro - atual) };
    }
  });
  return melhor;
}
