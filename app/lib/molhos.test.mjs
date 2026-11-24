import test from "node:test";
import assert from "node:assert/strict";
import { ehMolho, textoRendimento } from "./molhos.mjs";

test("molho é base com molho no nome ou na categoria Molhos", () => {
  assert.equal(ehMolho({ nome: "Molho de tucupi (base)", base: true }), true);
  assert.equal(ehMolho({ nome_receita: "Vinagrete (base)", eh_base: true }), true);
  assert.equal(ehMolho({ nome: "Pimenta da casa", base: true, categoria: "Molhos" }), true);
  assert.equal(ehMolho({ nome: "Farofa de castanha (base)", base: true, categoria: "Molhos e caldos" }), false);
  assert.equal(ehMolho({ nome: "Frango ao molho", base: false }), false);
  assert.equal(textoRendimento(3, "L"), "Rende 3 L");
  assert.equal(textoRendimento("2.5", "kg"), "Rende 2,5 kg");
  assert.equal(textoRendimento(null, "kg"), "Rendimento não cadastrado");
});
