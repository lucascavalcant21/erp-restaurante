import test from "node:test";
import assert from "node:assert/strict";
import { normalizarDelivery, tituloDoDelivery, NOME_PADRAO } from "./delivery.mjs";

test("nome e segmento do delivery", () => {
  assert.deepEqual(normalizarDelivery({ nome: "  Hamburgueria   do Lucas ", segmento: "hamburgueria" }), { nome: "Hamburgueria do Lucas", segmento: "hamburgueria" });
  assert.equal(normalizarDelivery({ segmento: "xyz" }).segmento, null);
  assert.equal(tituloDoDelivery(null), NOME_PADRAO);
  assert.equal(tituloDoDelivery({ nome: "Marmitas" }), "Marmitas · delivery");
  assert.equal(tituloDoDelivery({ nome: "Delivery Sel de Estrela" }), "Delivery Sel de Estrela");
});
