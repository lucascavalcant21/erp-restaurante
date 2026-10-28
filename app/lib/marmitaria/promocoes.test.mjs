import test from "node:test";
import assert from "node:assert/strict";
import { pedidoDaOferta, simularOferta, fixosPctDoResultado, catalogoParaCombo, normalizarCombo, itensDoCombo, CANAL_DIRETO } from "./promocoes.mjs";

const marmita = { nome: "Frango", preco: 40, custo: 15, qtd: 1 };

test("2 por 1: o cliente leva 2, paga 1; custo de 2", () => {
  const p = pedidoDaOferta([marmita], { tipo: "leve_pague", leve: 2, pague: 1 });
  assert.deepEqual([p.cheio, p.paga, p.desconto, p.custo, p.unidades], [80, 40, 40, 30, 2]);
});

test("desconto % e R$, preço fixo", () => {
  assert.equal(pedidoDaOferta([marmita], { tipo: "desconto_pct", valor: "20" }).paga, 32);
  assert.equal(pedidoDaOferta([marmita], { tipo: "desconto_rs", valor: "5" }).paga, 35);
  assert.equal(pedidoDaOferta([marmita, { nome: "Suco", preco: 10, custo: 3 }], { tipo: "preco_fixo", valor: "45" }).paga, 45);
});

test("lucro tirando todos os custos: impostos, canal e fixos", () => {
  const canal = { id: "ifood", nome: "iFood", comissao_pct: 20, taxa_pagamento_pct: 0 };
  const s = simularOferta({ itens: [marmita], oferta: { tipo: "desconto_pct", valor: 20 }, canal, tributosPct: 6, fixosPct: 10 });
  // Sem promoção: 40 − 2,40 imposto − 8 comissão − 15 custo − 4 fixos = 10,60
  assert.equal(s.sem.lucro, 10.6);
  // Com 20%: 32 − 1,92 − 6,40 − 15 − 3,20 = 5,48
  assert.equal(s.com.lucro, 5.48);
  assert.equal(s.vezesParaEmpatar, 1.93);
  assert.equal(s.prejuizo, false);
});

test("2 por 1 que dá prejuízo aparece como prejuízo", () => {
  const s = simularOferta({ itens: [{ ...marmita, custo: 25 }], oferta: { tipo: "leve_pague", leve: 2, pague: 1 }, canal: CANAL_DIRETO, tributosPct: 0 });
  assert.equal(s.com.lucro, -10);
  assert.equal(s.prejuizo, true);
  assert.equal(s.vezesParaEmpatar, null);
});

test("fixos % do Resultado do mês", () => {
  const todos = { "2026-10": { faturamento: "100000", itens: { fixos: [{ valor: "8000" }], outros: [{ valor: "1000" }], variaveis: [{ valor: "5000" }] }, depreciacao: [{ valor_bem: "12000", vida_meses: "12" }] } };
  assert.equal(fixosPctDoResultado(todos, "2026-10"), 10);
  assert.equal(fixosPctDoResultado({}, "2026-10"), null);
});

test("catálogo e combo comida + bebida + sobremesa", () => {
  const cat = catalogoParaCombo({
    marmitas: [{ id: "m1", nome_receita: "Frango", preco_venda: 30, precos: { ifood: 35 } }],
    custos: new Map([["m1", { total: 12 }]]),
    fichas: [
      { id: "b1", nome_receita: "Suco", departamento: "bar", preco_venda: 8 },
      { id: "s1", nome_receita: "Pudim", departamento: "cozinha", categoria: "Sobremesas", preco_venda: 10 },
      { id: "p1", nome_receita: "Base", departamento: "cozinha", eh_base: true },
    ],
    custoFicha: (f) => ({ b1: 2, s1: 3 })[f.id] ?? null,
    canalId: "ifood",
  });
  assert.equal(cat.marmita[0].preco, 35);
  assert.equal(cat.bebida.length, 1);
  assert.equal(cat.sobremesa[0].nome, "Pudim");
  const combo = normalizarCombo({ nome: "Combo", modelo: "comida_bebida_sobremesa", itens: [{ grupo: "marmita", id: "m1" }, { grupo: "bebida", id: "b1" }, { grupo: "sobremesa", id: "s1" }], preco: "45" });
  const itens = itensDoCombo(combo, cat);
  assert.equal(itens.length, 3);
  const s = simularOferta({ itens, oferta: { tipo: "preco_fixo", valor: combo.preco }, tributosPct: 0 });
  assert.equal(s.sem.pedido.paga, 53);
  assert.equal(s.com.lucro, 28);
  assert.equal(itensDoCombo(normalizarCombo({ modelo: "comida_bebida" }), cat), null);
});
