import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarItensEstoque,
  grupoOperacionalItem,
  gruposOperacionaisEstoque,
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

test("separa cozinha entre produtos prontos e ingredientes", () => {
  const estoque = { slug: "cozinha" };
  assert.deepEqual(gruposOperacionaisEstoque(estoque), ["Todos", "Produtos prontos", "Ingredientes"]);
  assert.equal(grupoOperacionalItem({ nome: "Arroz branco", categoria: "Secos", tipo_item: "ingrediente" }, estoque), "Ingredientes");
  assert.equal(grupoOperacionalItem({ nome: "Lasanha congelada", categoria: "Congelados", tipo_item: "produto" }, estoque), "Produtos prontos");
});

test("separa bar entre produtos, xaropes, guarnições e frutas", () => {
  const estoque = { slug: "bar" };
  assert.deepEqual(gruposOperacionaisEstoque(estoque), ["Todos", "Produtos", "Xaropes", "Guarnições", "Frutas"]);
  assert.equal(grupoOperacionalItem({ nome: "Xarope de baunilha", categoria: "Xaropes" }, estoque), "Xaropes");
  assert.equal(grupoOperacionalItem({ nome: "Hortelã", categoria: "Guarnições" }, estoque), "Guarnições");
  assert.equal(grupoOperacionalItem({ nome: "Limão tahiti", categoria: "Hortifruti" }, estoque), "Frutas");
  assert.equal(grupoOperacionalItem({ nome: "Vodka", categoria: "Destilados" }, estoque), "Produtos");
});

test("filtro operacional mostra somente o grupo selecionado", () => {
  const estoque = { slug: "bar", controla_minimo: true };
  const itens = [
    { nome: "Vodka", categoria: "Destilados" },
    { nome: "Xarope de gengibre", categoria: "Xaropes" },
  ];
  const resultado = filtrarItensEstoque(itens, { grupo: "Xaropes" }, estoque);
  assert.deepEqual(resultado.map(item => item.nome), ["Xarope de gengibre"]);
});
