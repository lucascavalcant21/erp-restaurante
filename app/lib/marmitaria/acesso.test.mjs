import test from "node:test";
import assert from "node:assert/strict";
import { limparEntradaAntiga, unidadeForaDaMarmitaria } from "./acesso.mjs";

test("o app abre fora da marmitaria", () => {
  const unidades = [{ id: "marmitaria" }, { id: "seldeestrela" }];
  assert.equal(unidadeForaDaMarmitaria(unidades, "marmitaria", "marmitaria"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria(unidades, null, "marmitaria"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria(unidades, "seldeestrela"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria(unidades, "apagada", "seldeestrela"), "seldeestrela");
  assert.equal(unidadeForaDaMarmitaria([...unidades, { id: "outra" }], "outra"), "outra");
  assert.equal(unidadeForaDaMarmitaria([]), "");
});

test("login só da marmitaria continua nela", () => {
  assert.equal(unidadeForaDaMarmitaria([{ id: "marmitaria" }], "marmitaria"), "marmitaria");
});

test("solta o aparelho preso na trava antiga", () => {
  const m = new Map([["hefisto:marmitaria:dentro", "{}"]]);
  limparEntradaAntiga({ removeItem: (k) => m.delete(k) });
  assert.equal(m.size, 0);
  assert.doesNotThrow(() => limparEntradaAntiga(null));
});
