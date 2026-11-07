// Busca pelo nome dito e folha visual da ficha (pedido do dono, 07/11/2026).
// TESTADO EM MOCK (funções puras, nomes reais do cadastro do Sel de Estrela).
import test from "node:test";
import assert from "node:assert/strict";
import { candidatosDoTermo } from "../metrics/produtos.mjs";
import { passosDoTexto, passosDaMontagem, passosGravados, servicoDaMontagem, fotoSegura, montarFolha } from "../metrics/folha-ficha.mjs";
import { iconeDoIngrediente, iconeDoServico } from "../../../components/intelligence/folha-icones.mjs";

const CADASTRO = ["Cupuaçu", "Xarope de cupuaçu ", "Suco de cupuaçu", "Sal fino", "Xarope de gengibre", "Gengibre", "Vatapá Paraense", "Vatapá tradicional",
  "Vatapá de Camarão", "Adicional - vatapá de camarão", "Caipirinha Clássica", "Caipirinha morango ", "Negroni", "Boto cor de rosa"].map((nome, i) => ({ id: String(i), nome }));
const nomes = (termo, opcoes) => candidatosDoTermo(CADASTRO, termo, 8, opcoes).map((x) => x.nome.trim());

test("nome do cadastro dito inteiro manda: 'xarope de cupuaçu' não vira 'cupuaçu'", () => {
  assert.deepEqual(nomes("cupuacu", { frase: "Quanto tenho de Xarope de cupuaçu?" }), ["Xarope de cupuaçu"]);
  assert.deepEqual(nomes("gengibre", { frase: "Quanto tenho de Xarope de gengibre?" }), ["Xarope de gengibre"]);
  assert.deepEqual(nomes("vatapa de camarao", { frase: "como faz o vatapá de camarão" }), ["Vatapá de Camarão"]);
  assert.deepEqual(nomes("boto cor rosa", { frase: "como faz o boto cor de rosa?" }), ["Boto cor de rosa"]);
});

test("sem a frase, o termo continua valendo como antes", () => {
  assert.deepEqual(nomes("cupuacu"), ["Cupuaçu"], "nome exato ganha");
  assert.deepEqual(nomes("xarope"), ["Xarope de cupuaçu", "Xarope de gengibre"]);
  assert.deepEqual(nomes("negroni"), ["Negroni"]);
});

test("palavras a mais no termo: só com `parcial`, e devolve todos os empatados (quem chama pergunta)", () => {
  const termo = "eu montar eu saber vatapa";
  assert.deepEqual(nomes(termo), []);
  assert.deepEqual(nomes(termo, { parcial: true }), ["Adicional - vatapá de camarão", "Vatapá de Camarão", "Vatapá Paraense", "Vatapá tradicional"]);
  assert.deepEqual(nomes("abacaxi", { parcial: true }), [], "uma palavra só que não existe: nada");
});

test("nome solto na frase só vale se divide palavra com o termo", () => {
  // "sal" está na frase mas o termo é "gengibre": não vira Sal fino
  assert.deepEqual(nomes("gengibre", { frase: "tem sal no xarope de gengibre?" }), ["Xarope de gengibre"]);
});

test("modo de preparo: numeração de quem escreveu, '•' vira detalhe, texto corrido vira frases", () => {
  assert.deepEqual(passosDoTexto("1. Doure os camarões.\n   • Panela de fundo grosso · Fogo médio · ⏱ 5 min\n2: Junte o leite.\n3. "), [
    { texto: "Doure os camarões.", detalhe: "Panela de fundo grosso · Fogo médio · ⏱ 5 min" },
    { texto: "Junte o leite.", detalhe: null },
  ]);
  assert.deepEqual(passosDoTexto("Aqueça a água. Coloque o hibisco. Coe."), [
    { texto: "Aqueça a água.", detalhe: null }, { texto: "Coloque o hibisco.", detalhe: null }, { texto: "Coe.", detalhe: null },
  ]);
  assert.deepEqual(passosDoTexto(""), []);
});

test("montagem: tira a lista de ingredientes e o título; passos gravados têm prioridade", () => {
  assert.deepEqual(passosDaMontagem("Arroz paraense\n350g arroz paraense\n8 camarões em volta", "Arroz Paraense").map((p) => p.texto), ["350g arroz paraense", "8 camarões em volta"]);
  assert.deepEqual(passosDaMontagem("Ingredientes:\n• Gin: 30 ml\n• Campari: 0.03 l", "Negroni"), []);
  assert.deepEqual(passosGravados([{ ordem: 2, descricao: "Gelo" }, { ordem: 1, descricao: "Copo" }], ["x"]).map((p) => p.texto), ["Copo", "Gelo"]);
  assert.deepEqual(passosGravados([], '["Servir gelado"]').map((p) => p.texto), ["Servir gelado"]);
});

test("copo e gelo da Montagem; foto só https", () => {
  assert.deepEqual(servicoDaMontagem('[{"nome":"Copo Long Drink","tipo":"copo"},{"nome":"Cubos de gelo","tipo":"liquido"}]'), { copo: "Copo Long Drink", gelo: "Cubos de gelo" });
  assert.deepEqual(servicoDaMontagem(null), { copo: null, gelo: null });
  assert.equal(fotoSegura("/9j/4AAQSkZJRg", "javascript:alert(1)", "https://x.supabase.co/a.jpg"), "https://x.supabase.co/a.jpg");
  assert.equal(fotoSegura("http://inseguro/a.jpg"), null);
});

test("folha de base: validade em vez de 'servir', sem cobrar montagem", () => {
  const f = montarFolha({ ficha: { id: "b", nome_receita: "Xarope de caja ", eh_base: true, departamento: "bar", modo_preparo: "" }, ingredientes: [] });
  assert.equal(f.tipo, "drink", "base do bar é tratada como do bar");
  const base = montarFolha({ ficha: { id: "c", nome_receita: "Caldo", eh_base: true, departamento: "cozinha", rendimento_porcoes: 2, rendimento_unidade: "L", validade_dias: 3 }, ingredientes: [{ nome: "Água", quantidade: "2 L" }] });
  assert.equal(base.tipo, "base");
  assert.deepEqual(base.servico.map((s) => s.id), ["rende", "porcao", "tempo", "validade"]);
  assert.deepEqual(base.faltando, ["modo de preparo"]);
});

test("ícones só enfeitam pelo nome (nunca mudam o que está na ficha)", () => {
  assert.equal(iconeDoIngrediente("Suco de limão"), "🍋");
  assert.equal(iconeDoIngrediente("Dose de Velho Barreiro"), "🥃");
  assert.equal(iconeDoIngrediente("Gelo"), "🧊");
  assert.equal(iconeDoIngrediente("Camarão seco - s/cabeça"), "🦐");
  assert.equal(iconeDoIngrediente("Coisa desconhecida"), "•");
  assert.equal(iconeDoServico("copo", "Taça Martini"), "🍸");
  assert.equal(iconeDoServico("copo", "Copo Old Fashioned"), "🥃");
});
