// ESTILO DE PRECIFICAÇÃO DO DELIVERY (especificação do dono, 21/11/2026,
// "Héfisto — Delivery Marmitas" v1.0). Preço de lista, o que o cliente paga e
// o que chega ao restaurante NÃO são a mesma coisa:
//
//   preço de lista − desconto da loja − desconto do app = o que o cliente paga
//   preço de lista − desconto da loja − taxas do app − impostos = repasse
//   repasse − ingredientes − embalagem = margem de contribuição
//   margem − equipe e fixos (rateio por marmita) = lucro ESTIMADO
//
// O desconto pago pelo app não entra no que a loja perde. Tudo aqui é
// simulação (ESTIMATIVA); lucro real só sai das vendas e da conciliação.
// Funções puras (testes em precificacao.test.mjs).

import { precoSugerido, r2 } from "./nucleo.mjs";
import { lucroDoPedido } from "./promocoes.mjs";

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const x = Number(String(v ?? "").replace(/\./g, (m, i, t) => (t.includes(",") ? "" : m)).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const pos = (v) => Math.max(0, num(v));

/** Preço de lista × o que o cliente paga: desconto em R$ e % (42 → 30 = 12 = 28,57%). */
export function descontoDoPreco({ precoLista, clientePaga }) {
  const P = pos(precoLista), C = pos(clientePaga);
  if (!(P > 0) || C > P) return null;
  return { desconto: r2(P - C), pct: r2(((P - C) / P) * 100) };
}

/** Cupom de X% sobre um preço: o que o cliente paga (50 com 25% = 37,50; 25% não é R$ 25). */
export const precoComCupom = (preco, pctCupom) => r2(pos(preco) * (1 - Math.min(100, pos(pctCupom)) / 100));

/** Quem paga o desconto: "loja", "app" ou "dividido" (parteLojaPct da loja). Devolve o desconto da loja em R$. */
export function descontoDaLoja({ desconto, quemPaga = "loja", parteLojaPct = 50 }) {
  const d = pos(desconto);
  if (quemPaga === "app") return 0;
  if (quemPaga === "dividido") return r2(d * Math.min(100, pos(parteLojaPct)) / 100);
  return r2(d);
}

/**
 * Preço mínimo (lucro zero, já pagando equipe e fixos) e preço para cada meta
 * de lucro em R$ (ex.: 10 e 12). custoComEmbutidos = ingredientes + embalagem
 * + equipe/fixos/variáveis por marmita.
 */
export function faixaDePrecos({ custoComEmbutidos, canal, tributosPct, metas = [] }) {
  if (custoComEmbutidos == null || !(custoComEmbutidos > 0)) return { minimo: null, metas: [], motivo: "Sem custo completo não há ponto de equilíbrio." };
  const c = { ...canal, itens_por_pedido: 1 };
  const minimo = precoSugerido({ custoTecnico: custoComEmbutidos, canal: c, tributosPct, margemAlvoPct: 0 }).preco;
  const lista = [...new Set(metas.map(pos).filter((m) => m > 0))].sort((a, b) => a - b)
    .map((m) => ({ lucro: m, preco: precoSugerido({ custoTecnico: custoComEmbutidos, canal: c, tributosPct, lucroAlvoReais: m }).preco }));
  return { minimo, metas: lista, motivo: minimo == null ? "Com essas taxas não existe preço possível." : null };
}

/**
 * A conta do preço em cascata, de cima (preço de lista) para baixo (lucro).
 * r: resultado de lucroDoPedido. custo: { ingredientes, embalagens } de 1 unidade.
 * descontoApp: parte da promoção paga pelo app (só informa; não sai da loja).
 */
export function cascataDoPreco({ r, custo = {}, descontoApp = 0 }) {
  if (!r?.valido) return null;
  const P = r.preco;
  const pct = (v) => (P > 0 && v != null ? r2((v / P) * 100) : null);
  const ingredientes = custo.ingredientes == null ? null : r2(custo.ingredientes);
  const embalagens = r2(pos(custo.embalagens));
  const proLabore = r2(Math.min(r.proLabore || 0, r.fixos || 0));
  const fixosSemPL = r2((r.fixos || 0) - proLabore);
  const dApp = r2(pos(descontoApp));
  const linhas = [
    { id: "lista", rotulo: "Preço de lista", valor: P, tipo: "total" },
    r.promocao > 0 && { id: "desc_loja", rotulo: r.modoTaxa === "fatura" ? "Ofertas pagas pela loja (média da fatura)" : "Desconto pago pela loja", valor: -r.promocao },
    dApp > 0 && { id: "desc_app", rotulo: "Desconto pago pelo app (não sai de você)", valor: -dApp, informativo: true },
    (r.promocao > 0 || dApp > 0) && { id: "cliente", rotulo: "O cliente paga", valor: r2(P - r.promocao - dApp), tipo: "total", informativo: true },
    { id: "taxas", rotulo: r.modoTaxa === "fatura" ? "Taxas do app (média da fatura)" : "Taxas do app e pagamento", valor: -r2(r.variaveis) },
    r.tributos > 0 && { id: "impostos", rotulo: "Impostos", valor: -r.tributos },
    { id: "repasse", rotulo: "Chega para você (repasse)", valor: r2(r.receita - r.tributos - r.variaveis), tipo: "total" },
    { id: "ingredientes", rotulo: "Ingredientes", valor: ingredientes == null ? null : -ingredientes },
    embalagens > 0 && { id: "embalagens", rotulo: "Embalagem e sacola", valor: -embalagens },
    { id: "contribuicao", rotulo: "Margem de contribuição", valor: r.margemContribuicao, tipo: "total" },
    r.cmo > 0 && { id: "equipe", rotulo: "Equipe (rateio por marmita)", valor: -r2(r.cmo) },
    proLabore > 0 && { id: "prolabore", rotulo: "Pró-labore (rateio por marmita)", valor: -proLabore },
    fixosSemPL > 0 && { id: "fixos", rotulo: "Custos fixos (rateio por marmita)", valor: -fixosSemPL },
    r.extras > 0 && { id: "variaveis", rotulo: "Custos variáveis", valor: -r2(r.extras) },
    { id: "lucro", rotulo: "Lucro estimado", valor: r.lucro, tipo: "final" },
  ].filter(Boolean);
  return linhas.map((l) => ({ ...l, pct: l.valor == null ? null : pct(Math.abs(l.valor)) }));
}

/**
 * Alertas do preço (especificação 12): lucro abaixo da meta, CMV acima do teto,
 * desconto acima do teto, ficha sem custo completo (lucro "pendente").
 */
export function alertasDoPreco({ r, metaReais = null, completo = true, cmvTetoPct = 30, descontoPct = null, tetoDescontoPct = null }) {
  const a = [];
  if (!completo) a.push({ tipo: "pendente", texto: "Ficha sem custo completo: o lucro fica pendente até todos os itens terem preço." });
  if (!r?.valido) return a;
  if (r.lucro != null && r.lucro < 0) a.push({ tipo: "perigo", texto: "Esse preço dá prejuízo." });
  else if (r.lucro != null && metaReais > 0 && r.lucro < metaReais) a.push({ tipo: "alerta", texto: `Lucro abaixo da meta de R$ ${String(metaReais.toFixed(2)).replace(".", ",")}.` });
  if (r.cmvTecnicoPct != null && r.cmvTecnicoPct > cmvTetoPct) a.push({ tipo: "alerta", texto: `CMV de ${String(r.cmvTecnicoPct).replace(".", ",")}%, acima de ${cmvTetoPct}%.` });
  if (descontoPct != null && tetoDescontoPct != null && descontoPct > tetoDescontoPct) a.push({ tipo: "alerta", texto: `Desconto acima do teto de ${tetoDescontoPct}%.` });
  return a;
}

/** Atalho: a conta de 1 unidade a um preço de lista, com promoção opcional. */
export function contaDoPreco({ precoLista, clientePaga = null, quemPaga = "loja", parteLojaPct = 50, custo, canal, tributosPct, embutidos, ehMarmita = true }) {
  const d = clientePaga != null && String(clientePaga).trim() !== "" ? descontoDoPreco({ precoLista, clientePaga }) : null;
  const dLoja = d ? descontoDaLoja({ desconto: d.desconto, quemPaga, parteLojaPct }) : 0;
  const r = lucroDoPedido({ paga: precoLista, custo, canal, tributosPct, embutidos, marmitas: ehMarmita ? 1 : 0, descontoLoja: dLoja });
  return { r, desconto: d, descontoLoja: dLoja, descontoApp: d ? r2(d.desconto - dLoja) : 0 };
}
