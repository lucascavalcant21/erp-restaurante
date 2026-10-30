import test from "node:test";
import assert from "node:assert/strict";
import { casaBusca, normalizarParaBusca } from "./busca.mjs";

test("sem acento e sem ç dá o mesmo resultado", () => {
  assert.equal(casaBusca("Açúcar refinado", "acucar"), true);
  assert.equal(casaBusca("Feijão preto", "FEIJAO"), true);
  assert.equal(casaBusca("Maçã verde", "maca"), true);
  assert.equal(normalizarParaBusca("Pão-de-Queijo"), "pao de queijo");
});

test("entende pelas primeiras letras de cada palavra", () => {
  assert.equal(casaBusca("Bolinho de carne", "bol car"), true);
  assert.equal(casaBusca("Bolinho de carne", "carne"), true);
  assert.equal(casaBusca("Bolinho de carne", "bol frango"), false);
  assert.equal(casaBusca(["Coca-Cola lata", "Bebidas"], "coca beb"), true);
  assert.equal(casaBusca("Qualquer", "  "), true);
});
