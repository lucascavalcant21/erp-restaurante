import test from "node:test";
import assert from "node:assert/strict";
import {
  estoquePrincipalDoSetor,
  filtrarItensEstoque,
  grupoOperacionalItem,
  gruposOperacionaisEstoque,
  slugEstoque,
  setorAutomaticoDoEstoque,
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

test("cozinha é separada pelo tipo do insumo", () => {
  const estoque = { slug: "cozinha" };
  assert.deepEqual(gruposOperacionaisEstoque(estoque), [
    "Todos", "Carne vermelha", "Peixe", "Aves", "Frutos do mar", "Caranguejo",
    "Laticínios", "Hortifrúti", "Secos", "Líquidos", "Pré-preparos",
  ]);
  // A categoria cadastrada manda: é a escolha do usuário.
  assert.equal(grupoOperacionalItem({ nome: "Arroz branco", categoria: "Secos" }, estoque), "Secos");
  // Categoria genérica ou vazia: o nome do produto decide.
  assert.equal(grupoOperacionalItem({ nome: "Picanha bovina", categoria: "Ingredientes" }, estoque), "Carne vermelha");
  assert.equal(grupoOperacionalItem({ nome: "Filé de tilápia", categoria: "" }, estoque), "Peixe");
  assert.equal(grupoOperacionalItem({ nome: "Queijo mussarela", categoria: "Sem categoria" }, estoque), "Laticínios");
});

test("bar é separado pelo tipo da bebida", () => {
  const estoque = { slug: "bar" };
  assert.deepEqual(gruposOperacionaisEstoque(estoque), [
    "Todos", "Cervejas", "Destilados", "Vinhos", "Chopp", "Água",
    "Refrigerantes", "Bombons", "Pré-preparos",
  ]);
  assert.equal(grupoOperacionalItem({ nome: "Vodka Absolut", categoria: "Destilados" }, estoque), "Destilados");
  // "Bebidas" não diz nada: cai no reconhecimento pelo nome.
  assert.equal(grupoOperacionalItem({ nome: "Heineken long neck", categoria: "Bebidas" }, estoque), "Cervejas");
  assert.equal(grupoOperacionalItem({ nome: "Coca-Cola 2L", categoria: "" }, estoque), "Refrigerantes");
  assert.equal(grupoOperacionalItem({ nome: "Monin de baunilha", categoria: "Bebidas" }, estoque), "Pré-preparos");
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

test("só o estoque principal do setor recebe produto novo automaticamente", () => {
  assert.equal(setorAutomaticoDoEstoque({ slug: "bar", nome: "Bar" }), "bar");
  assert.equal(setorAutomaticoDoEstoque({ slug: "cozinha", nome: "Cozinha" }), "cozinha");
  assert.equal(setorAutomaticoDoEstoque({ slug: "limpeza", nome: "Limpeza" }), "limpeza");
  // Pré-preparo é abastecido pela produção, não pelo catálogo de compras.
  assert.equal(setorAutomaticoDoEstoque({ slug: "pre-preparos-bar", nome: "Pré-preparos do Bar" }), "");
  assert.equal(setorAutomaticoDoEstoque({ slug: "pre-preparos-cozinha", nome: "Pré-preparos da Cozinha" }), "");
  // Depósito e materiais são gerais: não são a casa de nenhum setor.
  assert.equal(setorAutomaticoDoEstoque({ slug: "deposito", nome: "Depósito" }), "");
  assert.equal(setorAutomaticoDoEstoque({ slug: "materiais-variados", nome: "Materiais variados" }), "");
  // Embalagens é setor próprio, e não o bar/cozinha do nome.
  assert.equal(setorAutomaticoDoEstoque({ slug: "embalagens-bar", nome: "Embalagens do Bar" }), "embalagens");
});

test("produto do bar vai para o estoque Bar, não para o pré-preparo dele", () => {
  // Ordem embaralhada de propósito: o banco devolve as linhas sem ordem
  // garantida, e era daí que vinha o produto indo parar no estoque errado.
  const estoques = [
    { id: "1", slug: "pre-preparos-bar", nome: "Pré-preparos do Bar" },
    { id: "2", slug: "embalagens-bar", nome: "Embalagens do Bar" },
    { id: "3", slug: "bar", nome: "Bar" },
    { id: "4", slug: "cozinha", nome: "Cozinha" },
    { id: "5", slug: "deposito", nome: "Depósito" },
  ];
  assert.equal(estoquePrincipalDoSetor(estoques, "bar")?.id, "3");
  assert.equal(estoquePrincipalDoSetor(estoques, "cozinha")?.id, "4");
  assert.equal(estoquePrincipalDoSetor(estoques, "embalagens")?.id, "2");
});

test("setor sem estoque não escolhe um estoque qualquer", () => {
  const estoques = [{ id: "1", slug: "cozinha", nome: "Cozinha" }];
  // Antes caía num `|| estoques[0]` e a bebida ia parar na cozinha.
  assert.equal(estoquePrincipalDoSetor(estoques, "bar"), null);
  assert.equal(estoquePrincipalDoSetor(estoques, ""), null);
  assert.equal(estoquePrincipalDoSetor([], "bar"), null);
  assert.equal(estoquePrincipalDoSetor(null, "bar"), null);
});
