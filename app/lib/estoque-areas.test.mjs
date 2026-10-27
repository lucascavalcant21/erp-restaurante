// node --test app/lib/estoque-areas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { areaDoLocal, subareaDoLocal, areasComLocais, categoriaNaArea } from "./estoque-areas.mjs";

// Os 11 locais reais da unidade seldeestrela (11/10/2026)
const LOCAIS = [
  { id: 1, nome: "Cozinha", tipo: "alimentos" }, { id: 2, nome: "Bar", tipo: "bebidas" },
  { id: 3, nome: "Pré-preparos da Cozinha", tipo: "alimentos" }, { id: 4, nome: "Limpeza", tipo: "limpeza" },
  { id: 5, nome: "Pré-preparos do Bar", tipo: "bebidas" }, { id: 6, nome: "Materiais variados", tipo: "materiais" },
  { id: 7, nome: "Pré-preparos do Salão", tipo: "alimentos" }, { id: 8, nome: "Embalagens", tipo: "embalagens" },
  { id: 9, nome: "Embalagens da Cozinha", tipo: "embalagens" }, { id: 10, nome: "Embalagens do Bar", tipo: "embalagens" },
  { id: 11, nome: "Depósito", tipo: "materiais" },
];

test("cada local real cai na sua área", () => {
  const por = Object.fromEntries(LOCAIS.map((l) => [l.nome, areaDoLocal(l)]));
  assert.deepEqual(por, {
    "Cozinha": "cozinha", "Bar": "bar", "Pré-preparos da Cozinha": "cozinha", "Limpeza": "limpeza",
    "Pré-preparos do Bar": "bar", "Materiais variados": "outros", "Pré-preparos do Salão": "salao",
    "Embalagens": "outros", "Embalagens da Cozinha": "cozinha", "Embalagens do Bar": "bar", "Depósito": "outros",
  });
});

test("pré-preparos é subárea (não duplica produto: é outro local do mesmo cadastro)", () => {
  assert.equal(subareaDoLocal({ nome: "Pré-preparos da Cozinha" }), "preparo");
  assert.equal(subareaDoLocal({ nome: "Embalagens do Bar" }), "embalagens");
  assert.equal(subareaDoLocal({ nome: "Bar" }), "principal");
});

test("áreas na ordem Cozinha, Bar, Salão, Limpeza, Outros; local principal primeiro", () => {
  const a = areasComLocais(LOCAIS);
  assert.deepEqual(a.map((x) => x.id), ["cozinha", "bar", "salao", "limpeza", "outros"]);
  assert.deepEqual(a[0].locais.map((l) => l.nome), ["Cozinha", "Pré-preparos da Cozinha", "Embalagens da Cozinha"]);
  assert.deepEqual(a[1].locais.map((l) => l.nome), ["Bar", "Pré-preparos do Bar", "Embalagens do Bar"]);
});

test("área sem local aparece vazia (Salão sem local); 'Outros' só se houver local", () => {
  const a = areasComLocais([{ id: 1, nome: "Cozinha" }]);
  assert.deepEqual(a.map((x) => [x.id, x.locais.length]), [["cozinha", 1], ["bar", 0], ["salao", 0], ["limpeza", 0]]);
});

test("com o local Salão criado (EST-LOCAL-1): Salão é o principal, pré-preparos depois", () => {
  const a = areasComLocais([...LOCAIS, { id: 12, nome: "Salão", tipo: "materiais" }]);
  assert.deepEqual(a.find((x) => x.id === "salao").locais.map((l) => l.nome), ["Salão", "Pré-preparos do Salão"]);
  assert.equal(a.find((x) => x.id === "outros").locais.some((l) => l.nome === "Salão"), false);
});

test("categorias por área", () => {
  assert.equal(categoriaNaArea({ nome: "Corona", categoria: "Cerveja" }, "bar"), "Cervejas");
  assert.equal(categoriaNaArea({ nome: "Coca cola", categoria: "Refrigerante" }, "bar"), "Refrigerantes");
  assert.equal(categoriaNaArea({ nome: "Filé de tilápia", categoria: "" }, "cozinha"), "Peixes");
  assert.equal(categoriaNaArea({ nome: "Peito de frango" }, "cozinha"), "Frango");
  assert.equal(categoriaNaArea({ nome: "Detergente neutro" }, "limpeza"), "Detergentes");
  assert.equal(categoriaNaArea({ nome: "Balde" }, "limpeza"), "Outros materiais");
  assert.equal(categoriaNaArea({ nome: "Guardanapo" }, "salao"), "Papéis");
  assert.equal(categoriaNaArea({ nome: "Coisa estranha" }, "cozinha"), null);
});

test("máquina de lavar da cozinha e do bar ficam na área Limpeza", () => {
  assert.equal(areaDoLocal({ nome: "Máquina de lavar da Cozinha", slug: "maquina-cozinha", tipo: "limpeza" }), "limpeza");
  assert.equal(areaDoLocal({ nome: "Máquina de lavar do Bar", slug: "maquina-bar", tipo: "limpeza" }), "limpeza");
});

