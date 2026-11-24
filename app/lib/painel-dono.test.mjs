// Painel do dono ao vivo (14/11/2026). Rode: node --test app/lib/painel-dono.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { custosDaVenda, estrategiasDaMeta, janelaDaMeta, lucroPelasFichas, metaValida, progressoDaMeta, somarVendas } from "./painel-dono.mjs";

test("janela da meta: dia, semana (segunda a domingo) e mês", () => {
  assert.deepEqual(janelaDaMeta("dia", "2026-11-14"), { periodo: "dia", inicio: "2026-11-14", fim: "2026-11-14", dias: 1, passados: 1 });
  // 14/11/2026 é sábado
  assert.deepEqual(janelaDaMeta("semana", "2026-11-14"), { periodo: "semana", inicio: "2026-11-09", fim: "2026-11-15", dias: 7, passados: 6 });
  assert.deepEqual(janelaDaMeta("mes", "2026-11-14"), { periodo: "mes", inicio: "2026-11-01", fim: "2026-11-30", dias: 30, passados: 14 });
  assert.equal(janelaDaMeta("mes", "2026-02-10").dias, 28);
});

test("meta só vale com período conhecido e valor positivo", () => {
  assert.deepEqual(metaValida({ periodo: "dia", valor: "5000" }), { periodo: "dia", valor: 5000 });
  assert.equal(metaValida({ periodo: "ano", valor: 1 }), null);
  assert.equal(metaValida({ periodo: "mes", valor: 0 }), null);
  assert.equal(metaValida(null), null);
});

test("soma das vendas tira as canceladas e separa o cartão", () => {
  const s = somarVendas([
    { subtotal: 100, desconto: 10, total: 90, forma_pagamento: "Pix", status: "paga" },
    { subtotal: 50, acrescimo: 0, taxa_servico: 5, desconto: 0, total: 55, forma_pagamento: "Cartão de crédito" },
    { subtotal: 999, total: 999, status: "cancelada" },
    { subtotal: 20, total: 20, cancelada_em: "2026-11-14T10:00:00Z" },
  ]);
  assert.deepEqual(s, { quantidade: 2, bruto: 155, desconto: 10, total: 145, cartao: 55, ticket: 72.5 });
  assert.equal(somarVendas([]).ticket, null);
});

test("imposto e taxa só com a porcentagem configurada", () => {
  assert.deepEqual(custosDaVenda({ total: 1000, cartao: 400, impostoPct: 6, taxaCartaoPct: 2.5 }), { imposto: 60, taxaCartao: 10 });
  assert.deepEqual(custosDaVenda({ total: 1000 }), { imposto: null, taxaCartao: null });
});

test("lucro pelas fichas deixa de fora o item sem margem e diz quantos", () => {
  const margens = new Map([["a", 12.5], ["b", 4]]);
  assert.deepEqual(lucroPelasFichas([
    { produto_id: "a", quantidade: 2 }, { produto_id: "b", quantidade: 3 }, { produto_id: "c", quantidade: 1 },
    { produto_id: "a", quantidade: 5, status_kds: "cancelado" },
  ], margens), { lucro: 37, itensContados: 5, semMargem: 1 });
  assert.equal(lucroPelasFichas([], margens).lucro, null);
});

test("progresso: meta diária não prevê; mensal prevê pelo ritmo", () => {
  const dia = progressoDaMeta({ meta: { periodo: "dia", valor: 5000 }, vendido: 2000, janela: janelaDaMeta("dia", "2026-11-14") });
  assert.equal(dia.pct, 40); assert.equal(dia.falta, 3000); assert.equal(dia.previsto, null); assert.equal(dia.estado, "em_andamento");
  const mes = progressoDaMeta({ meta: { periodo: "mes", valor: 300000 }, vendido: 140000, janela: janelaDaMeta("mes", "2026-11-14") });
  assert.equal(mes.previsto, 300000); assert.equal(mes.estado, "vai_bater");
  const fraco = progressoDaMeta({ meta: { periodo: "mes", valor: 300000 }, vendido: 70000, janela: janelaDaMeta("mes", "2026-11-14") });
  assert.equal(fraco.estado, "nao_vai_bater"); assert.equal(fraco.previsto, 150000);
  assert.equal(progressoDaMeta({ meta: null, vendido: 1, janela: janelaDaMeta("dia", "2026-11-14") }), null);
});

test("estratégias usam só números reais e somem quando a meta foi batida", () => {
  const p = progressoDaMeta({ meta: { periodo: "dia", valor: 5000 }, vendido: 4000, janela: janelaDaMeta("dia", "2026-11-14") });
  const e = estrategiasDaMeta(p, { produtos: [{ nome: "Picanha", preco: 100, margem: 40 }, { nome: "Suco", preco: 10, margem: 6 }], ticket: 80 });
  assert.match(e[0], /Picanha.*10 a mais/);
  assert.match(e[1], /13 vendas/);
  assert.deepEqual(estrategiasDaMeta({ falta: 0 }, {}), []);
});
