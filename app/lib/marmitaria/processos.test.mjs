import test from "node:test";
import assert from "node:assert/strict";
import { compartimentosDe, marmitasDaEmbalagem, montarPelaFicha, moverEtapa, normalizarProcesso, resumoDoProcesso } from "./processos.mjs";

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
  assert.deepEqual(normalizarProcesso({ embalagens: ["a", "a", null], etapas: [{ id: 1, grupo: "x" }], compartimentos: 7 }), { embalagens: ["a"], recipiente: "", compartimentos: null, etapas: [] });
  const e = [{ id: "1", grupo: "montagem" }, { id: "2", grupo: "coccao" }, { id: "3", grupo: "montagem" }];
  assert.deepEqual(moverEtapa(e, "3", -1).map((x) => x.id), ["3", "2", "1"]);
  assert.deepEqual(moverEtapa(e, "1", -1).map((x) => x.id), ["1", "2", "3"]);
});

import { guiaDeMontagem } from "./processos.mjs";
test("guia de montagem: gramas da ficha, embalagens e passos; o que falta é dito", () => {
  const insumos = new Map([["arroz", { nome: "Arroz cozido", unidade_medida: "kg" }], ["pote", { nome: "Pote 750 ml", unidade_medida: "un" }], ["queijo", { nome: "Muçarela", unidade_medida: "kg" }]]);
  const fichas = [{ id: "frango", nome_receita: "Frango desfiado", rendimento_unidade: "kg" }];
  const marmita = { nome_receita: "Frango cremoso", codigo: "MARM-002", peso_final_g: 450, itens: [{ insumo_id: "arroz", quantidade: 0.2 }, { subficha_id: "frango", quantidade: 0.15 }, { insumo_id: "queijo", quantidade: 0.03 }], embalagens: [{ insumo_id: "pote", quantidade: 1 }] };
  const processo = { embalagens: ["pote"], etapas: [{ id: "1", grupo: "montagem", titulo: "Arroz", texto: "No fundo do pote" }, { id: "2", grupo: "montagem", titulo: "Frango", texto: "" }, { id: "3", grupo: "fechamento", titulo: "Tampa", texto: "Fechar e etiquetar" }, { id: "4", grupo: "montagem", titulo: "", texto: "" }] };
  const g = guiaDeMontagem({ marmita, processo, insumos, fichas });
  assert.deepEqual(g.componentes, [{ nome: "Arroz cozido", quantidade: "200 g" }, { nome: "Frango desfiado", quantidade: "150 g" }, { nome: "Muçarela", quantidade: "30 g" }]);
  assert.deepEqual(g.embalagens, [{ nome: "Pote 750 ml", quantidade: 1 }]);
  assert.deepEqual(g.etapas.map((e) => [e.rotulo, e.itens.map((i) => i.titulo)]), [["Montagem", ["Arroz", "Frango"]], ["Fechamento", ["Tampa"]]]);
  assert.equal(g.peso, "450 g");
  assert.deepEqual(g.faltando, []);
  assert.deepEqual(guiaDeMontagem({ marmita: { nome_receita: "Nova" } }).faltando, ["a ficha técnica (o que vai e quanto)", "o passo a passo da montagem", "as embalagens"]);
});

test("montar pela ficha: um passo por item com a quantidade, sem repetir; compartimentos por quantidade", () => {
  let n = 0;
  const comps = [{ nome: "Arroz branco", quantidade: "120 g" }, { nome: "Batata palha", quantidade: "50 g" }];
  const p = montarPelaFicha({ etapas: [{ id: "a", grupo: "montagem", titulo: "arroz branco" }] }, comps, () => `n${++n}`);
  assert.deepEqual(p.etapas.map((e) => [e.titulo, e.quantidade]), [["arroz branco", ""], ["Batata palha", "50 g"]]);
  assert.deepEqual(compartimentosDe(3).map((c) => c.rotulo), ["Maior", "Médio", "Menor"]);
  assert.deepEqual(compartimentosDe(0), []);
  assert.equal(normalizarProcesso({ etapas: [{ id: 1, grupo: "montagem", compartimento: "teto" }] }).etapas[0].compartimento, "");
});
