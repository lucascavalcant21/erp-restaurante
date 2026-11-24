import test from "node:test";
import assert from "node:assert/strict";
import { normalizarPosicionamento, conferirItemPos, textoItemPos, textoAlvo, textoFaixa, interpretarPosicionamento, buscarPosicionamento, respostaDoPosicionamento } from "./posicionamento.mjs";

const LISTA = { itens: [
  { id: "1", nome: "Filé de frango", alvo: 200 },
  { id: "2", nome: "Picanha", alvo: "250", media: true },
  { id: "3", nome: "Batata frita", alvo: 100, min: "90", max: 100 },
  { id: "4", nome: "Almôndega", alvo: 5, unidade: "un" },
] };

test("normaliza, ordena e escreve como o dono fala", () => {
  const { itens } = normalizarPosicionamento(LISTA);
  assert.deepEqual(itens.map((i) => i.nome), ["Almôndega", "Batata frita", "Filé de frango", "Picanha"]);
  const [alm, bat, file, pic] = itens;
  assert.equal(textoItemPos(file), "Filé de frango: 200 g");
  assert.equal(textoAlvo(pic), "Média de 250 g");
  assert.equal(textoItemPos(bat), "Batata frita: 100 g (de 90 a 100 g)");
  assert.equal(textoAlvo(alm), "5 un");
  assert.equal(textoFaixa({ min: 90, unidade: "g" }), "mínimo 90 g");
  assert.equal(normalizarPosicionamento(null).itens.length, 0);
});

test("confere antes de salvar", () => {
  assert.deepEqual(conferirItemPos({ nome: "Arroz", alvo: 150 }), []);
  assert.ok(conferirItemPos({ nome: "", alvo: 150 }).length);
  assert.ok(conferirItemPos({ nome: "Arroz" }).length);
  assert.ok(conferirItemPos({ nome: "Batata", alvo: 100, min: 101 }).length);
  assert.ok(conferirItemPos({ nome: "Batata", alvo: 120, max: 100 }).length);
  assert.ok(conferirItemPos({ nome: "Batata", alvo: 95, min: 100, max: 90 }).length);
  assert.ok(conferirItemPos({ id: "x", nome: "file de FRANGO", alvo: 1 }, LISTA.itens).some((e) => e.includes("Já tem")));
  assert.deepEqual(conferirItemPos({ id: "1", nome: "Filé de frango", alvo: 180 }, LISTA.itens), []);
});

test("entende a pergunta", () => {
  assert.deepEqual(interpretarPosicionamento("posicionamento"), { todos: true });
  assert.deepEqual(interpretarPosicionamento("Posicionamento?"), { todos: true });
  assert.equal(interpretarPosicionamento("quantas gramas é posicionado o filé de frango").termo, "file frango");
  assert.equal(interpretarPosicionamento("posicionamento da picanha").termo, "picanha");
  assert.equal(interpretarPosicionamento("qual o peso da batata frita").soPergunta, true);
  assert.equal(interpretarPosicionamento("arroz"), null);
  assert.equal(interpretarPosicionamento("2 kg de arroz cru"), null);
  assert.equal(interpretarPosicionamento("janta"), null);
});

test("busca pelo começo das palavras", () => {
  const { itens } = normalizarPosicionamento(LISTA);
  assert.deepEqual(buscarPosicionamento(itens, "file").map((i) => i.id), ["1"]);
  assert.deepEqual(buscarPosicionamento(itens, "batatas").map((i) => i.id), ["3"]);
  assert.deepEqual(buscarPosicionamento(itens, "almondegas").map((i) => i.id), ["4"]);
  assert.deepEqual(buscarPosicionamento(itens, "file frango grelhado").map((i) => i.id), ["1"]);
  assert.deepEqual(buscarPosicionamento(itens, "file frango grelhado", { aproximado: false }), []);
});

test("resposta no aparelho: lista, um produto, sem cadastro", () => {
  const cache = { fichas: [], posicionamento: LISTA };
  const todos = respostaDoPosicionamento("posicionamento", cache);
  assert.equal(todos.blocos[0].tipo, "posicionamento");
  assert.equal(todos.blocos[0].itens.length, 4);
  assert.ok(todos.acoes[0].rota.includes("/dashboard/operacao/posicionamento"));

  const um = respostaDoPosicionamento("quantas gramas é posicionado o filé de frango?", cache);
  assert.equal(um.texto, "Filé de frango: 200 g");
  assert.equal(um.blocos[0].itens.length, 1);

  const nada = respostaDoPosicionamento("posicionamento do camarão", cache);
  assert.match(nada.texto, /Não tem porcionamento cadastrado para "camarao"/);
  assert.equal(nada.blocos[0].itens.length, 4);

  // pergunta de gramas que não é de posicionamento segue o caminho normal
  assert.equal(respostaDoPosicionamento("quantas gramas de arroz para 10 pessoas", cache), null);
  assert.equal(respostaDoPosicionamento("qual o peso da picanha", cache).texto, "Picanha: média de 250 g");

  const vazio = respostaDoPosicionamento("posicionamento", { fichas: [] });
  assert.match(vazio.texto, /ainda não foi cadastrado/);
  assert.match(respostaDoPosicionamento("posicionamento", null).texto, /baixando/);
  assert.equal(respostaDoPosicionamento("como faz arroz", cache), null);
});

test("porcionamento (o nome certo, 24/11/2026) também abre a lista e acha o produto", () => {
  assert.deepEqual(interpretarPosicionamento("porcionamento"), { todos: true });
  assert.equal(interpretarPosicionamento("porcionamento da picanha").termo, "picanha");
});

test("categorias: divide a lista na ordem das sugeridas, sem categoria no fim", async () => {
  const { agruparPorCategoria, normalizarItemPos } = await import("./posicionamento.mjs");
  const itens = [{ nome: "Arroz", alvo: 120, categoria: "Acompanhamentos" }, { nome: "Filé", alvo: 150, categoria: "Proteínas" }, { nome: "Farofa", alvo: 30 }, { nome: "Pudim", alvo: 80, categoria: "Doces da casa" }].map(normalizarItemPos);
  assert.deepEqual(agruparPorCategoria(itens).map((g) => [g.categoria, g.itens.length]), [["Proteínas", 1], ["Acompanhamentos", 1], ["Doces da casa", 1], ["Sem categoria", 1]]);
});
