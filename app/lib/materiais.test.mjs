// Materiais da casa: cadastro validado e saldo por local de cada grupo.
import test from "node:test";
import assert from "node:assert/strict";
import { GRUPOS_MATERIAIS, grupoMaterial, validarMaterial, situacaoDosMateriais, resumoDosMateriais } from "./materiais.mjs";
import { ESTOQUES_PADRAO } from "./estoques-multiplos-utils.mjs";

test("três grupos, cada um com os seus estoques; todo local existe nos estoques padrão", () => {
  assert.deepEqual(GRUPOS_MATERIAIS.map((g) => g.id), ["limpeza", "maquina", "embalagens"]);
  assert.deepEqual(grupoMaterial("maquina").locais.map((l) => l.slug), ["maquina-cozinha", "maquina-bar"]);
  const padrao = new Set(ESTOQUES_PADRAO.map((e) => e.slug));
  for (const g of GRUPOS_MATERIAIS) for (const l of g.locais) assert.ok(padrao.has(l.slug), `${l.slug} nos estoques padrão`);
  // O banco só aceita estes tipos de estoque (estoques_tipo_check).
  for (const e of ESTOQUES_PADRAO) assert.ok(["alimentos", "bebidas", "limpeza", "materiais", "embalagens"].includes(e.tipo), e.slug);
});

test("cadastro: nome e local obrigatórios; categoria e unidade fora da lista viram o padrão do grupo", () => {
  const r = validarMaterial("maquina", { nome: "  Secante  Suma ", categoria: "Secante", unidade: "L", local: "maquina-bar", minimo: "2,5", custo: "48" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.produto, { nome: "Secante Suma", categoria: "Secante", unidade: "L", local: "maquina-bar", minimo: 2.5, custo: 48, departamento: "maquina" });
  const x = validarMaterial("limpeza", { nome: "Detergente", categoria: "Inventada", unidade: "tonel", local: "limpeza" });
  assert.equal(x.produto.categoria, "Outros materiais");
  assert.equal(x.produto.unidade, "un");
  const e = validarMaterial("embalagens", { nome: "a", local: "cozinha", minimo: "-1", custo: "abc" });
  assert.equal(e.ok, false);
  assert.deepEqual(Object.keys(e.erros).sort(), ["custo", "local", "minimo", "nome"]);
  assert.equal(validarMaterial("outro", {}).ok, false);
});

test("situação por local: zerado e baixo primeiro; item em local de outro grupo não conta", () => {
  const insumos = [{ id: "a", nome: "Secante" }, { id: "b", nome: "Detergente de máquina" }, { id: "c", nome: "Sanitizante" }, { id: "d", nome: "Novo" }];
  const itens = [
    { insumo_id: "a", estoque_slug: "maquina-cozinha", quantidade_atual: 10, estoque_minimo: 2 },
    { insumo_id: "a", estoque_slug: "maquina-bar", quantidade_atual: 1, estoque_minimo: 2 },
    { insumo_id: "b", estoque_slug: "maquina-cozinha", quantidade_atual: 0, estoque_minimo: 1 },
    { insumo_id: "c", estoque_slug: "maquina-bar", quantidade_atual: 5, estoque_minimo: 0 },
    { insumo_id: "c", estoque_slug: "cozinha", quantidade_atual: 99, estoque_minimo: 0 },
  ];
  const s = situacaoDosMateriais("maquina", insumos, itens);
  assert.deepEqual(s.map((p) => [p.id, p.estado]), [["b", "zerado"], ["a", "baixo"], ["d", "sem_estoque"], ["c", "ok"]]);
  assert.deepEqual(s.find((p) => p.id === "a").locais.map((l) => [l.slug, l.saldo, l.estado]), [["maquina-cozinha", 10, "ok"], ["maquina-bar", 1, "baixo"]]);
  assert.equal(s.find((p) => p.id === "c").locais.length, 1, "o saldo da cozinha não entra na máquina");
  assert.deepEqual(resumoDosMateriais(s), { total: 4, zerados: 1, baixos: 1 });
  assert.deepEqual(situacaoDosMateriais("x", insumos, itens), []);
});
