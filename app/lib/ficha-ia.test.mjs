import test from "node:test";
import assert from "node:assert/strict";
import {
  promptDaFichaIA, normalizarFichaIA, etapasEmTexto, promptDasInstrucoes, textoDasInstrucoesIA,
} from "./ficha-ia.mjs";
import { passosDeTexto } from "./ficha-modelo.mjs";

test("o pedido à IA muda com o tipo da ficha", () => {
  const prato = promptDaFichaIA({ tipo: "prato", departamento: "cozinha" });
  assert.match(prato, /FICHA DE PRATO/);
  assert.match(prato, /MONTAGEM/);
  assert.match(prato, /UM prato/);
  assert.doesNotMatch(prato, /armazenamento|alergenicos|tempo_preparo_min/);

  const preparo = promptDaFichaIA({ tipo: "pre_preparo", departamento: "bar" });
  assert.match(preparo, /FICHA DE PRÉ-PREPARO/);
  assert.match(preparo, /setor "bar"/);
  assert.match(preparo, /tempo_preparo_min/);
  assert.match(preparo, /NÃO invente validade/);
  assert.doesNotMatch(preparo, /cocção/i);
  // Sem tipo, é prato (o botão fica na aba de pratos por padrão).
  assert.match(promptDaFichaIA({}), /FICHA DE PRATO/);
});

test("resposta de PRATO vira ingredientes + montagem", () => {
  const ficha = normalizarFichaIA({
    nome_receita: " Picanha na brasa ",
    ingredientes: [{ nome: "Arroz branco", quantidade: 300, unidade: "g" }, { nome: "", quantidade: 1 }, { nome: "Farofa", quantidade: 50, unidade: "gramas" }],
    montagem: ["Arroz à esquerda", "Picanha ao centro"],
    rendimento_g: 420.4,
    armazenamento: { validade_dias: 99 },
  }, { tipo: "prato" });
  assert.equal(ficha.tipo, "prato");
  assert.equal(ficha.nome_receita, "Picanha na brasa");
  assert.deepEqual(ficha.ingredientes, [
    { nome: "Arroz branco", quantidade_lida: 300, unidade_lida: "g" },
    { nome: "Farofa", quantidade_lida: 50, unidade_lida: "un" },
  ]);
  assert.equal(ficha.modo_preparo, "1. Arroz à esquerda\n2. Picanha ao centro");
  // Rendimento do prato: gramas servidas, arredondadas.
  assert.equal(ficha.peso_final_g, 420);
  // Sem estimativa não inventa número: fica null e o editor sugere a soma.
  assert.equal(normalizarFichaIA({ nome_receita: "X", ingredientes: [] }, { tipo: "prato" }).peso_final_g, null);
  // Prato não recebe campos de produção, mesmo que a IA mande.
  assert.equal("armazenamento" in ficha, false);
  assert.equal("tempo_preparo" in ficha, false);
});

test("resposta de PRÉ-PREPARO: produção, alergênico só da lista, sem validade inventada", () => {
  const ficha = normalizarFichaIA({
    nome_receita: "Tucupi reduzido",
    ingredientes: [{ nome: "Tucupi", quantidade: 1, unidade: "l" }],
    modo_preparo: [{ descricao: "Reduzir", equipamento: "Panela", fogo: "Fogo médio", tempo: "20 min" }],
    tempo_preparo_min: 25.4,
    equipamentos: ["Panela 10 L", "Panela 10 L", " Fouet "],
    alergenicos: ["leite", "Glúten", "Pimenta"],
    armazenamento: { recipiente: "GN", conservacao: "refrigerado", validade_dias: null },
  }, { tipo: "pre_preparo" });
  assert.equal(ficha.tipo, "pre_preparo");
  assert.equal(ficha.tempo_preparo, 25);
  assert.deepEqual(ficha.equipamentos, ["Panela 10 L", "Fouet"]);
  assert.deepEqual(ficha.alergenicos, ["Leite", "Glúten"]);
  assert.deepEqual(ficha.armazenamento, { recipiente: "GN", forma: "Refrigerado", validade_dias: "" });
  assert.equal(ficha.modo_preparo, "1. Reduzir\n   • Panela · Fogo médio · 20 min\nTempo total: 25 min");
  // O texto gerado é lido de volta como 1 passo com detalhe, sem emoji.
  const { passos, notas } = passosDeTexto(ficha.modo_preparo);
  assert.equal(passos.length, 1);
  assert.deepEqual(passos[0].detalhes, ["Panela · Fogo médio · 20 min"]);
  assert.deepEqual(notas, ["Tempo total: 25 min"]);
  assert.doesNotMatch(ficha.modo_preparo, /⏱/);
});

test("etapas em texto ignora etapa vazia", () => {
  assert.equal(etapasEmTexto([{ descricao: "" }, { descricao: "Servir" }]), "1. Servir");
  assert.equal(etapasEmTexto([]), "");
});

test("organizar com IA no editor respeita o tipo", () => {
  assert.match(promptDasInstrucoes({ tipo: "prato", explicacao: "arroz do lado" }), /MONTAGEM/);
  assert.match(promptDasInstrucoes({ tipo: "pre_preparo", explicacao: "refogo" }), /PRODUÇÃO/);
  assert.equal(textoDasInstrucoesIA({ etapas: [{ descricao: "Arroz à esquerda" }] }, { tipo: "prato" }), "1. Arroz à esquerda");
  assert.equal(
    textoDasInstrucoesIA({ etapas: [{ descricao: "Refogar", fogo: "Fogo médio", tempo: "5 min" }], tempo_total: "5 min" }, { tipo: "pre_preparo" }),
    "1. Refogar\n   • Fogo médio · 5 min\nTempo total: 5 min",
  );
});
