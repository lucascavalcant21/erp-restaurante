// Rode: node --test app/lib/consulta-area.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { areaValida, buscarNaConsulta, diaIso, fichaParaConsulta, montarConsulta, ordenarAnotacoes, validarAnotacao } from "./consulta-area.mjs";

const ficha = {
  id: "f1", nome_receita: "Tacacá", categoria: "Entradas", rendimento_porcoes: 4, rendimento_unidade: "porções", modo_preparo: "Ferva.",
  preco_venda: 39, custo_embalagem: 2, cmv_meta: 30, taxa_maquininha: 3, imposto_pct: 6,
  fichas_ingredientes: [{ quantidade: 200, insumos: { nome: "Camarão", unidade_medida: "g", custo_unitario: 90, preco_normalizado: 90 } }],
};

test("custo e margem não passam para a consulta", () => {
  const texto = JSON.stringify(fichaParaConsulta(ficha));
  for (const proibido of ["custo", "cmv", "taxa", "imposto", "preco_normalizado"]) assert.ok(!texto.includes(proibido), proibido);
  assert.deepEqual(fichaParaConsulta(ficha).ingredientes, [{ nome: "Camarão", quantidade: 200, unidade: "g" }]);
});

test("junta montagem e cardápio sem repetir o prato", () => {
  const lista = montarConsulta({
    fichas: [ficha],
    montagens: [{ nome: "tacaca", descritivo: "Cuia, goma e camarão.", foto_url: "x.jpg" }],
    produtos: [{ id: "p1", nome_produto: "TACACÁ", preco_venda: 39 }, { id: "p2", nome_produto: "Água", preco_venda: 6 }, { id: "p3", nome_produto: "Fora", ativo: false }],
  });
  assert.deepEqual(lista.map((i) => i.nome), ["Água", "Tacacá"]);
  assert.equal(lista[1].preco, 39);
  assert.equal(lista[1].montagem, "Cuia, goma e camarão.");
  assert.equal(lista[1].foto, "x.jpg");
});

test("sequência de montagem da ficha vence o guia", () => {
  const f = fichaParaConsulta({ ...ficha, montagem_sequencia: [{ descricao: "Prato" }, "Molho"] }, { descritivo: "Outro" });
  assert.equal(f.montagem, "Prato\nMolho");
});

test("produto ligado à ficha entra nela mesmo com outro nome", () => {
  const lista = montarConsulta({ fichas: [ficha], produtos: [{ id: "p1", ficha_id: "f1", nome_produto: "Tacacá da casa", preco_venda: 40 }] });
  assert.deepEqual(lista.map((i) => i.nome), ["Tacacá"]);
  assert.equal(lista[0].preco, 40);
});

test("passos da ficha seguem a ordem e subficha mostra o nome", () => {
  const f = fichaParaConsulta({ ...ficha, fichas_montagem_passos: [{ ordem: 2, descricao: "B" }, { ordem: 1, descricao: "A" }], fichas_ingredientes: [{ quantidade: 1, subficha: { nome_receita: "Molho" } }] });
  assert.equal(f.montagem, "A\nB");
  assert.equal(f.ingredientes[0].nome, "Molho");
});

test("busca por nome, categoria ou ingrediente, sem acento", () => {
  const lista = montarConsulta({ fichas: [ficha, { id: "f2", nome_receita: "Caipirinha", categoria: "Drinks" }] });
  assert.deepEqual(buscarNaConsulta(lista, "tacaca").map((i) => i.nome), ["Tacacá"]);
  assert.deepEqual(buscarNaConsulta(lista, "camarao").map((i) => i.nome), ["Tacacá"]);
  assert.deepEqual(buscarNaConsulta(lista, "drinks caip").map((i) => i.nome), ["Caipirinha"]);
  assert.equal(buscarNaConsulta(lista, "pizza").length, 0);
  assert.equal(buscarNaConsulta(lista, "  ").length, 2);
});

test("só cozinha e bar por enquanto", () => {
  assert.equal(areaValida("bar"), "bar");
  assert.equal(areaValida("salao"), "");
  assert.equal(areaValida("constructor"), "");
});

test("anotação exige texto, quem e quantidade válida", () => {
  const base = { tipo: "producao", texto: "Arroz", quantidade: "", quem: "Ana" };
  assert.equal(validarAnotacao(base), null);
  assert.match(validarAnotacao({ ...base, texto: " " }), /produzido/);
  assert.match(validarAnotacao({ ...base, tipo: "compra", texto: "" }), /comprar/);
  assert.match(validarAnotacao({ ...base, quem: "" }), /quem/);
  assert.match(validarAnotacao({ ...base, quantidade: 0 }), /maior/);
  assert.match(validarAnotacao({ ...base, tipo: "x" }), /tipo/);
  assert.match(validarAnotacao({ ...base, texto: "a".repeat(301) }), /300/);
});

test("dia local e virada de mês", () => {
  assert.equal(diaIso(new Date(2026, 10, 30, 23, 0), 1), "2026-12-01");
});

test("abertas vêm primeiro, da mais antiga para a mais nova", () => {
  const r = ordenarAnotacoes([
    { id: "feita", status: "feita", para_dia: "2026-11-05", created_at: "1" },
    { id: "amanha", status: "aberta", para_dia: "2026-11-06", created_at: "1" },
    { id: "hoje2", status: "aberta", para_dia: "2026-11-05", created_at: "2" },
    { id: "hoje1", status: "aberta", para_dia: "2026-11-05", created_at: "1" },
  ]);
  assert.deepEqual(r.map((a) => a.id), ["hoje1", "hoje2", "amanha", "feita"]);
});
