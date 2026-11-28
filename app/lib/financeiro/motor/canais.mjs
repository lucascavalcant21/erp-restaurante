// Canais de venda → regras do motor (fase 4, sem tabela nova ainda).
//
// Lê as configurações que JÁ existem:
//   - apps do Delivery (marmitaria_configuracoes.canais, normalizarCanal);
//   - salão/balcão do restaurante (taxas da casa em config_sistema.params).
// Quando as tabelas FIN-EXP-1/2 forem aprovadas, só a origem muda.

import { normalizarCanal } from "../../marmitaria/nucleo.mjs";
import { precoRecomendado } from "./preco.mjs";
import { resultadoDoItem } from "./resultado.mjs";

const n = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

/**
 * Um app do Delivery em regras. Mesma leitura de precoSugerido (nucleo.mjs):
 * - promoção da loja = desconto da loja (%);
 * - comissão sobre a receita da loja, ou sobre o preço cheio ("bruto");
 * - pagamento online sobre a receita da loja (a não ser que já venha na comissão);
 * - tributos sobre a receita da loja;
 * - taxa fixa por pedido e entrega paga pela loja, divididas pelos itens do pedido;
 * - com "usar fatura": ofertas e taxas observadas na fatura (HIPÓTESE do período).
 */
export function regrasDoCanalDelivery(canalBruto, tributosPct = 0) {
  const c = normalizarCanal(canalBruto);
  const regras = [];
  let descontoLojaPct = n(c.promocao_pct);
  if (c.usar_fatura && c.fatura) {
    descontoLojaPct = c.fatura.ofertasPct;
    regras.push({ nome: "Taxas da fatura", tipo: "percentual", base: "preco_lista", valor: c.fatura.taxasPct });
  } else {
    if (n(c.comissao_pct)) regras.push({ nome: "Comissão", tipo: "percentual", base: c.comissao_base === "bruto" ? "preco_lista" : "receita_loja", valor: n(c.comissao_pct) });
    if (n(c.taxa_pagamento_pct) && !c.pagamento_na_comissao) regras.push({ nome: "Pagamento online", tipo: "percentual", base: "receita_loja", valor: n(c.taxa_pagamento_pct) });
  }
  if (n(tributosPct)) regras.push({ nome: "Impostos", tipo: "percentual", base: "receita_loja", valor: n(tributosPct) });
  if (n(c.taxa_fixa_pedido)) regras.push({ nome: "Taxa por pedido", tipo: "fixo_pedido", valor: n(c.taxa_fixa_pedido) });
  const entrega = n(c.entrega_subsidiada_pedido) + n(c.taxa_entrega_cliente) * Math.min(1, n(c.desconto_entrega_pct) / 100);
  if (entrega) regras.push({ nome: "Entrega paga pela loja", tipo: "fixo_pedido", valor: entrega });
  return { id: c.id, nome: c.nome, regras, descontoLojaPct, itensPorPedido: c.itens_por_pedido, natureza: c.usar_fatura ? "HIPÓTESE" : "ESTIMATIVA" };
}

/** Salão/balcão do restaurante: maquininha e imposto sobre o preço. */
export function regrasDoSalao({ taxaCartaoPct = 0, impostoPct = 0, nome = "Salão" } = {}) {
  const regras = [];
  if (n(taxaCartaoPct)) regras.push({ nome: "Maquininha", tipo: "percentual", base: "preco_pago", valor: n(taxaCartaoPct) });
  if (n(impostoPct)) regras.push({ nome: "Imposto", tipo: "percentual", base: "receita_loja", valor: n(impostoPct) });
  return { id: "salao", nome, regras, descontoLojaPct: 0, itensPorPedido: 1, natureza: "ESTIMATIVA" };
}

/**
 * Compara todos os canais de um item ao mesmo tempo (item 10 do documento).
 * canais: [{ id, nome, regras, descontoLojaPct, itensPorPedido, precoAtualC }]
 */
export function compararCanais({ custoC, canais = [], margemPct, finais = [90] }) {
  return canais.map((c) => {
    const preco = precoRecomendado({ custoC, regras: c.regras, margemPct, descontoLojaPct: c.descontoLojaPct, itensPorPedido: c.itensPorPedido, finais });
    const atual = c.precoAtualC > 0 && custoC > 0
      ? resultadoDoItem({ precoListaC: c.precoAtualC, custoC, regras: c.regras, descontoLojaPct: c.descontoLojaPct, itensPorPedido: c.itensPorPedido })
      : null;
    return {
      id: c.id, nome: c.nome, natureza: c.natureza || "ESTIMATIVA",
      precoAtualC: c.precoAtualC > 0 ? c.precoAtualC : null,
      margemAtualC: atual ? atual.margemC : null, margemAtualPct: atual ? atual.margemPct : null,
      taxasAtuaisC: atual ? atual.taxasC : null,
      abaixoDoMinimo: atual && preco.status === "OK" ? c.precoAtualC < preco.minimoC : null,
      preco,
    };
  });
}
