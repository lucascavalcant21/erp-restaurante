// Que permissão do ERP cada capacidade da inteligência exige. Nenhuma chave
// nova: são as MESMAS do catálogo (app/lib/permissions-catalog.mjs) que
// protegem as telas de onde o dado vem — perguntar ao Héfisto não pode mostrar
// o que a tela esconderia. Basta uma chave da lista; o "sim" é do banco
// (hefisto_user_can), via authorizeAny.

import { authorizeAny } from "../../server/autorizacao.mjs";

export const PERMISSOES = Object.freeze({
  faturamento: ["financeiro.cashflow.view", "financeiro.dre.view", "dashboard.overview.view_values"],
  compras: ["estoque.purchases.view", "compras.orders.view", "compras.invoices.view"],
  precos_compra: ["estoque.purchases.view_costs", "estoque.overview.view_costs", "compras.orders.view_costs"],
  validade: ["estoque.overview.view", "cozinha.expiry.view", "estoque.labels.view"],
  divergencias: ["estoque.counts.view", "estoque.overview.view", "estoque.inventory.view"],
  saldo_estoque: ["estoque.overview.view", "estoque.operation.view", "estoque.movements.view"],
  perdas: ["estoque.losses.view", "estoque.overview.view"],
  contas_pagar: ["financeiro.cashflow.view"],
  cmv: ["estoque.cmv.view", "financeiro.cmv.view"],
  cmo: ["financeiro.dre.view", "rh.overview.view_values", "rh.payroll.view_values"],
  // as mesmas chaves que _estoque_pode('movimentar', unidade, 'saida') aceita no banco (EST-MOV-1)
  registrar_perda: ["estoque.losses.record_loss", "estoque.movements.create", "estoque.outputs.create", "estoque.overview.adjust_stock", "estoque.operation.adjust_stock", "estoque.operation.create"],
});

export const ROTULO_CAPACIDADE = Object.freeze({
  faturamento: "faturamento",
  compras: "compras",
  precos_compra: "preços de compra",
  validade: "validades",
  divergencias: "divergências de estoque",
  saldo_estoque: "saldo de estoque",
  perdas: "perdas",
  contas_pagar: "contas a pagar",
  cmv: "CMV",
  cmo: "CMO",
  registrar_perda: "registrar perda",
});

/**
 * Verificador por requisição, com cache: a mesma capacidade não vai ao banco
 * duas vezes no mesmo pedido.
 * @param {object} requestContext
 * @param {{ podeFazer: Function }} deps
 */
export function criarVerificador(requestContext, deps) {
  const cache = new Map();
  async function pode(capacidade) {
    const chaves = PERMISSOES[capacidade];
    if (!chaves) throw new Error(`Capacidade sem permissão mapeada: ${capacidade}`);
    if (!cache.has(capacidade)) {
      cache.set(capacidade, authorizeAny(requestContext, chaves, { acao: `inteligencia.${capacidade}`, deps }).then((d) => d.ok === true).catch(() => false));
    }
    return cache.get(capacidade);
  }
  return {
    pode,
    async quais(capacidades) {
      const r = await Promise.all(capacidades.map(async (c) => [c, await pode(c)]));
      return Object.fromEntries(r);
    },
  };
}
