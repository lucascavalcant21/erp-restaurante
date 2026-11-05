// COMPRAS E COZINHA DA MARMITARIA (pedido do dono, 05/11/2026): tudo exclusivo
// da marmitaria. Pedido com data de chegada, conferência do que chegou, baixa
// dos ingredientes do subproduto e planilha do que precisa ser feito. Funções
// puras (testes em cozinha.test.mjs).

import { calcularConsumoProducao } from "../producao-calculos.mjs";
import { custoDeProduzirFicha } from "../ficha-calculos.mjs";
import { fatorSaldo, r2 } from "./nucleo.mjs";

export const ESTOQUE_PRODUCAO = "producao-marmitaria";
export const ESTOQUE_LIMPEZA = "limpeza-marmitaria";
export const SLUGS_MARMITARIA = ["marmitaria", "embalagens-marmitaria", ESTOQUE_PRODUCAO, ESTOQUE_LIMPEZA];
export const ROTULO_LOCAL = { marmitaria: "Produtos", "embalagens-marmitaria": "Embalagens", [ESTOQUE_LIMPEZA]: "Limpeza", [ESTOQUE_PRODUCAO]: "Produção" };
export const ehEstoqueDaMarmitaria = (e) => SLUGS_MARMITARIA.includes(e?.slug);
export const ehLimpeza = (i) => String(i?.departamento || "").toLowerCase() === "limpeza" || /limpeza/i.test(String(i?.categoria || ""));

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;

export function somarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Como o pedido aparece para quem espera: fica piscando até ser recebido. */
export function situacaoDaChegada(data, hoje) {
  if (!data) return { id: "sem_data", rotulo: "Sem data", urgente: false };
  if (data < hoje) return { id: "atrasado", rotulo: "Atrasado", urgente: true };
  if (data === hoje) return { id: "hoje", rotulo: "Chega hoje", urgente: true };
  if (data === somarDias(hoje, 1)) return { id: "amanha", rotulo: "Chega amanhã", urgente: false };
  return { id: "depois", rotulo: `Chega em ${data.split("-").reverse().slice(0, 2).join("/")}`, urgente: false };
}

/** Só as compras com itens nos estoques da marmitaria, separadas por situação. */
export function pedidosDaMarmitaria({ compras = [], itens = [], hoje }) {
  const porCompra = new Map();
  for (const i of itens) porCompra.set(i.compra_id, [...(porCompra.get(i.compra_id) || []), i]);
  const lista = compras.filter((c) => porCompra.has(c.id) && c.status !== "cancelada")
    .map((c) => ({ ...c, itens: porCompra.get(c.id), situacao: situacaoDaChegada(c.data_recebimento, hoje) }));
  const ordem = (c) => c.data_recebimento || "9999";
  return {
    aguardando: lista.filter((c) => c.status === "rascunho").sort((a, b) => ordem(a).localeCompare(ordem(b))),
    recebidos: lista.filter((c) => c.status === "confirmada").sort((a, b) => ordem(b).localeCompare(ordem(a))),
  };
}

/** Recebido × pedido, na unidade que a pessoa digitou. */
export function conferencia(pedida, recebida) {
  const p = Number(pedida) || 0;
  const r = Number(recebida);
  if (!Number.isFinite(r) || String(recebida).trim() === "") return null;
  const diferenca = r3(r - p);
  return { id: diferenca === 0 ? "igual" : diferenca > 0 ? "mais" : "menos", diferenca };
}

/** Saldos só dos estoques da marmitaria: insumo → [{ estoque_id, estoque_nome, saldo }]. */
export function saldosDaMarmitaria({ estoques = [], itensEstoque = [] }) {
  const locais = new Map(estoques.filter(ehEstoqueDaMarmitaria).map((e) => [e.id, e]));
  const saldos = new Map();
  for (const it of itensEstoque) {
    const e = locais.get(it.estoque_id);
    if (!e) continue;
    saldos.set(it.insumo_id, [...(saldos.get(it.insumo_id) || []), { estoque_id: e.id, estoque_nome: e.nome, slug: e.slug, saldo: Number(it.quantidade_atual) || 0 }]);
  }
  return saldos;
}

/**
 * O que sai do estoque para fazer o subproduto, na unidade do saldo. Sem saldo
 * suficiente não baixa: a produção usa só o que a marmitaria tem.
 */
export function baixasDoPreparo({ ficha, quantidade, fichas = [], insumos = new Map(), espelho = new Map(), saldos = new Map() }) {
  const calc = calcularConsumoProducao(ficha, quantidade, fichas);
  const faltas = [...calc.erros];
  const baixas = [];
  for (const item of calc.itens) {
    const insumoId = item.subficha_id ? espelho.get(item.subficha_id) : item.insumo?.id;
    const nome = item.insumo?.nome || "Item";
    if (!insumoId) { faltas.push(`${nome}: sem item de estoque.`); continue; }
    const q = r3(item.quantidade * fatorSaldo(insumos.get(insumoId)));
    const local = (saldos.get(insumoId) || []).find((l) => l.saldo >= q);
    if (!local) {
      const tem = (saldos.get(insumoId) || []).reduce((t, l) => t + l.saldo, 0);
      faltas.push(`${nome}: precisa de ${r3(item.quantidade)} ${item.insumo?.unidade_medida || ""} e tem ${r3(tem / fatorSaldo(insumos.get(insumoId)))} no estoque da marmitaria.`);
      continue;
    }
    baixas.push({ estoque_id: local.estoque_id, insumo_id: insumoId, nome, quantidade: q, unidade: item.insumo?.unidade_medida || "", quantidadeNaUnidade: r3(item.quantidade) });
  }
  const custo = ficha && Number(ficha.rendimento_porcoes) > 0 ? custoDeProduzirFicha(ficha, fichas) * (Number(quantidade) / Number(ficha.rendimento_porcoes)) : 0;
  return { baixas, faltas, custo: r2(custo) };
}

/** Saldo pronto por ficha, na unidade do rendimento. */
export function saldoProduzido({ estoques = [], itensEstoque = [], insumos = new Map(), fichas = [] }) {
  const local = estoques.find((e) => e.slug === ESTOQUE_PRODUCAO);
  if (!local) return new Map();
  const m = new Map();
  for (const it of itensEstoque) {
    if (it.estoque_id !== local.id) continue;
    const ins = insumos.get(it.insumo_id);
    if (!ins?.ficha_tecnica_id) continue;
    const ficha = fichas.find((f) => f.id === ins.ficha_tecnica_id);
    m.set(ins.ficha_tecnica_id, { fichaId: ins.ficha_tecnica_id, nome: ficha?.nome_receita || ins.nome, unidade: ficha?.rendimento_unidade || ins.unidade_medida, quantidade: r3((Number(it.quantidade_atual) || 0) / fatorSaldo(ins)) });
  }
  return m;
}

/**
 * A planilha do dia. O pronto atende hoje primeiro e o que sobra atende amanhã:
 * preciso de 100, tenho 50, faltam 50.
 */
export function planilhaDaCozinha({ planoHoje = [], planoAmanha = [], produzido = new Map() }) {
  const restante = new Map([...produzido].map(([id, p]) => [id, p.quantidade]));
  const linha = (i) => {
    const disponivel = restante.get(i.ficha_id) || 0;
    const usado = Math.min(disponivel, Number(i.necessario) || 0);
    restante.set(i.ficha_id, r3(disponivel - usado));
    const falta = r3((Number(i.necessario) || 0) - usado);
    return { ...i, tem: r3(usado), falta, pronto: falta <= 0 };
  };
  const hoje = planoHoje.map(linha);
  const amanha = planoAmanha.map(linha);
  return { hoje, amanha };
}
