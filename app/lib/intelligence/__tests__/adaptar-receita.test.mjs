// Adaptar a receita ao que o funcionário tem (pedido do dono, 08/11/2026). TESTADO EM MOCK.
import test from "node:test";
import assert from "node:assert/strict";
import { adaptarReceita, rotuloDoFator, qtdLegivel, unidadeDeTela } from "../metrics/adaptar-receita.mjs";

const VATAPA = [
  { nome: "Leite de coco", qtd: 2, unidade: "L" },
  { nome: "Camarão seco", qtd: 0.5, unidade: "kg" },
  { nome: "Farinha de trigo", qtd: 0.3, unidade: "kg" },
  { nome: "Pão", qtd: 4, unidade: "un" },
];

test("tem só 1 L de leite de coco (a receita pede 2 L): metade de tudo, rendimento junto", () => {
  const r = adaptarReceita(VATAPA, { 0: { estado: "pouco", qtd: 1 } }, { rendimentoQtd: 8, rendimentoUnidade: "porções" });
  assert.equal(r.fator, 0.5);
  assert.equal(r.limitante, "Leite de coco");
  assert.deepEqual(r.ingredientes.map((i) => i.quantidade), ["1 L", "250 g", "150 g", "2 un"]);
  assert.equal(r.rendimento, "4 porções");
  assert.equal(rotuloDoFator(r.fator), "50% da receita");
});

test("o ingrediente que mais falta manda", () => {
  const r = adaptarReceita(VATAPA, { 0: { estado: "pouco", qtd: 1.5 }, 1: { estado: "pouco", qtd: 0.1 } });
  assert.equal(r.fator, 0.2);
  assert.equal(r.limitante, "Camarão seco");
});

test("sem um ingrediente: sai da conta e a receita avisa (nada é inventado no lugar)", () => {
  const r = adaptarReceita(VATAPA, { 3: { estado: "nao" } });
  assert.equal(r.fator, 1);
  assert.deepEqual(r.faltando, ["Pão"]);
  assert.deepEqual(r.ingredientes[3], { nome: "Pão", falta: true, qtd: 0, quantidade: "não tem" });
});

test("fazer mais: dobrar a receita", () => {
  const r = adaptarReceita(VATAPA, {}, { multiplicar: 2, rendimentoQtd: 8 });
  assert.deepEqual(r.ingredientes.map((i) => i.quantidade), ["4 L", "1 kg", "600 g", "8 un"]);
  assert.equal(r.rendimento, "16 porções");
  assert.equal(rotuloDoFator(2), "2× a receita");
});

test("tem mais do que precisa não aumenta a receita; quantidade inválida não entra na conta", () => {
  assert.equal(adaptarReceita(VATAPA, { 0: { estado: "pouco", qtd: 5 } }).fator, 1);
  const r = adaptarReceita(VATAPA, { 1: { estado: "pouco", qtd: "abc" } });
  assert.deepEqual([r.fator, r.semConta], [1, ["Camarão seco"]]);
  assert.equal(adaptarReceita(VATAPA, { 0: { estado: "pouco", qtd: 0 } }).possivel, false);
});

test("unidade de tela: g e ml para quantidades pequenas", () => {
  assert.deepEqual(unidadeDeTela("kg", 0.3), { rotulo: "g", mult: 1000 });
  assert.deepEqual(unidadeDeTela("L", 2), { rotulo: "L", mult: 1 });
  assert.equal(qtdLegivel(0.0375, "l"), "37,5 ml");
});
