// PROMOÇÕES E COMBOS DA MARMITARIA (pedido do dono, 28/10/2026): "combos de
// comida e bebida e de comida, bebida e sobremesa; ver, quando eu ponho
// desconto nas marmitas, meu lucro tirando todos os custos; simular 2 por 1".
//
// Tudo é simulação (nada grava venda): a conta do pedido reusa
// resultadoPorCanal (tributos, comissão, taxa de pagamento, taxa fixa e
// entrega do canal) e soma o rateio dos custos fixos em % do faturamento,
// que vem do Resultado do mês (ESTIMATIVA) ou é digitado. Funções puras
// (testes em promocoes.test.mjs).

import { resultadoPorCanal, normalizarCanal, r2 } from "./nucleo.mjs";
import { valorDoItem, depreciacaoMensal } from "../resultado-mes.mjs";

const n = (v) => {
  const x = Number(String(v ?? "").replace(/\./g, (m, i, s) => (s.includes(",") ? "" : m)).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const pos = (v) => Math.max(0, n(v));

/** Venda direta (balcão/WhatsApp sem taxa): vale quando nenhum canal foi configurado. */
export const CANAL_DIRETO = normalizarCanal({ id: "direto", nome: "Venda direta", comissao_pct: 0, taxa_pagamento_pct: 0 });

export const TIPOS_OFERTA = [
  { id: "nenhuma", rotulo: "Sem promoção" },
  { id: "desconto_pct", rotulo: "Desconto %" },
  { id: "desconto_rs", rotulo: "Desconto R$" },
  { id: "leve_pague", rotulo: "Leve X, pague Y" },
  { id: "preco_fixo", rotulo: "Preço do combo" },
];

/**
 * O que o cliente paga e o que sai da cozinha numa oferta.
 * itens: [{ nome, preco, custo, qtd }] (preço e custo por unidade).
 * oferta: { tipo, valor, leve, pague }.
 * "2 por 1" = leve 2, pague 1 (vale para cada item: o cliente leva `leve`
 * unidades de cada e paga `pague`).
 */
export function pedidoDaOferta(itens = [], oferta = {}) {
  const lista = (itens || []).map((i) => ({ ...i, preco: pos(i.preco), custo: i.custo == null ? null : pos(i.custo), qtd: Math.max(1, Math.round(pos(i.qtd) || 1)) }));
  const semCusto = lista.some((i) => i.custo == null);
  const cheio = lista.reduce((t, i) => t + i.preco * i.qtd, 0);
  const t = oferta?.tipo || "nenhuma";
  let unidades = lista.reduce((t2, i) => t2 + i.qtd, 0);
  let custo = lista.reduce((t2, i) => t2 + (i.custo || 0) * i.qtd, 0);
  let paga = cheio;
  let cheioDoQueLeva = cheio;
  if (t === "desconto_pct") paga = cheio * (1 - Math.min(100, pos(oferta.valor)) / 100);
  else if (t === "desconto_rs") paga = Math.max(0, cheio - pos(oferta.valor));
  else if (t === "preco_fixo") paga = pos(oferta.valor);
  else if (t === "leve_pague") {
    const leve = Math.max(1, Math.round(pos(oferta.leve) || 2));
    const pague = Math.min(leve, Math.max(0, Math.round(pos(oferta.pague) || 1)));
    // Cada item: leva `leve` × qtd, paga `pague` × qtd.
    unidades = lista.reduce((t2, i) => t2 + i.qtd * leve, 0);
    custo = lista.reduce((t2, i) => t2 + (i.custo || 0) * i.qtd * leve, 0);
    cheioDoQueLeva = lista.reduce((t2, i) => t2 + i.preco * i.qtd * leve, 0);
    paga = lista.reduce((t2, i) => t2 + i.preco * i.qtd * pague, 0);
  }
  return { cheio: r2(cheioDoQueLeva), paga: r2(paga), desconto: r2(Math.max(0, cheioDoQueLeva - paga)), custo: r2(custo), unidades, semCusto };
}

/** Pedido inteiro num canal: taxas do canal sobre o que o cliente paga, custo do que sai e o rateio dos fixos. */
export function lucroDoPedido({ paga, custo, canal = CANAL_DIRETO, tributosPct = null, fixosPct = null } = {}) {
  if (!(pos(paga) > 0)) return { valido: false, motivo: "O cliente não paga nada nessa oferta." };
  // O pedido inteiro conta como 1 "item" para a taxa fixa e a entrega.
  const r = resultadoPorCanal({ preco: paga, custoTecnico: custo, canal: { ...canal, itens_por_pedido: 1 }, tributosPct });
  if (!r.valido) return r;
  const fixos = fixosPct == null || fixosPct === "" ? null : r2(r.receita * pos(fixosPct) / 100);
  const lucro = r.margemContribuicao == null ? null : r2(r.margemContribuicao - (fixos || 0));
  return {
    ...r, fixos, fixosInformados: fixos != null,
    lucro, lucroPct: lucro == null || !(r.receita > 0) ? null : r2((lucro / r.receita) * 100),
  };
}

/**
 * Sem promoção × com promoção, e quantos pedidos a mais a promoção precisa
 * para dar o mesmo lucro em R$ que o preço cheio.
 */
export function simularOferta({ itens = [], oferta = {}, canal = CANAL_DIRETO, tributosPct = null, fixosPct = null } = {}) {
  const pSem = pedidoDaOferta(itens, { tipo: "nenhuma" });
  const pCom = pedidoDaOferta(itens, oferta);
  const sem = { pedido: pSem, ...lucroDoPedido({ paga: pSem.paga, custo: pSem.semCusto ? null : pSem.custo, canal, tributosPct, fixosPct }) };
  const com = { pedido: pCom, ...lucroDoPedido({ paga: pCom.paga, custo: pCom.semCusto ? null : pCom.custo, canal, tributosPct, fixosPct }) };
  let vezes = null;
  if (sem.valido && com.valido && sem.lucro != null && com.lucro != null) {
    if (com.lucro > 0 && sem.lucro > 0) vezes = r2(sem.lucro / com.lucro);
  }
  return { sem, com, vezesParaEmpatar: vezes, prejuizo: com.valido && com.lucro != null && com.lucro < 0, semCusto: pCom.semCusto };
}

/**
 * Custos fixos em % do faturamento, do Resultado do mês (custos fixos,
 * outros e depreciação ÷ faturamento). Não inclui a equipe (o CMO vem do RH
 * e tem tela própria). null = faltam dados. ESTIMATIVA.
 */
export function fixosPctDoResultado(todos = {}, mesRef = null) {
  const meses = Object.keys(todos || {}).filter((k) => /^\d{4}-\d{2}$/.test(k) && (!mesRef || k <= mesRef)).sort();
  const m = todos[meses[meses.length - 1]];
  if (!m) return null;
  const fat = n(m.faturamento);
  if (!(fat > 0)) return null;
  const soma = (l) => (l || []).reduce((t, it) => t + (valorDoItem(it) || 0), 0);
  const total = soma(m.itens?.fixos) + soma(m.itens?.outros) + (m.depreciacao || []).reduce((t, d) => t + depreciacaoMensal(d), 0);
  return total > 0 ? r2((total / fat) * 100) : null;
}

// ─── Combos ─────────────────────────────────────────────────────────────────

export const MODELOS_COMBO = [
  { id: "comida_bebida", rotulo: "Comida + bebida", grupos: ["marmita", "bebida"] },
  { id: "comida_bebida_sobremesa", rotulo: "Comida + bebida + sobremesa", grupos: ["marmita", "bebida", "sobremesa"] },
];
export const ROTULO_GRUPO = { marmita: "Comida", bebida: "Bebida", sobremesa: "Sobremesa" };

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ehSobremesa = (f) => /sobremesa|doce|bolo|pudim|mousse|torta|sorvete|acai/.test(semAcento(`${f.categoria} ${f.nome_receita} ${f.nome_comercial}`));

/**
 * Itens que podem entrar num combo, por grupo, com preço e custo por unidade.
 * marmitas: base.marmitas (com precos por canal); custos: Map id → { total }.
 * fichas: todas as fichas da unidade; custoFicha(f) → custo de uma porção.
 */
export function catalogoParaCombo({ marmitas = [], custos = new Map(), fichas = [], custoFicha = () => null, canalId = null } = {}) {
  const precoMarmita = (m) => (canalId && m.precos?.[canalId] != null ? n(m.precos[canalId]) : n(m.preco_venda));
  const marmita = (marmitas || []).filter((m) => m.ativo !== false).map((m) => ({ id: m.id, nome: m.nome_receita, preco: precoMarmita(m), custo: custos.get(m.id)?.total ?? null, grupo: "marmita" }));
  const vendaveis = (fichas || []).filter((f) => f && f.ativo !== false && !f.eh_base && f.departamento !== "marmitaria");
  const item = (f, grupo) => ({ id: f.id, nome: f.nome_comercial || f.nome_receita, preco: n(f.preco_venda), custo: custoFicha(f), grupo });
  const bebida = vendaveis.filter((f) => f.departamento === "bar").map((f) => item(f, "bebida"));
  const sobremesa = vendaveis.filter((f) => f.departamento !== "bar" && ehSobremesa(f)).map((f) => item(f, "sobremesa"));
  const ord = (l) => l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { marmita: ord(marmita), bebida: ord(bebida), sobremesa: ord(sobremesa) };
}

export function normalizarCombo(c = {}) {
  const modelo = MODELOS_COMBO.find((m) => m.id === c.modelo) || MODELOS_COMBO[0];
  return {
    id: String(c.id || `combo-${Math.random().toString(36).slice(2, 9)}`),
    nome: String(c.nome || "").trim().slice(0, 80),
    modelo: modelo.id,
    itens: modelo.grupos.map((g) => ({ grupo: g, id: (c.itens || []).find((i) => i.grupo === g)?.id || "" })),
    preco: c.preco === "" || c.preco == null ? "" : String(c.preco),
  };
}

/** Itens do combo resolvidos no catálogo (null se algum espaço está vazio). */
export function itensDoCombo(combo, catalogo) {
  const out = [];
  for (const slot of combo.itens || []) {
    const it = (catalogo[slot.grupo] || []).find((x) => x.id === slot.id);
    if (!it) return null;
    out.push({ ...it, qtd: 1 });
  }
  return out;
}
