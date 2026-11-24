import test from "node:test";
import assert from "node:assert/strict";
import { percentuaisDePeso, textoPct, textoPeso } from "./ficha-percentual.mjs";

test("farofa de camarão: cada peso em % da receita", () => {
  const linhas = [
    { nome: "Farinha", quantidade: 500, unidade: "g" },
    { nome: "Camarão", quantidade: 150, unidade: "g" },
    { nome: "Óleo", quantidade: 150, unidade: "ml" },
    { nome: "Pó de camarão", quantidade: 10, unidade: "g" },
    { nome: "Pote", quantidade: 1, unidade: "un", tipo: "embalagem" },
  ];
  const r = percentuaisDePeso(linhas);
  assert.equal(r.totalG, 810);
  assert.equal(textoPct(r.pcts[0]), "(62%)");
  assert.equal(textoPct(r.pcts[1]), "(19%)");
  assert.equal(textoPct(r.pcts[3]), "(1,2%)");
  assert.equal(r.pcts[4], null);
  assert.equal(r.temLiquido, true);
  assert.equal(textoPeso(r.totalG), "810 g");
  const soma = r.pcts.filter((p) => p != null).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(soma - 100) < 1e-9);
});

test("kg, L e unidade fora da conta", () => {
  const r = percentuaisDePeso([{ quantidade: 1, unidade: "kg" }, { quantidade: 1, unidade: "L" }, { quantidade: 2, unidade: "un" }]);
  assert.equal(r.totalG, 2000);
  assert.equal(r.pcts[2], null);
  assert.equal(r.foraDaConta, 1);
  assert.equal(textoPeso(2000), "2 kg");
  assert.equal(percentuaisDePeso([]).totalG, 0);
});
