import test from "node:test";
import assert from "node:assert/strict";
import { marmitasDaEmbalagem, moverEtapa, normalizarProcesso, resumoDoProcesso } from "./processos.mjs";

test("embalagem aponta para as marmitas que ela serve", () => {
  const processos = { a: { embalagens: ["p1", "p2"] }, b: { embalagens: ["p2"] } };
  const marmitas = [{ id: "a", nome_receita: "Frango" }, { id: "b", nome_receita: "Carne" }];
  assert.deepEqual(marmitasDaEmbalagem(processos, "p2", marmitas), ["Frango", "Carne"]);
  assert.deepEqual(marmitasDaEmbalagem(processos, "p1", marmitas), ["Frango"]);
  assert.deepEqual(marmitasDaEmbalagem(undefined, "p1", marmitas), []);
});

test("mostra o que falta escrever", () => {
  const r = resumoDoProcesso({ embalagens: ["p1"], etapas: [{ id: "1", grupo: "montagem", titulo: "Arroz", texto: "Lado esquerdo" }, { id: "2", grupo: "coccao", titulo: "Fritura", minutos: 3, graus: 180 }, { id: "3", grupo: "entrega", titulo: "Saco kraft" }] });
  assert.deepEqual([r.etapas, r.escritas, r.grupos], [3, 2, ["Fechamento"]]);
});

test("ignora dado estranho e move só dentro do grupo", () => {
  assert.deepEqual(normalizarProcesso({ embalagens: ["a", "a", null], etapas: [{ id: 1, grupo: "x" }] }), { embalagens: ["a"], etapas: [] });
  const e = [{ id: "1", grupo: "montagem" }, { id: "2", grupo: "coccao" }, { id: "3", grupo: "montagem" }];
  assert.deepEqual(moverEtapa(e, "3", -1).map((x) => x.id), ["3", "2", "1"]);
  assert.deepEqual(moverEtapa(e, "1", -1).map((x) => x.id), ["1", "2", "3"]);
});
