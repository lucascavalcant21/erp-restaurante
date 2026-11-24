import test from "node:test";
import assert from "node:assert/strict";
import { nomeDeBase, nomeSemBase } from "./nome-base.mjs";

test("base sempre termina com (base), sem repetir", () => {
  assert.equal(nomeDeBase("Arroz branco"), "Arroz branco (base)");
  assert.equal(nomeDeBase(" Arroz branco "), "Arroz branco (base)");
  assert.equal(nomeDeBase("Arroz branco (base)"), "Arroz branco (base)");
  assert.equal(nomeDeBase("Arroz branco (Base)"), "Arroz branco (base)");
  assert.equal(nomeDeBase("Arroz branco - base"), "Arroz branco (base)");
  assert.equal(nomeDeBase("Vatapá de camarão (base)"), "Vatapá de camarão (base)");
  assert.equal(nomeDeBase("Molho base de tomate"), "Molho base de tomate (base)");
  assert.equal(nomeDeBase(""), "");
  assert.equal(nomeSemBase("Arroz branco (base)"), "Arroz branco");
  assert.equal(nomeSemBase("Base"), "Base");
});
