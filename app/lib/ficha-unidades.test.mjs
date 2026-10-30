import test from "node:test";
import assert from "node:assert/strict";

test("pacote do bolinho: kg, unidade e porção; ficha por unidade ou porção", async () => {
  const { contaDoPacote, modosDeLancamento, modoInicial, pesosDoInsumo } = await import("./ficha-calculos.mjs");
  const c = contaDoPacote({ pesoPacoteG: 300, precoPacote: 12, unidadesNoPacote: 12, porcaoG: 100 });
  assert.equal(c.precoKg, 40);
  assert.deepEqual(c.unidade, { pesoG: 25, preco: 1, porPacote: 12 });
  assert.deepEqual(c.porcao, { pesoG: 100, preco: 4, porPacote: 3 });
  const p = pesosDoInsumo({ unidade_medida: "kg", peso_peca_g: 25, medida_padrao: 0.1 });
  assert.deepEqual([p.unidadeG, p.porcaoG], [25, 100]);
  const modos = modosDeLancamento({ unidade: "kg", unidadeG: p.unidadeG, porcaoG: p.porcaoG });
  assert.deepEqual(modos.map((m) => m.id), ["base", "sub", "un", "porcao"]);
  // 3 unidades = 0,075 kg gravados; 2 porções = 0,2 kg
  const un = modos.find((m) => m.id === "un"); const po = modos.find((m) => m.id === "porcao");
  assert.equal(Math.round((3 / un.fator) * 1000) / 1000, 0.075);
  assert.equal(Math.round((2 / po.fator) * 1000) / 1000, 0.2);
  assert.equal(modoInicial(0.075, modos), "un");
  assert.equal(modoInicial(0.33, modos), "sub");
  assert.equal(contaDoPacote({ pesoPacoteG: 0, precoPacote: 12 }), null);
});

test("marmita: 3 bolinhos (un) e 2 porções viram kg do cadastro", async () => {
  const { paraUnidadeDoCadastro, unidadesCompativeis } = await import("./marmitaria/nucleo.mjs");
  const pesos = { unidadeG: 25, porcaoG: 100 };
  assert.deepEqual(unidadesCompativeis("kg", pesos), ["g", "kg", "un", "porcao"]);
  assert.deepEqual(unidadesCompativeis("kg"), ["g", "kg"]);
  assert.equal(paraUnidadeDoCadastro(3, "un", "kg", pesos), 0.075);
  assert.equal(paraUnidadeDoCadastro(2, "porcao", "kg", pesos), 0.2);
  assert.equal(paraUnidadeDoCadastro(3, "un", "kg"), null);
});
