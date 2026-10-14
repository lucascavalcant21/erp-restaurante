// node --test app/lib/marmitaria/copia-unidades.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { planoDeCopia } from "./copia-unidades.mjs";

let n = 0;
const novaChave = () => `novo-${++n}`;
const origem = {
  insumos: new Map([
    ["arroz", { id: "arroz", nome: "Arroz Branco", unidade_medida: "kg", departamento: "cozinha", custo_compra: 25, tamanho_embalagem: 5 }],
    ["sal", { id: "sal", nome: "Sal", unidade_medida: "kg", departamento: "cozinha", custo_compra: 3 }],
    ["oleo", { id: "oleo", nome: "Óleo", unidade_medida: "l", departamento: "cozinha", custo_compra: 9 }],
    ["pote", { id: "pote", nome: "Pote 500 ml", unidade_medida: "un", departamento: "embalagens", custo_compra: 0.8 }],
  ]),
  fichas: [
    { id: "arroz-cozido", nome_receita: "Arroz cozido", eh_base: true, departamento: "cozinha", rendimento_porcoes: 3, rendimento_unidade: "kg",
      fichas_ingredientes: [{ insumo_id: "arroz", quantidade: 1 }, { insumo_id: "sal", quantidade: 0.02 }, { insumo_id: "oleo", quantidade: 0.05 }] },
    { id: "prato", nome_receita: "Frango com arroz", eh_base: false, departamento: "cozinha",
      fichas_ingredientes: [{ subficha_id: "arroz-cozido", quantidade: 0.15 }, { insumo_id: "sal", quantidade: 0.001 }] },
  ],
  embalagens: new Map([["prato", [{ insumo_id: "pote", quantidade: 1, tipo: "marmitex" }]]]),
};

test("traz a ficha com o pré-preparo antes; reaproveita o que o destino já tem", () => {
  n = 0;
  const destino = { insumos: [{ id: "sal-m", nome: "sal", unidade_medida: "KG" }], fichas: [] };
  const p = planoDeCopia({ origem, destino, escolhidas: ["prato"], novaChave });
  assert.equal(p.ok, true);
  assert.deepEqual(p.fichas.map((f) => [f.nome, f.tipo, f.existente]), [["Arroz cozido", "pre_preparo", false], ["Frango com arroz", "marmita", false]]);
  assert.deepEqual(p.criarInsumos.map((i) => i.nome).sort(), ["Arroz Branco", "Pote 500 ml", "Óleo"]);
  assert.deepEqual(p.reaproveitarInsumos.map((i) => i.destinoId), ["sal-m"]);
  assert.deepEqual(p.resumo, { insumosNovos: 3, insumosReaproveitados: 1, fichasNovas: 2, fichasReaproveitadas: 0 });
  const pre = p.payload(p.fichas[0], "marmitaria");
  assert.equal(pre.tipo, "pre_preparo");
  assert.equal(pre.rendimento, 3);
  assert.equal(pre.itens.find((i) => i.quantidade === 0.02).insumo_id, "sal-m");
  const marm = p.payload(p.fichas[1], "marmitaria");
  assert.equal(marm.itens[0].subficha_id, p.fichas[0].destinoId);
  assert.equal(marm.embalagens.length, 1);
  assert.equal(marm.unidade_id, "marmitaria");
});

test("ficha que o destino já tem não é recriada", () => {
  n = 0;
  const destino = { insumos: [], fichas: [{ id: "arroz-m", nome_receita: "ARROZ COZIDO", eh_base: true }] };
  const p = planoDeCopia({ origem, destino, escolhidas: ["prato"], novaChave });
  assert.deepEqual(p.fichas.map((f) => [f.nome, f.existente, f.destinoId]), [["Arroz cozido", true, "arroz-m"], ["Frango com arroz", false, "novo-1"]]);
  // o arroz cozido do destino usa o cadastro dele: só o sal e o pote da marmita são criados
  assert.deepEqual(p.criarInsumos.map((i) => i.nome).sort(), ["Pote 500 ml", "Sal"]);
  assert.equal(p.payload(p.fichas[1], "m").itens[0].subficha_id, "arroz-m");
});

test("mesmo nome com unidade diferente é conflito (nada criado às cegas)", () => {
  const destino = { insumos: [{ id: "arroz-g", nome: "Arroz branco", unidade_medida: "g" }], fichas: [] };
  const p = planoDeCopia({ origem, destino, escolhidas: ["arroz-cozido"], novaChave });
  assert.equal(p.ok, false);
  assert.match(p.conflitos[0], /Arroz Branco/);
});

test("item espelho de pré-preparo e item arquivado no destino não contam", () => {
  const destino = { insumos: [{ id: "x", nome: "Sal", unidade_medida: "kg", arquivado_em: "2026-01-01" }, { id: "y", nome: "Óleo", unidade_medida: "l", ficha_tecnica_id: "f" }], fichas: [] };
  const p = planoDeCopia({ origem, destino, escolhidas: ["arroz-cozido"], novaChave });
  assert.equal(p.reaproveitarInsumos.length, 0);
  assert.equal(p.criarInsumos.length, 3);
});
