import { test } from "node:test";
import assert from "node:assert/strict";
import { atualizarPilha, temTelaAnterior, LIMITE_PILHA } from "./navegacao-pilha.mjs";

test("empilha a tela nova, desempilha ao voltar, ignora repetida", () => {
  let p = atualizarPilha([], "/dashboard/menu");
  p = atualizarPilha(p, "/dashboard/cozinha");
  p = atualizarPilha(p, "/dashboard/operacao/precificacao?dept=cozinha");
  assert.equal(temTelaAnterior(p), true);
  p = atualizarPilha(p, "/dashboard/cozinha"); // voltou
  assert.deepEqual(p, ["/dashboard/menu", "/dashboard/cozinha"]);
  assert.deepEqual(atualizarPilha(p, "/dashboard/cozinha"), p);
  assert.equal(temTelaAnterior(["/a"]), false);
  assert.equal(temTelaAnterior(null), false);
});

test("pilha tem limite", () => {
  let p = [];
  for (let i = 0; i < 50; i++) p = atualizarPilha(p, `/t${i}`);
  assert.equal(p.length, LIMITE_PILHA);
  assert.equal(p.at(-1), "/t49");
});
