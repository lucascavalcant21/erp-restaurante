// PROMOÇÕES E COMBOS DA MARMITARIA (pedido do dono, 28/10/2026): "combos de
// comida e bebida e de comida, bebida e sobremesa; ver, quando eu ponho
// desconto nas marmitas, meu lucro tirando todos os custos; simular 2 por 1".
//
// Tudo é simulação (nada grava venda): a conta do pedido reusa
// resultadoPorCanal (tributos, comissão, taxa de pagamento, taxa fixa e
// entrega do canal) e soma o que a equipe e os custos fixos pesam em cada
// marmita (custosEmbutidos, ESTIMATIVA). Funções puras (testes em
// promocoes.test.mjs).

import { canalConfigurado, resultadoPorCanal, normalizarCanal, r2 } from "./nucleo.mjs";
import { grupoDaCategoria } from "./cardapio.mjs";

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
  let fator = 1;
  if (t === "desconto_pct") paga = cheio * (1 - Math.min(100, pos(oferta.valor)) / 100);
  else if (t === "desconto_rs") paga = Math.max(0, cheio - pos(oferta.valor));
  else if (t === "preco_fixo") paga = pos(oferta.valor);
  else if (t === "leve_pague") {
    const leve = Math.max(1, Math.round(pos(oferta.leve) || 2));
    const pague = Math.min(leve, Math.max(0, Math.round(pos(oferta.pague) || 1)));
    // Cada item: leva `leve` × qtd, paga `pague` × qtd.
    fator = leve;
    unidades = lista.reduce((t2, i) => t2 + i.qtd * leve, 0);
    custo = lista.reduce((t2, i) => t2 + (i.custo || 0) * i.qtd * leve, 0);
    cheioDoQueLeva = lista.reduce((t2, i) => t2 + i.preco * i.qtd * leve, 0);
    paga = lista.reduce((t2, i) => t2 + i.preco * i.qtd * pague, 0);
  }
  // Equipe e custos fixos são repartidos por marmita: bebida e sobremesa não pesam.
  const marmitas = lista.filter((i) => !["bebida", "sobremesa"].includes(i.grupo)).reduce((t2, i) => t2 + i.qtd * fator, 0);
  return { cheio: r2(cheioDoQueLeva), paga: r2(paga), desconto: r2(Math.max(0, cheioDoQueLeva - paga)), custo: r2(custo), unidades, marmitas, semCusto };
}

/**
 * Pedido inteiro num canal: taxas sobre o que o cliente paga, custo do que sai
 * e o peso da equipe e dos custos fixos em cada marmita (custosEmbutidos).
 */
export function lucroDoPedido({ paga, custo, canal = CANAL_DIRETO, tributosPct = null, embutidos = null, marmitas = 1 } = {}) {
  if (!(pos(paga) > 0)) return { valido: false, motivo: "O cliente não paga nada nessa oferta." };
  // O pedido inteiro conta como 1 "item" para a taxa fixa e a entrega.
  const r = resultadoPorCanal({ preco: paga, custoTecnico: custo, canal: { ...canal, itens_por_pedido: 1 }, tributosPct });
  if (!r.valido) return r;
  const porMarmita = (v) => (v == null ? null : r2(v * pos(marmitas)));
  const cmo = porMarmita(embutidos?.cmoPorMarmita);
  const fixos = porMarmita(embutidos?.fixosPorMarmita);
  const lucro = r.margemContribuicao == null ? null : r2(r.margemContribuicao - (cmo || 0) - (fixos || 0));
  return { ...r, cmo, fixos, lucro, lucroPct: lucro == null || !(r.receita > 0) ? null : r2((lucro / r.receita) * 100) };
}

/**
 * Sem promoção × com promoção, e quantos pedidos a mais a promoção precisa
 * para dar o mesmo lucro em R$ que o preço cheio.
 */
export function simularOferta({ itens = [], oferta = {}, canal = CANAL_DIRETO, tributosPct = null, embutidos = null } = {}) {
  const conta = (p) => ({ pedido: p, ...lucroDoPedido({ paga: p.paga, custo: p.semCusto ? null : p.custo, canal, tributosPct, embutidos, marmitas: p.marmitas }) });
  const pCom = pedidoDaOferta(itens, oferta);
  const sem = conta(pedidoDaOferta(itens, { tipo: "nenhuma" }));
  const com = conta(pCom);
  let vezes = null;
  if (sem.valido && com.valido && sem.lucro != null && com.lucro != null) {
    if (com.lucro > 0 && sem.lucro > 0) vezes = r2(sem.lucro / com.lucro);
  }
  return { sem, com, vezesParaEmpatar: vezes, prejuizo: com.valido && com.lucro != null && com.lucro < 0, semCusto: pCom.semCusto };
}

// ─── Combos ─────────────────────────────────────────────────────────────────

export const MODELOS_COMBO = [
  { id: "comida_bebida", rotulo: "Comida + bebida", grupos: ["marmita", "bebida"], exemplo: "Ex.: marmita + refrigerante" },
  { id: "comida_sobremesa", rotulo: "Comida + sobremesa", grupos: ["marmita", "sobremesa"], exemplo: "Ex.: marmita + pudim" },
  { id: "comida_bebida_sobremesa", rotulo: "Comida + bebida + sobremesa", grupos: ["marmita", "bebida", "sobremesa"], exemplo: "Ex.: marmita + suco + pudim" },
  { id: "sobremesa_bebida", rotulo: "Sobremesa + bebida", grupos: ["sobremesa", "bebida"], exemplo: "Ex.: pudim + suco" },
  { id: "so_sobremesas", rotulo: "Só sobremesas", grupos: ["sobremesa", "sobremesa"], exemplo: "Ex.: pudim + mousse" },
  { id: "so_bebidas", rotulo: "Só bebidas", grupos: ["bebida", "bebida"], exemplo: "Ex.: refrigerante + suco" },
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
  // Custo incompleto ou zero não é custo: o lucro sairia 100% (DADOS INSUFICIENTES).
  const custoMarmita = (m) => { const c = custos.get(m.id); return c && c.completo !== false && Number(c.total) > 0 ? c.total : null; };
  // Tudo que nasce na Ficha técnica vai para o grupo da sua categoria.
  const proprios = (marmitas || []).filter((m) => m.ativo !== false).map((m) => ({ id: m.id, nome: m.nome_receita, preco: precoMarmita(m), custo: custoMarmita(m), grupo: grupoDaCategoria(m.categoria), categoria: m.categoria || "", propria: true }));
  const doGrupo = (g) => proprios.filter((i) => i.grupo === g);
  const vendaveis = (fichas || []).filter((f) => f && f.ativo !== false && !f.eh_base && f.departamento !== "marmitaria");
  const item = (f, grupo) => ({ id: f.id, nome: f.nome_comercial || f.nome_receita, preco: n(f.preco_venda), custo: custoFicha(f), grupo });
  const bebida = vendaveis.filter((f) => f.departamento === "bar").map((f) => item(f, "bebida"));
  const sobremesa = vendaveis.filter((f) => f.departamento !== "bar" && ehSobremesa(f)).map((f) => item(f, "sobremesa"));
  const ord = (l) => l.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { marmita: ord(doGrupo("marmita")), bebida: ord([...doGrupo("bebida"), ...bebida]), sobremesa: ord([...doGrupo("sobremesa"), ...sobremesa]) };
}

export function normalizarCombo(c = {}) {
  const modelo = MODELOS_COMBO.find((m) => m.id === c.modelo) || MODELOS_COMBO[0];
  return {
    id: String(c.id || `combo-${Math.random().toString(36).slice(2, 9)}`),
    nome: String(c.nome || "").trim().slice(0, 80),
    modelo: modelo.id,
    // Por posição: "só sobremesas" tem duas vagas do mesmo grupo.
    itens: modelo.grupos.map((g, i) => ({ grupo: g, id: (c.itens || [])[i]?.grupo === g ? c.itens[i].id : (c.itens || []).find((x) => x.grupo === g)?.id || "" })),
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

// ─── Cardápio de vendas (pedido do dono, 28/10/2026) ────────────────────────
// "Cardápio onde vejo os pratos com e sem desconto, 2x1 e combos, como se
// fosse montar no iFood, e ao lado meu lucro líquido; aprofundar os custos e
// saber se faz sentido". Ofertas salvas: [{ id, ficha_id, tipo, valor, leve, pague }].

export function rotuloDaOferta(o = {}) {
  if (o.tipo === "leve_pague") return `${Math.round(pos(o.leve) || 2)} por ${Math.round(pos(o.pague) || 1)}`;
  if (o.tipo === "desconto_pct") return `${pos(o.valor).toLocaleString("pt-BR")}% off`;
  if (o.tipo === "desconto_rs") return `R$ ${pos(o.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} off`;
  return "Preço cheio";
}

export function normalizarOferta(o = {}) {
  const tipo = ["desconto_pct", "desconto_rs", "leve_pague"].includes(o.tipo) ? o.tipo : "desconto_pct";
  return { id: String(o.id || `oferta-${Math.random().toString(36).slice(2, 9)}`), ficha_id: String(o.ficha_id || ""), tipo, valor: String(o.valor ?? ""), leve: String(o.leve ?? "2"), pague: String(o.pague ?? "1") };
}

/** Faz sentido? Pela meta de lucro (% da receita). */
export function veredito(lucroPct, metaPct = null, semCusto = false, falta = null) {
  if (falta) return { id: "sem_dados", rotulo: falta };
  if (semCusto || lucroPct == null) return { id: "sem_dados", rotulo: "Sem custo: DADOS INSUFICIENTES" };
  if (lucroPct < 0) return { id: "prejuizo", rotulo: "Prejuízo" };
  const meta = metaPct == null || metaPct === "" ? null : n(metaPct);
  if (meta == null) return { id: "lucro", rotulo: "Dá lucro" };
  return lucroPct >= meta ? { id: "ok", rotulo: "Margem alcançada" } : { id: "baixo", rotulo: `Abaixo da meta (${meta.toLocaleString("pt-BR")}%)` };
}

/**
 * Linhas do cardápio de vendas: cada item sozinho a preço cheio, promoções
 * salvas e combos, com a simulação do pedido. Sem as taxas da plataforma ou
 * sem os impostos não há lucro para mostrar: taxa em branco não é taxa zero.
 */
export function cardapioDeVendas({ catalogo = { marmita: [], bebida: [], sobremesa: [] }, marmitas = [], ofertas = [], combos = [], canal = CANAL_DIRETO, tributosPct = null, embutidos = null, metaPct = null } = {}) {
  const comum = { canal, tributosPct, embutidos };
  const falta = !canalConfigurado(canal) ? `Faltam as taxas do ${canal.nome || "canal"}`
    : tributosPct === null || tributosPct === undefined || tributosPct === "" ? "Falta informar os impostos" : null;
  const info = new Map((marmitas || []).map((m) => [m.id, m]));
  const linha = (secao, id, nome, itens, oferta, extra = {}) => {
    const s = simularOferta({ itens, oferta, ...comum });
    const r = s.com;
    const ok = r.valido && !falta;
    return {
      id, secao, nome, itens, oferta, sim: s, falta,
      precoCheio: s.com.pedido?.cheio ?? null, precoPago: s.com.pedido?.paga ?? null,
      lucro: ok ? r.lucro : null, lucroPct: ok ? r.lucroPct : null, receita: ok ? r.receita : null,
      custo: s.semCusto ? null : s.com.pedido?.custo ?? null,
      markup: r.valido && !s.semCusto ? r.markup : null,
      cmvPct: r.valido && !s.semCusto ? r.cmvTecnicoPct : null,
      veredito: veredito(ok ? r.lucroPct : null, metaPct, s.semCusto, falta),
      ...extra,
    };
  };
  const out = [];
  // Item feito na Ficha técnica: bebida e sobremesa de fora (do bar) só entram em combos.
  const vendidos = [...catalogo.marmita, ...catalogo.bebida.filter((i) => i.propria), ...catalogo.sobremesa.filter((i) => i.propria)];
  for (const o of (ofertas || []).map(normalizarOferta)) {
    const it = vendidos.find((x) => x.id === o.ficha_id);
    if (!it) continue;
    out.push(linha("promocoes", o.id, it.nome, [{ ...it, qtd: 1 }], o, { rotulo: rotuloDaOferta(o), ficha: info.get(it.id) || null }));
  }
  for (const c of (combos || []).map(normalizarCombo)) {
    const itens = itensDoCombo(c, catalogo);
    if (!itens || !String(c.preco).trim()) continue;
    out.push(linha("combos", c.id, c.nome || "Combo", itens, { tipo: "preco_fixo", valor: c.preco }, { rotulo: "Combo", descricao: itens.map((i) => i.nome).join(" + ") }));
  }
  for (const it of vendidos) {
    const extra = { ficha: info.get(it.id) || null, categoria: it.categoria || "Outros" };
    if (!(it.preco > 0)) { out.push({ id: `m-${it.id}`, secao: "marmitas", nome: it.nome, itens: [{ ...it, qtd: 1 }], oferta: { tipo: "nenhuma" }, sim: null, precoCheio: null, precoPago: null, lucro: null, lucroPct: null, receita: null, custo: it.custo, markup: null, cmvPct: null, falta, veredito: { id: "sem_dados", rotulo: "Sem preço" }, semPreco: true, ...extra }); continue; }
    out.push(linha("marmitas", `m-${it.id}`, it.nome, [{ ...it, qtd: 1 }], { tipo: "nenhuma" }, extra));
  }
  return out;
}
