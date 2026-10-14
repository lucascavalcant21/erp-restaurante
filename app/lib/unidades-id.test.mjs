// node --test app/lib/unidades-id.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { idDaUnidade, empresaPadrao } from "./unidades-id.mjs";

test("id da unidade: minúsculo, sem acento, com hífen", () => {
  assert.equal(idDaUnidade("Marmitaria"), "marmitaria");
  assert.equal(idDaUnidade("  Marmitaria São João!  "), "marmitaria-sao-joao");
  assert.equal(idDaUnidade(""), "unidade");
});

test("id da unidade: não repete nem usa os valores especiais", () => {
  assert.equal(idDaUnidade("Marmitaria", ["seldeestrela", "marmitaria"]), "marmitaria-2");
  assert.equal(idDaUnidade("Marmitaria", ["marmitaria", "marmitaria-2"]), "marmitaria-3");
  assert.equal(idDaUnidade("Todas"), "todas-2");
  assert.equal(idDaUnidade("Matriz"), "matriz-2");
});

test("empresa padrão só quando não há dúvida", () => {
  assert.equal(empresaPadrao([{ empresa_id: "e1" }, { empresa_id: "e1" }]), "e1");
  assert.equal(empresaPadrao([{ empresa_id: "e1" }, { empresa_id: "e2" }]), null);
  assert.equal(empresaPadrao([]), null);
});
