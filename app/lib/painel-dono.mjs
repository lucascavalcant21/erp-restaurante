// PAINEL DO DONO AO VIVO — contas puras do Início do dono (pedido do dono,
// 14/11/2026: "quanto o restaurante está vendendo, a meta que ele colocou,
// a previsão de bater a meta, o dinheiro caindo em cada venda, o desconto,
// o lucro e o imposto"; a meta "pode ser mensal, diária ou semanal").
//
// Regras do Héfisto: nada é inventado. Vendido e desconto são REAL (tabela
// vendas). Imposto e taxa da maquininha são ESTIMATIVA pela porcentagem que o
// dono configurou. Lucro é a margem de contribuição pelas fichas técnicas
// (ESTIMATIVA): item sem ficha fica fora e a tela diz quantos. Previsão é
// PROJEÇÃO pelo ritmo dos dias já vendidos. Dinheiro sempre em centavos
// arredondados no fim.

export const PERIODOS_META = Object.freeze([
  Object.freeze({ id: "dia", nome: "Diária", rotulo: "hoje" }),
  Object.freeze({ id: "semana", nome: "Semanal", rotulo: "nesta semana" }),
  Object.freeze({ id: "mes", nome: "Mensal", rotulo: "neste mês" }),
]);

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dataDe = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(a, m - 1, d); };

/** Meta guardada nos parâmetros da unidade: { periodo, valor } ou null. */
export function metaValida(meta) {
  const periodo = PERIODOS_META.find((p) => p.id === meta?.periodo)?.id;
  const valor = num(meta?.valor);
  return periodo && valor > 0 ? { periodo, valor: r2(valor) } : null;
}

/**
 * Dias da janela da meta: hoje; segunda a domingo; ou o mês. `passados`
 * conta hoje.
 */
export function janelaDaMeta(periodo, hojeIso) {
  const hoje = dataDe(hojeIso);
  let inicio = hoje; let fim = hoje;
  if (periodo === "semana") {
    const dow = (hoje.getDay() + 6) % 7; // segunda = 0
    inicio = new Date(hoje); inicio.setDate(hoje.getDate() - dow);
    fim = new Date(inicio); fim.setDate(inicio.getDate() + 6);
  } else if (periodo === "mes") {
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  }
  const dia = 86400000;
  return {
    periodo: PERIODOS_META.some((p) => p.id === periodo) ? periodo : "dia",
    inicio: isoDe(inicio),
    fim: isoDe(fim),
    dias: Math.round((fim - inicio) / dia) + 1,
    passados: Math.round((hoje - inicio) / dia) + 1,
  };
}

const cancelada = (v) => !!v?.cancelada_em || String(v?.status || "").toLowerCase().startsWith("cancel");
const ehCartao = (forma) => /cr[eé]dito|d[eé]bito|cart[aã]o|credit|debit/i.test(String(forma || ""));

/** Soma das vendas (tabela vendas), sem as canceladas. */
export function somarVendas(vendas = []) {
  let quantidade = 0; let bruto = 0; let desconto = 0; let total = 0; let cartao = 0;
  for (const v of vendas || []) {
    if (!v || cancelada(v)) continue;
    quantidade += 1;
    bruto += num(v.subtotal) + num(v.acrescimo) + num(v.taxa_servico);
    desconto += num(v.desconto);
    total += num(v.total);
    if (ehCartao(v.forma_pagamento)) cartao += num(v.total);
  }
  return {
    quantidade, bruto: r2(bruto), desconto: r2(desconto), total: r2(total), cartao: r2(cartao),
    ticket: quantidade > 0 ? r2(total / quantidade) : null,
  };
}

/** Imposto e taxa da maquininha (ESTIMATIVA pela % configurada; sem %, null). */
export function custosDaVenda({ total = 0, cartao = 0, impostoPct = 0, taxaCartaoPct = 0 } = {}) {
  return {
    imposto: num(impostoPct) > 0 ? r2((num(total) * num(impostoPct)) / 100) : null,
    taxaCartao: num(taxaCartaoPct) > 0 ? r2((num(cartao) * num(taxaCartaoPct)) / 100) : null,
  };
}

/**
 * Lucro das vendas pela margem de contribuição de cada produto (já sem
 * imposto e taxa, pela mesma conta da Pizza do prato). Item sem ficha com
 * custo fica fora: `semMargem` diz quantos.
 */
export function lucroPelasFichas(itens = [], margemPorProduto = new Map()) {
  let lucro = 0; let contados = 0; let semMargem = 0;
  for (const i of itens || []) {
    if (!i || i.status_kds === "cancelado") continue;
    const q = num(i.quantidade);
    if (!(q > 0)) continue;
    const m = margemPorProduto.get(i.produto_id);
    if (typeof m === "number") { lucro += q * m; contados += q; } else semMargem += q;
  }
  return { lucro: contados > 0 ? r2(lucro) : null, itensContados: contados, semMargem };
}

/**
 * Onde a meta está: quanto já foi, quanto falta e, para semana e mês, a
 * PROJEÇÃO pelo ritmo dos dias passados (com hoje). Meta diária não prevê:
 * o dia ainda está acontecendo.
 */
export function progressoDaMeta({ meta, vendido = 0, janela }) {
  const m = metaValida(meta);
  if (!m || !janela) return null;
  const v = r2(vendido);
  const pct = Math.min(100, Math.round((v / m.valor) * 100));
  const falta = r2(Math.max(0, m.valor - v));
  const restantes = Math.max(0, janela.dias - janela.passados);
  let previsto = null; let estado = v >= m.valor ? "batida" : "em_andamento";
  if (m.periodo !== "dia" && janela.passados >= Math.min(3, janela.dias)) {
    previsto = r2((v / janela.passados) * janela.dias);
    if (estado !== "batida") estado = previsto >= m.valor ? "vai_bater" : "nao_vai_bater";
  }
  return {
    meta: m.valor, periodo: m.periodo, vendido: v, pct, falta, previsto, estado, restantes,
    precisaPorDia: falta > 0 && restantes > 0 ? r2(falta / (restantes + 1)) : null,
  };
}

/**
 * Estratégias para chegar à meta (SUGESTÃO), a partir dos números reais:
 * o produto que mais deixa no bolso e o ticket médio.
 */
export function estrategiasDaMeta(progresso, { produtos = [], ticket = null } = {}) {
  if (!progresso || progresso.falta <= 0) return [];
  const saida = [];
  const melhor = produtos.filter((p) => p.margem > 0 && p.preco > 0).sort((a, b) => b.margem - a.margem)[0];
  if (melhor) {
    const unidades = Math.ceil(progresso.falta / melhor.preco);
    saida.push(`Ofereça mais ${melhor.nome}: é o que mais deixa no bolso. ${unidades} a mais cobrem o que falta.`);
  }
  if (ticket > 0) {
    const vendas = Math.ceil(progresso.falta / ticket);
    saida.push(`No ticket médio de hoje, faltam cerca de ${vendas} vendas para a meta.`);
  }
  if (progresso.precisaPorDia) saida.push(`Para chegar lá, a média precisa ser de ${progresso.precisaPorDia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por dia até o fim do período.`);
  return saida.slice(0, 3);
}
