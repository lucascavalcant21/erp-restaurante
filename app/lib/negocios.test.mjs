// Rode: node --test app/lib/negocios.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { ehNegocioSeparado, negocioAtual, negociosDoLogin, unidadeInicial } from "./negocios.mjs";

const unidades = [{ id: "eventos" }, { id: "marmitaria" }, { id: "seldeestrela" }];

test("o app abre no restaurante, mesmo com outro negócio antes na lista", () => {
  assert.equal(unidadeInicial(unidades, "eventos"), "seldeestrela");
  assert.equal(unidadeInicial(unidades, null, "marmitaria"), "seldeestrela");
  assert.equal(unidadeInicial(unidades, "seldeestrela"), "seldeestrela");
  assert.equal(unidadeInicial(unidades, "apagada", "seldeestrela"), "seldeestrela");
  assert.equal(unidadeInicial([]), "");
});

test("login de um negócio só continua nele", () => {
  assert.equal(unidadeInicial([{ id: "marmitaria" }], "marmitaria"), "marmitaria");
  assert.equal(unidadeInicial([{ id: "eventos" }], "eventos"), "eventos");
});

test("mostra o negócio aberto", () => {
  assert.equal(negocioAtual("/dashboard", "seldeestrela"), "restaurante");
  assert.equal(negocioAtual("/dashboard/rh", "eventos"), "eventos");
  assert.equal(negocioAtual("/dashboard/rh", "marmitaria"), "marmitaria");
  assert.equal(negocioAtual("/dashboard/marmitaria/estoque", "seldeestrela"), "marmitaria");
  assert.equal(negocioAtual("/dashboard/marmitariax", "seldeestrela"), "restaurante");
  assert.equal(negocioAtual("/dashboard/reservas-eventos", "seldeestrela"), "restaurante");
});

test("a troca lista só o que o login alcança", () => {
  assert.deepEqual(negociosDoLogin(unidades).map((n) => [n.id, n.unidadeId]), [["restaurante", "seldeestrela"], ["marmitaria", "marmitaria"], ["eventos", "eventos"]]);
  assert.deepEqual(negociosDoLogin(unidades, (r) => r !== "/dashboard/marmitaria").map((n) => n.id), ["restaurante", "eventos"]);
});

test("com um negócio só, não aparece a troca", () => {
  assert.deepEqual(negociosDoLogin([{ id: "seldeestrela" }]), []);
  assert.deepEqual(negociosDoLogin([{ id: "marmitaria" }]), []);
  assert.deepEqual(negociosDoLogin(unidades, () => false), []);
});

test("restaurante não é negócio separado", () => {
  assert.equal(ehNegocioSeparado("seldeestrela"), false);
  assert.equal(ehNegocioSeparado("eventos"), true);
});
