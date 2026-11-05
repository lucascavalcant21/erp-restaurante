import test from "node:test";
import assert from "node:assert/strict";
import { motorDeLucro } from "./motor-lucro.mjs";

const item = (id, extra) => ({ id, nome: id, preco: 30, lucro: 10, lucroPct: 33, vendidas: 0, ...extra });

test("prejuízo vem antes de tudo, e o resto sai pelo dinheiro que vale", () => {
  const r = motorDeLucro({ metaPct: 30, itens: [
    item("a", { lucroPct: 20, lucro: 6, vendidas: 50, precoParaMeta: 34, lucroNoPrecoDaMeta: 10 }),
    item("b", { lucroPct: 25, lucro: 7.5, vendidas: 200, precoParaMeta: 32, lucroNoPrecoDaMeta: 9.5 }),
    item("c", { lucro: -2, lucroPct: -7, vendidas: 10, precoParaMeta: 40 }),
  ] });
  assert.deepEqual(r.map((x) => [x.id, x.impactoMes]).slice(0, 3), [["prejuizo-c", 20], ["preco-b", 400], ["preco-a", 200]]);
  assert.equal(r[0].urgente, true);
});

test("sem venda não estima dinheiro e a confiança é baixa", () => {
  const [p] = motorDeLucro({ metaPct: 40, itens: [item("a", { precoParaMeta: 35, lucroNoPrecoDaMeta: 14 })] });
  assert.deepEqual([p.impactoMes, p.confianca], [null, "baixa"]);
});

test("destaca o prato lucrativo que vende pouco", () => {
  const r = motorDeLucro({ itens: [item("forte", { lucroPct: 50, lucro: 15, vendidas: 5 }), item("x", { lucroPct: 20, lucro: 6, vendidas: 100 }), item("y", { lucroPct: 30, lucro: 9, vendidas: 60 })] });
  assert.deepEqual(r.map((i) => [i.id, i.impactoMes]), [["promover-forte", 825]]);
});

test("aumento de custo pesa pelas vendas; queda não vira alerta", () => {
  const r = motorDeLucro({ itens: [item("m", { vendidas: 100 })].map((i) => ({ ...i, id: "m-f" })), mudancas: [
    { insumoId: "pote", nome: "Marmitex", subiu: true, pct: 50, pratos: [{ id: "f", custoAntes: 5, custoDepois: 5.5 }] },
    { insumoId: "sal", nome: "Sal", subiu: true, pct: 2, pratos: [{ id: "f", custoAntes: 5, custoDepois: 5.01 }] },
    { insumoId: "x", nome: "Arroz", subiu: false, pct: -10, pratos: [{ id: "f", custoAntes: 6, custoDepois: 5 }] },
  ] });
  assert.deepEqual(r.map((i) => [i.id, i.impactoMes, i.confianca]), [["custo-pote", 50, "alta"]]);
});

test("promoção com prejuízo é urgente; promoção fraca pede revisão", () => {
  const r = motorDeLucro({ promocoes: [{ id: "1", nome: "A", rotulo: "2 por 1", prejuizo: true }, { id: "2", nome: "B", rotulo: "20% off", vezes: 2.5 }, { id: "3", nome: "C", rotulo: "5% off", vezes: 1.1 }], combos: [{ id: "k", nome: "K", lucro: -1 }] });
  assert.deepEqual(r.map((i) => i.id).sort(), ["combo-k", "promo-1", "promo-2"]);
});
