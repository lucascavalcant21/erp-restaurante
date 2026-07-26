import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarItensEstoque,
  slugEstoque,
  statusItemEstoque,
  tiposCompativeis,
} from "./estoques-multiplos-utils.mjs";

test("gera identificador estável para o estoque", () => {
  assert.equal(slugEstoque("Materiais variados"), "materiais-variados");
  assert.equal(slugEstoque("  LIMPEZA / Geral "), "limpeza-geral");
});

test("permite transferência apenas entre tipos compatíveis", () => {
  assert.equal(tiposCompativeis("alimentos", "bebidas"), true);
  assert.equal(tiposCompativeis("limpeza", "limpeza"), true);
  assert.equal(tiposCompativeis("limpeza", "embalagens"), false);
});

test("calcula mínimo e validade conforme configuração do estoque", () => {
  const status = statusItemEstoque(
    { quantidade_atual: 2, estoque_minimo: 5, validade: "2026-07-28" },
    { controla_minimo: true, controla_validade: true },
    new Date("2026-07-25T12:00:00"),
  );
  assert.equal(status.abaixoMinimo, true);
  assert.equal(status.validadeProxima, true);
  assert.equal(status.vencido, false);
});

test("ignora validade quando o estoque não controla validade", () => {
  const status = statusItemEstoque(
    { quantidade_atual: 3, estoque_minimo: 1, validade: "2020-01-01" },
    { controla_minimo: true, controla_validade: false },
  );
  assert.equal(status.diasValidade, null);
});

test("pesquisa e filtros ficam restritos à lista do estoque ativo", () => {
  const itens = [
    { nome: "Detergente", categoria: "Limpeza", local_interno: "Armário", quantidade_atual: 2, estoque_minimo: 4 },
    { nome: "Pote 500 ml", categoria: "Embalagens", local_interno: "Depósito", quantidade_atual: 20, estoque_minimo: 10 },
  ];
  const resultado = filtrarItensEstoque(itens, { busca: "detergente", status: "abaixo" }, {
    controla_minimo: true,
    controla_validade: false,
  });
  assert.deepEqual(resultado.map(item => item.nome), ["Detergente"]);
});
