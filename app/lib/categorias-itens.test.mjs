import test from "node:test";
import assert from "node:assert/strict";
import { agruparItens, categoriaDoItem, nomeCategoria, opcoesCategoria, SEM_CATEGORIA } from "./categorias-itens.mjs";

test("categoria automática antiga conta como sem categoria", () => {
  assert.equal(categoriaDoItem({ categoria: "Marmitaria" }), "");
  assert.equal(categoriaDoItem({ categoria: "Embalagens da marmitaria" }), "");
  assert.equal(categoriaDoItem({ categoria: " Proteínas " }), "Proteínas");
});

test("agrupa A–Z com sem categoria no fim; opções = usadas + sugeridas sem repetir", () => {
  const itens = [{ nome: "Sassami", categoria: "Proteínas" }, { nome: "Alho", categoria: "Marmitaria" }, { nome: "Arroz", categoria: "Mercearia" }];
  assert.deepEqual(agruparItens(itens).map((g) => g.categoria), ["Mercearia", "Proteínas", SEM_CATEGORIA]);
  const op = opcoesCategoria(itens, "ingrediente");
  assert.deepEqual(op.slice(0, 2), ["Mercearia", "Proteínas"]);
  assert.equal(op.filter((x) => x === "Proteínas").length, 1);
  assert.equal(nomeCategoria("  doces da casa "), "Doces da casa");
});
