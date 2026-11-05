// Rode: node --test app/lib/marmitaria/etiquetas.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { COPIAS_MAX, copiasValidas, dataDaValidade, etiquetasDoRecebimento, htmlDasEtiquetas, textoDoRecebido } from "./etiquetas.mjs";

const frango = { nome: "Peito de frango", marca: "Sadia", unidade_medida: "KG" };

test("sai etiqueta só do que chegou e tem validade", () => {
  const r = etiquetasDoRecebimento([
    { insumo: frango, recebida: 5, validade: "2026-11-30", conservacao: "Congelado", copias: "2" },
    { insumo: frango, recebida: 0, validade: "2026-11-30" },
    { insumo: frango, recebida: 5, validade: "" },
  ]);
  assert.deepEqual(r, [{ produto: "Peito de frango Sadia", quantidade: 5, unidade: "kg", validade: "2026-11-30", conservacao: "Congelado", copias: 2 }]);
});

test("cópias ficam entre 1 e o limite", () => {
  assert.equal(copiasValidas(""), 1);
  assert.equal(copiasValidas("0"), 1);
  assert.equal(copiasValidas("-3"), 1);
  assert.equal(copiasValidas("3"), 3);
  assert.equal(copiasValidas("9999"), COPIAS_MAX);
});

test("a validade não volta um dia no fuso do Brasil", () => {
  const d = dataDaValidade("2026-11-30");
  assert.equal(d.getDate(), 30);
  assert.equal(d.getMonth(), 10);
});

test("html repete as cópias, mostra a validade e escapa o nome", () => {
  const html = htmlDasEtiquetas([{ produto: "Molho <b>", quantidade: 2.5, unidade: "kg", validade: "2026-11-30", conservacao: "Resfriado", copias: 2 }], { responsavel: "Ana", recebidoEm: "2026-11-05" });
  assert.equal(html.match(/<section>/g).length, 2);
  assert.ok(html.includes("VAL.: 30/11/2026"));
  assert.ok(html.includes("2,5 kg"));
  assert.ok(!html.includes("<b>"));
});

test("recebido mostra a unidade e a diferença em palavras", () => {
  assert.equal(textoDoRecebido({ descricao_snapshot: "Peito de frango", quantidade_embalagens: 5, quantidade_pedida_embalagens: 2.5 }, "KG"), "Peito de frango 5 kg (chegou 2,5 kg a mais do pedido)");
  assert.equal(textoDoRecebido({ descricao_snapshot: "Peito de frango", quantidade_embalagens: 2, quantidade_pedida_embalagens: 2.5 }, "kg"), "Peito de frango 2 kg (chegou 0,5 kg a menos do pedido)");
  assert.equal(textoDoRecebido({ descricao_snapshot: "Marmitex", quantidade_embalagens: 30, quantidade_pedida_embalagens: 30 }, "un"), "Marmitex 30 un");
  assert.equal(textoDoRecebido({ descricao_snapshot: "Marmitex", quantidade_embalagens: 30, quantidade_pedida_embalagens: null }, "un"), "Marmitex 30 un");
});
