import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoNoBar } from "./ficha-calculos.mjs";

test("no bar: 1 item é produto, mais de 1 é drink", () => {
  assert.equal(tipoNoBar({ departamento: "bar", fichas_ingredientes: [{}] }), "produto");
  assert.equal(tipoNoBar({ departamento: "bar", fichas_ingredientes: [{}, {}] }), "drink");
  assert.equal(tipoNoBar({ departamento: "cozinha", fichas_ingredientes: [{}] }), null);
  assert.equal(tipoNoBar({ departamento: "bar", eh_base: true, fichas_ingredientes: [{}] }), null);
  assert.equal(tipoNoBar({ departamento: "bar", tipo_base: "produto_pronto", fichas_ingredientes: [{}] }), null);
});
