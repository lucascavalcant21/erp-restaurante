import test from "node:test";
import assert from "node:assert/strict";
import {
  estimarPaginasDocumento,
  ordenarFichasDocumento,
  separarFichasPorDependencias,
} from "./fichas-lote-utils.mjs";

const fichas = [
  { id: "2", nome_receita: "Zabaione", categoria: "Sobremesas", eh_base: false },
  { id: "1", nome_receita: "Arroz", categoria: "Pratos", eh_base: false },
  { id: "3", nome_receita: "Caldo base", categoria: "Bases", eh_base: true, tipo_base: "receita" },
];

test("preserva a ordem de seleção e ordena por nome", () => {
  assert.deepEqual(ordenarFichasDocumento(fichas).map(f => f.id), ["2", "1", "3"]);
  assert.deepEqual(ordenarFichasDocumento(fichas, "nome").map(f => f.id), ["1", "3", "2"]);
});

test("ordena por categoria, tipo e ordem personalizada", () => {
  assert.deepEqual(ordenarFichasDocumento(fichas, "categoria").map(f => f.id), ["3", "1", "2"]);
  assert.deepEqual(ordenarFichasDocumento(fichas, "tipo").map(f => f.id), ["1", "2", "3"]);
  assert.deepEqual(ordenarFichasDocumento(fichas, "personalizada", ["3", "2", "1"]).map(f => f.id), ["3", "2", "1"]);
});

test("estima páginas com capa e índice", () => {
  assert.equal(estimarPaginasDocumento(8, { capa: true, indice: true, modelo: "gerencial" }), 10);
  assert.equal(estimarPaginasDocumento(8, { modelo: "resumido" }), 4);
});

test("separa fichas livres das que possuem dependências", () => {
  const resultado = separarFichasPorDependencias(fichas, { porFicha: { "1": ["Cardápio"] } });
  assert.deepEqual(resultado.vinculadas.map(f => f.id), ["1"]);
  assert.deepEqual(resultado.livres.map(f => f.id), ["2", "3"]);
});
