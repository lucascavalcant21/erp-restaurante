// Rode com: node --test app/lib/marmitaria/porcionamento.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { calcularPorcionamento, passosDoPorcionamento } from "./porcionamento.mjs";

test("5 kg de frango, 10% de perda, porções de 150 g a R$ 20/kg", () => {
  const c = calcularPorcionamento({ brutoQtd: 5, brutoUn: "kg", perda: { modo: "pct", valor: 10 }, porcaoG: 150, custoPorUnidadeCadastro: 20, unidadeCadastro: "kg" });
  assert.equal(c.ok, true);
  assert.equal(c.limpoG, 4500);
  assert.equal(c.porcoes, 30);
  assert.equal(c.sobraG, 0);
  assert.equal(c.custoTotal, 100);
  assert.equal(c.custoPorcao, 3.33);
  assert.equal(c.custoKgLimpo, 22.22);
  assert.equal(c.quantidadeCadastro, 5);
  const passos = passosDoPorcionamento({ nomeProduto: "peito de frango", calc: c, embalagem: "saco a vácuo", armazenamento: "freezer a −18 °C", validadeDias: 30 });
  assert.match(passos, /^1\. Pese 5 kg de peito de frango\./);
  assert.match(passos, /30 porções de 150 g/);
  assert.match(passos, /\(30 dias\)/);
});

test("perda em gramas, sobra e cadastro em gramas", () => {
  const c = calcularPorcionamento({ brutoQtd: 3200, brutoUn: "g", perda: { modo: "g", valor: 400 }, porcaoG: 120, custoPorUnidadeCadastro: 0.03, unidadeCadastro: "g" });
  assert.equal(c.limpoG, 2800);
  assert.equal(c.porcoes, 23);
  assert.equal(c.sobraG, 40);
  assert.equal(c.custoTotal, 96);
  assert.equal(c.custoPorcao, 4.17);
});

test("sem dado ou impossível: não inventa", () => {
  assert.equal(calcularPorcionamento({ brutoQtd: "", porcaoG: 150 }).ok, false);
  assert.match(calcularPorcionamento({ brutoQtd: 1, perda: { modo: "pct", valor: 100 }, porcaoG: 150 }).motivos[0], /perda/);
  assert.equal(calcularPorcionamento({ brutoQtd: 0.1, porcaoG: 150 }).ok, false);
  const semCusto = calcularPorcionamento({ brutoQtd: 1, porcaoG: 100 });
  assert.equal(semCusto.porcoes, 10);
  assert.equal(semCusto.custoPorcao, null);
});
