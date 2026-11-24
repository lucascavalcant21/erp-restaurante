import test from "node:test";
import assert from "node:assert/strict";
import { PREFIXO, buscarFichas, fatorDoPedido, ingredientePrincipal, interpretarPedido, lerComando, passosDaFicha, quantidadeTexto, receitaNaMedida, respostaLocal } from "../local/receitas-locais.mjs";

const ARROZ = {
  id: "f-arroz", nome: "Arroz branco", base: true, rendQtd: 4, rendUn: "kg",
  ingredientes: [
    { nome: "Alho", qtd: 0.07, unidade: "kg" }, { nome: "Sal Fino", qtd: 0.025, unidade: "kg" },
    { nome: "Arroz branco", qtd: 1.5, unidade: "kg" }, { nome: "Água", qtd: 2.5, unidade: "L" },
  ],
  modoPreparo: "1. numa panela grande frite o alho até dourar.\n2. acrescente a água e o sal.",
};
const FICHAS = [
  ARROZ,
  { ...ARROZ, id: "f-arroz-dup", nome: "Arroz Branco", ingredientes: [] },        // duplicada, sem ingrediente
  { id: "f-par", nome: "Arroz Paraense", base: true, rendQtd: 3, rendUn: "kg", ingredientes: [{ nome: "Arroz", qtd: 1, unidade: "kg" }] },
  { id: "p-par", nome: "Arroz paraense (c/camarão) - 400g", base: false, ingredientes: [{ nome: "Arroz Paraense", qtd: 0.4, unidade: "kg" }] },
  { id: "p-arroz", nome: "Arroz branco", base: false, ingredientes: [{ nome: "Arroz branco", qtd: 0.2, unidade: "kg" }] },
  { id: "x", nome: "Feijão tropeiro", base: true, ingredientes: [] },
];
const cache = { fichas: FICHAS };

test("entende o pedido: nome curto, como faz, quantidade, cru/cozido", () => {
  assert.deepEqual(interpretarPedido("Arroz"), { termo: "arroz", qtd: null, unidade: null, estado: null, tipo: null });
  assert.equal(interpretarPedido("Como faz Arroz branco?").termo, "arroz branco");
  assert.deepEqual(interpretarPedido("quero fazer 2 kg de arroz cru"), { termo: "arroz", qtd: 2, unidade: "kg", estado: "cru", tipo: null });
  assert.deepEqual(interpretarPedido("vou preparar 1,5kg de arroz branco cozido"), { termo: "arroz branco", qtd: 1.5, unidade: "kg", estado: "cozido", tipo: null });
  assert.equal(interpretarPedido("base de arroz").tipo, "base");
  assert.equal(interpretarPedido("quanto vendi ontem no ifood por cada canal de venda"), null);
});

test("busca sem repetir nome e com a ficha mais completa", () => {
  const r = buscarFichas(FICHAS, "arroz");
  const bases = r.filter((f) => f.base).map((f) => f.id);
  assert.deepEqual(bases, ["f-arroz", "f-par"]); // "Arroz branco" uma vez só (a que tem ingredientes)
  assert.equal(buscarFichas(FICHAS, "tropeiro")[0].id, "x");
  assert.equal(buscarFichas(FICHAS, "pizza").length, 0);
});

test("fluxo por toques: base ou prato → qual → a receita", () => {
  const r1 = respostaLocal("Arroz", cache);
  assert.equal(r1.texto, "É base ou prato?");
  assert.deepEqual(r1.pergunta.opcoes.map((o) => o.rotulo), ["Base (2)", "Prato (2)"]);
  const r2 = respostaLocal(r1.pergunta.opcoes[0].comando, cache);
  assert.deepEqual(r2.pergunta.opcoes.map((o) => o.rotulo), ["Arroz branco", "Arroz Paraense"]);
  assert.ok(r2.pergunta.opcoes[0].comando.startsWith(PREFIXO));
  const r3 = respostaLocal(r2.pergunta.opcoes[0].comando, cache);
  assert.equal(r3.blocos[0].tipo, "receita_rapida");
  assert.equal(r3.blocos[0].ficha.id, "f-arroz");
  assert.equal(respostaLocal("pizza", cache), null);   // sem ficha: vai para o servidor
  assert.equal(respostaLocal("Arroz", { fichas: [] }), null);
  assert.equal(lerComando("Arroz"), null);
});

test("a quantidade pedida passa junto pelos toques", () => {
  const r1 = respostaLocal("quero fazer 2 kg de arroz cru", cache);
  const r3 = respostaLocal(respostaLocal(r1.pergunta.opcoes[0].comando, cache).pergunta.opcoes[0].comando, cache);
  assert.deepEqual(r3.blocos[0].pedido, { qtd: 2, unidade: "kg", estado: "cru" });
});

test("2 kg de arroz CRU: a conta vai pelo arroz da ficha (1,5 kg)", () => {
  assert.equal(ingredientePrincipal(ARROZ).nome, "Arroz branco");
  const m = receitaNaMedida(ARROZ, { qtd: 2, unidade: "kg", estado: "cru" });
  assert.equal(Math.round(m.fator * 1000) / 1000, 1.333);
  assert.deepEqual(m.ingredientes.map((i) => i.texto), ["95 g", "35 g", "2.000 g", "3.330 ml"]);
  assert.equal(m.rendeTexto, "5.330 g");
});

test("2 kg de arroz COZIDO: a conta vai pelo rendimento (4 kg)", () => {
  const m = receitaNaMedida(ARROZ, { qtd: 2, unidade: "kg", estado: "cozido" });
  assert.equal(m.fator, 0.5);
  assert.deepEqual(m.ingredientes.map((i) => i.texto), ["35 g", "13 g", "750 g", "1.250 ml"]);
});

test("sem dizer cru ou cozido: pergunta", () => {
  assert.equal(fatorDoPedido(ARROZ, { qtd: 2, unidade: "kg" }).precisaEstado, true);
  assert.equal(receitaNaMedida(ARROZ, {}).fator, 1);
  assert.equal(receitaNaMedida(ARROZ, {}).mudou, false);
});

test("gramas e ml; passos numerados", () => {
  assert.equal(quantidadeTexto(1.5, "kg"), "1.500 g");
  assert.equal(quantidadeTexto(2.5, "L"), "2.500 ml");
  assert.equal(quantidadeTexto(3, "un"), "3 un");
  assert.deepEqual(passosDaFicha(ARROZ), ["numa panela grande frite o alho até dourar.", "acrescente a água e o sal."]);
});

test("janta: entende o pedido e o dia", async () => {
  const { interpretarJanta } = await import("../local/receitas-locais.mjs");
  const dom = new Date("2026-11-22T12:00:00"); // domingo
  assert.deepEqual(interpretarJanta("janta", dom), { dia: "dom" });
  assert.deepEqual(interpretarJanta("Janta de hoje?", dom), { dia: "dom" });
  assert.deepEqual(interpretarJanta("janta de amanhã", dom), { dia: "seg" });
  assert.deepEqual(interpretarJanta("qual a janta de quinta-feira", dom), { dia: "qui" });
  assert.equal(interpretarJanta("quanto custou a janta do mês", dom), null);
  assert.equal(interpretarJanta("arroz", dom), null);
});

test("janta: resposta no aparelho com a janta e só as fichas usadas", () => {
  const janta = { fixos: [{ nome: "Arroz branco", modo: "g", porcao: "200", ficha_id: "f-arroz" }], dias: {} };
  const r = respostaLocal("janta", { fichas: FICHAS, janta });
  assert.equal(r.blocos[0].tipo, "janta");
  assert.deepEqual(r.blocos[0].fichas.map((f) => f.id), ["f-arroz"]);
  assert.equal(r.blocos[0].fichas[0].fichas_ingredientes.length, 4);
  assert.match(respostaLocal("janta", { fichas: FICHAS }).texto, /ainda não foi montada/);
});
