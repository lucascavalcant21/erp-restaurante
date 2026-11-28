import { test } from "node:test";
import assert from "node:assert/strict";
import { previaDaConta } from "./conta-previa.mjs";
import { contaDosModulos } from "./contas-rapidas.mjs";

test("prévia: ponto, nico, cozinha com cards permitidos e vários módulos", () => {
  assert.equal(previaDaConta(contaDosModulos(["ponto"])).tipo, "ponto");
  assert.equal(previaDaConta(contaDosModulos(["nico"])).tipo, "nico");
  const coz = previaDaConta(contaDosModulos(["cozinha"]));
  assert.equal(coz.tipo, "cards");
  assert.ok(coz.cards.length > 0);
  // conta rápida nunca vê precificação nem custo
  assert.ok(!coz.cards.some((c) => /Precifica/.test(c.label)));
  const varios = previaDaConta(contaDosModulos(["cozinha", "ponto"]));
  assert.equal(varios.tipo, "inicio");
  assert.deepEqual(varios.cards.map((c) => c.label), ["Cozinha", "Ponto dos funcionários"]);
  assert.equal(previaDaConta(null), null);
});
