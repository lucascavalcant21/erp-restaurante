// Rode: node --test app/lib/observacoes-prontas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { alternarObservacao, limparLista, mesclarObservacoes, observacoesDoProduto, temObservacao } from "./observacoes-prontas.mjs";

test("limparLista: tira vazio, repetida, vírgula e limita", () => {
  assert.deepEqual(limparLista([" Sem gelo ", "sem GELO", "", "a,b", "x".repeat(60)]), ["Sem gelo", "a b", "x".repeat(40)]);
  assert.equal(limparLista(Array.from({ length: 30 }, (_, i) => `Obs ${i}`)).length, 20);
});

test("mesclarObservacoes: padrão quando nada foi salvo; lista vazia salva vale vazia", () => {
  const p = mesclarObservacoes(null);
  assert.ok(p.setor.cozinha.includes("Sem cebola"));
  assert.ok(p.setor.bar.includes("Sem gelo"));
  const v = mesclarObservacoes({ setor: { cozinha: [] }, categoria: { Carnes: ["Mal passada", "Ao ponto"], Vazia: [] } });
  assert.deepEqual(v.setor.cozinha, []);
  assert.ok(v.setor.bar.length > 0);
  assert.deepEqual(Object.keys(v.categoria), ["Carnes"]);
});

test("observacoesDoProduto: categoria primeiro, depois o setor, sem repetir", () => {
  const cfg = { setor: { cozinha: ["Sem cebola", "Para viagem"], bar: ["Sem gelo"] }, categoria: { carnes: ["Mal passada", "Para viagem"] } };
  assert.deepEqual(observacoesDoProduto(cfg, { departamento: "cozinha", categoria: "Carnes" }), ["Mal passada", "Para viagem", "Sem cebola"]);
  assert.deepEqual(observacoesDoProduto(cfg, { departamento: "Bar", categoria: "Sucos" }), ["Sem gelo"]);
  assert.deepEqual(observacoesDoProduto(cfg, {}), ["Sem cebola", "Para viagem"]);
});

test("alternarObservacao: põe, tira e mantém o texto digitado", () => {
  let o = "bem quente";
  o = alternarObservacao(o, "Sem cebola");
  assert.equal(o, "bem quente, Sem cebola");
  assert.equal(temObservacao(o, "sem cebola"), true);
  o = alternarObservacao(o, "SEM CEBOLA");
  assert.equal(o, "bem quente");
  assert.equal(alternarObservacao("", "Sem gelo"), "Sem gelo");
  assert.equal(alternarObservacao("x".repeat(119), "Sem gelo").length, 120);
});
