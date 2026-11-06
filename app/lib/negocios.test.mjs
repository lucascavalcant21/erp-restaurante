// Rode: node --test app/lib/negocios.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { NEGOCIOS, negocioDaRota, negociosVisiveis } from "./negocios.mjs";

test("a rota diz o negócio aberto", () => {
  assert.equal(negocioDaRota("/dashboard"), "restaurante");
  assert.equal(negocioDaRota("/dashboard/rh"), "restaurante");
  assert.equal(negocioDaRota("/dashboard/marmitaria"), "marmitaria");
  assert.equal(negocioDaRota("/dashboard/marmitaria/estoque/compras"), "marmitaria");
  assert.equal(negocioDaRota("/dashboard/reservas-eventos/eventos/1"), "eventos");
  assert.equal(negocioDaRota("/dashboard/marmitariax"), "restaurante");
  assert.equal(negocioDaRota(null), "restaurante");
});

test("mostra só o que o login alcança", () => {
  assert.equal(negociosVisiveis(() => true).length, NEGOCIOS.length);
  assert.deepEqual(negociosVisiveis((r) => r !== "/dashboard/reservas-eventos").map((n) => n.id), ["restaurante", "marmitaria"]);
});

test("com um negócio só, não aparece a troca", () => {
  assert.deepEqual(negociosVisiveis((r) => r === "/dashboard/marmitaria"), []);
  assert.deepEqual(negociosVisiveis(() => false), []);
});
