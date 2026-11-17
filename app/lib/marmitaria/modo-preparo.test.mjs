import test from "node:test";
import assert from "node:assert/strict";
import { numerarPassos, passosDoPreparo } from "./modo-preparo.mjs";

test("numera um passo por linha e refaz números digitados", () => {
  assert.equal(numerarPassos("Refogar o alho\n\n3) Refogar o arroz\n- Cozinhar 15 min"), "1. Refogar o alho\n2. Refogar o arroz\n3. Cozinhar 15 min");
  assert.equal(numerarPassos("   "), "");
  assert.deepEqual(passosDoPreparo("1. A\n2. B"), [{ n: 1, texto: "A" }, { n: 2, texto: "B" }]);
});

test("peso do lote: g e ml somam (ml como g, estimativa), unidades à parte", async () => {
  const { pesoDosIngredientes } = await import("./modo-preparo.mjs");
  const r = pesoDosIngredientes([{ qtd: "30", un: "g" }, { qtd: "15", un: "g" }, { qtd: "100", un: "ml" }, { qtd: "100", un: "ml" }, { qtd: "150", un: "g" }, { qtd: "2", un: "un" }, { qtd: "0,5", un: "kg" }]);
  assert.deepEqual(r, { gramas: 895, estimativa: true, semPeso: 1 });
});
