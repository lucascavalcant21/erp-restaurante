import test from "node:test";
import assert from "node:assert/strict";
import { normalizarJanta, cardapioDoDia, rotuloPeso, pessoasDoDia } from "./janta-funcionarios.mjs";

const insumos = new Map([
  ["mac", { id: "mac", nome: "Macarrão", unidade_medida: "kg", preco_normalizado: 8 }],
  ["car", { id: "car", nome: "Carne moída", unidade_medida: "kg", preco_normalizado: 30 }],
]);
const janta = normalizarJanta({ pessoas_padrao: 10, dias: { seg: { pessoas: "", pratos: [{ nome: "Macarronada", preparo: "Cozinhe a massa…", itens: [
  { nome: "Macarrão", insumo_id: "mac", g_pessoa: "120" },
  { nome: "Carne moída", insumo_id: "car", g_pessoa: "100" },
  { nome: "Queijo ralado", g_pessoa: "15" },
] }] } } });

test("macarrão: 1 pessoa e 6 pessoas pela gramatura por pessoa", () => {
  const um = cardapioDoDia(janta, "seg", { pessoas: 1, insumos });
  assert.deepEqual(um.pratos[0].itens.map((i) => i.totalG), [120, 100, 15]);
  const seis = cardapioDoDia(janta, "seg", { pessoas: 6, insumos });
  assert.deepEqual(seis.pratos[0].itens.map((i) => i.rotulo), ["720 g", "600 g", "90 g"]);
  // 0,72 kg × R$ 8 + 0,6 kg × R$ 30 = 5,76 + 18 = 23,76; queijo sem produto ligado
  assert.equal(seis.custo, 23.76);
  assert.equal(seis.custoPorPessoa, 3.96);
  assert.equal(seis.semCusto, 1);
  assert.equal(seis.natureza, "ESTIMATIVA");
});

test("sem número do dia vale o padrão; kg a partir de 1.000 g", () => {
  assert.equal(pessoasDoDia(janta, "seg"), 10);
  assert.equal(cardapioDoDia(janta, "seg", { insumos }).pratos[0].itens[0].rotulo, "1,2 kg");
  assert.equal(rotuloPeso(0), "—");
  assert.equal(normalizarJanta(null).dias.dom.pratos.length, 0);
});


import { receitaDoItem, rendimentoNaMedida, normalizarItem } from "./janta-funcionarios.mjs";

// Pedido do dono (14/11/2026): arroz, feijão e salada fixos; porção do produto
// pronto em g, un ou ml; receita refeita para dar as porções certas.
const fichas = new Map([
  ["arroz", { id: "arroz", nome_receita: "Arroz branco", rendimento_porcoes: 2, rendimento_unidade: "kg", modo_preparo: "Refogue e cozinhe.",
    fichas_ingredientes: [{ quantidade: 0.8, insumos: { nome: "Arroz", unidade_medida: "kg" } }, { quantidade: 0.02, insumos: { nome: "Sal", unidade_medida: "kg" } }] }],
  ["feijao", { id: "feijao", nome_receita: "Feijão", rendimento_porcoes: 3, rendimento_unidade: "l",
    fichas_ingredientes: [{ quantidade: 0.5, insumos: { nome: "Feijão carioca", unidade_medida: "kg" } }] }],
  ["almon", { id: "almon", nome_receita: "Almôndegas", rendimento_porcoes: 1, rendimento_unidade: "kg", peso_porcao_g: 25,
    fichas_ingredientes: [{ quantidade: 0.8, insumos: { nome: "Carne moída", unidade_medida: "kg" } }] }],
  ["sobre", { id: "sobre", nome_receita: "Sobrecoxa assada", rendimento_porcoes: 10, rendimento_unidade: "un",
    fichas_ingredientes: [{ quantidade: 10, insumos: { nome: "Sobrecoxa", unidade_medida: "un" } }] }],
]);
const semana = normalizarJanta({
  pessoas_padrao: 6,
  fixos: [
    { nome: "Arroz", ficha_id: "arroz", modo: "g", porcao: "200" },
    { nome: "Feijão", ficha_id: "feijao", modo: "g", porcao: "100" },
    { nome: "Salada", modo: "g", porcao: "60" },
  ],
  dias: { qua: { pessoas: "6", pratos: [{ nome: "Almôndegas ao molho", itens: [
    { nome: "Almôndegas", ficha_id: "almon", modo: "un", porcao: "5" },
    { nome: "Molho", modo: "ml", porcao: "80" },
  ] }] }, qui: { pratos: [{ nome: "Sobrecoxa", itens: [{ nome: "Sobrecoxa", ficha_id: "sobre", modo: "un", porcao: 1 }] }] } },
});

test("fixos entram todo dia, primeiro, como 'Todo dia'", () => {
  const qua = cardapioDoDia(semana, "qua", { fichas });
  assert.deepEqual(qua.pratos.map((p) => p.nome), ["Todo dia", "Almôndegas ao molho"]);
  assert.deepEqual(cardapioDoDia(semana, "seg", { fichas }).pratos.map((p) => p.nome), ["Todo dia"]);
});

test("6 pessoas: arroz 1,2 kg pronto → 60% da receita de 2 kg", () => {
  const arroz = cardapioDoDia(semana, "qua", { fichas }).pratos[0].itens[0];
  assert.equal(arroz.rotulo, "1,2 kg");
  assert.equal(arroz.receita.status, "ok");
  assert.equal(arroz.receita.rotuloFator, "60% da receita");
  assert.deepEqual(arroz.receita.ingredientes, [{ nome: "Arroz", quantidade: "480 g" }, { nome: "Sal", quantidade: "12 g" }]);
  assert.equal(arroz.receita.natureza, "REAL");
});

test("feijão com caldo: porção em g e ficha em litro vira ESTIMATIVA (1 ml ≈ 1 g)", () => {
  const feijao = cardapioDoDia(semana, "qua", { fichas }).pratos[0].itens[1];
  assert.equal(feijao.rotulo, "600 g");
  assert.equal(feijao.receita.rotuloFator, "20% da receita");
  assert.equal(feijao.receita.natureza, "ESTIMATIVA");
});

test("almôndega 5 por pessoa: 30 unidades; molho em ml; sobrecoxa 1 por pessoa", () => {
  const qua = cardapioDoDia(semana, "qua", { fichas }).pratos[1].itens;
  assert.equal(qua[0].rotulo, "30 un");
  // 1 kg ÷ 25 g = 40 almôndegas por receita → 30 = 75%
  assert.equal(qua[0].receita.rotuloFator, "75% da receita");
  assert.equal(qua[1].rotulo, "480 ml");
  assert.equal(qua[1].receita.status, "sem_ficha");
  const sobre = cardapioDoDia(semana, "qui", { fichas }).pratos[1].itens[0];
  assert.equal(sobre.rotulo, "6 un");
  assert.deepEqual(sobre.receita.ingredientes, [{ nome: "Sobrecoxa", quantidade: "6 un" }]);
});

test("mudou a porção (150 g → 200 g) ou as pessoas: tudo se ajusta", () => {
  const j = structuredClone(semana);
  j.fixos[0].porcao = "150";
  assert.equal(cardapioDoDia(j, "qua", { fichas }).pratos[0].itens[0].rotulo, "900 g");
  assert.equal(cardapioDoDia(j, "qua", { fichas, pessoas: 8 }).pratos[0].itens[0].rotulo, "1,2 kg");
});

test("ficha sem peso da unidade: DADOS INSUFICIENTES com o motivo, nunca número inventado", () => {
  const r = receitaDoItem({ ficha_id: "x", modo: "un" }, { rendimento_porcoes: 2, rendimento_unidade: "kg" }, 30);
  assert.equal(r.status, "insuficiente");
  assert.match(r.motivo, /peso da porção/);
  assert.equal(rendimentoNaMedida({ rendimento_porcoes: 0 }, "g"), null);
  assert.equal(receitaDoItem({ ficha_id: "x", modo: "g" }, null, 100).status, "insuficiente");
});

test("formato antigo (g_pessoa) continua valendo", () => {
  assert.deepEqual(normalizarItem({ nome: "Macarrão", g_pessoa: "120" }).porcao, "120");
  assert.equal(normalizarItem({ nome: "x", g_pessoa: "120" }).modo, "g");
});
