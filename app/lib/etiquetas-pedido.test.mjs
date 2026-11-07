// Rode: node --test app/lib/etiquetas-pedido.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { casarNoCatalogo, casarPedido, comandoDoPedido, lerPedidoDeEtiquetas, loteDaUrl, loteParaUrl, numerosPorExtenso, pedeEtiquetas } from "./etiquetas-pedido.mjs";

const lista = (t) => lerPedidoDeEtiquetas(t).map((i) => [i.copias, i.termo]);

test("lê o pedido como o dono falou no tablet", () => {
  assert.deepEqual(lista("Eu quero 20 etiquetas maniçoba , 30 de jambu"), [[20, "maniçoba"], [30, "jambu"]]);
  assert.deepEqual(lista("imprime 5 etiquetas de alho, 3 de tomate e 10 de cebola"), [[5, "alho"], [3, "tomate"], [10, "cebola"]]);
  assert.deepEqual(lista("20 etiquetas de maniçoba e 30 etiquetas de jambu"), [[20, "maniçoba"], [30, "jambu"]]);
  assert.deepEqual(lista("etiqueta de vatapá"), [[1, "vatapá"]]);
  assert.deepEqual(lista("Imprimir etiquetas: 20 de Maniçoba, 30 de Jambu - pré cozido"), [[20, "Maniçoba"], [30, "Jambu - pré cozido"]]);
  assert.deepEqual(lista("faz vinte etiquetas de arroz e dez de feijão"), [[20, "arroz"], [10, "feijão"]]);
  assert.deepEqual(lista("vinte e cinco etiquetas de farofa"), [[25, "farofa"]]);
  assert.deepEqual(lista("etiquetas: arroz e feijão 12"), [[12, "arroz e feijão"]]);
  assert.deepEqual(lista("10 de molho, 5 de molho"), [[15, "molho"]], "repetido soma");
  assert.deepEqual(lista("500 etiquetas de alho"), [[100, "alho"]], "no máximo 100 por item");
  assert.equal(numerosPorExtenso("três de alho"), "3 de alho");
});

test("pedido de etiqueta × pergunta sobre etiqueta", () => {
  assert.equal(pedeEtiquetas("Eu quero 20 etiquetas maniçoba , 30 de jambu"), true);
  assert.equal(pedeEtiquetas("quero imprimir etiquetas"), true);
  assert.equal(pedeEtiquetas("etiquetas vencendo"), false);
  assert.equal(pedeEtiquetas("quantas etiquetas ativas tenho?"), false);
  assert.equal(pedeEtiquetas("quanto tenho de maniçoba"), false);
});

const CATALOGO = [
  { nome: "Cachaça de jambu", origem: "Ingrediente" }, { nome: "Gin jambu", origem: "Ingrediente" },
  { nome: "Jambu - pré cozido", origem: "Ingrediente" }, { nome: "Maniçoba", origem: "Ingrediente" },
  { nome: "Maniçoba ", origem: "Pré-preparo" }, { nome: "Maniçoba -1", origem: "Ingrediente" },
  { nome: "Molho de tomate", origem: "Pré-preparo" }, { nome: "Molho branco", origem: "Pré-preparo" },
];

test("casa com a lista da tela de etiquetas", () => {
  assert.equal(casarNoCatalogo(CATALOGO, "maniçoba").item.nome, "Maniçoba");
  assert.equal(casarNoCatalogo(CATALOGO, "jambu").item.nome, "Jambu - pré cozido", "começa com o termo ganha da cachaça");
  assert.deepEqual(casarNoCatalogo(CATALOGO, "molho").opcoes.map((o) => o.nome), ["Molho branco", "Molho de tomate"], "empate pergunta");
  assert.equal(casarNoCatalogo(CATALOGO, "vatapá").item, null);
  const r = casarPedido(CATALOGO, lerPedidoDeEtiquetas("20 etiquetas maniçoba, 30 de jambu, 4 de molho, 2 de vatapá"));
  assert.deepEqual(r.achados.map((a) => [a.copias, a.nome]), [[20, "Maniçoba"], [30, "Jambu - pré cozido"]]);
  assert.deepEqual(r.ambiguos.map((a) => a.termo), ["molho"]);
  assert.deepEqual(r.semCadastro.map((a) => a.termo), ["vatapá"]);
  assert.equal(comandoDoPedido(r.achados), "Imprimir etiquetas: 20 de Maniçoba, 30 de Jambu - pré cozido");
});

test("fila na URL: ida e volta, e desconfiança", () => {
  const url = loteParaUrl([{ copias: 20, nome: "Maniçoba" }, { copias: 30, nome: "Jambu - pré cozido" }]);
  assert.ok(url.startsWith("/dashboard/operacao/etiquetas?lote="));
  assert.deepEqual(loteDaUrl(decodeURIComponent(url.split("lote=")[1])), [{ copias: 20, nome: "Maniçoba" }, { copias: 30, nome: "Jambu - pré cozido" }]);
  assert.deepEqual(loteDaUrl("[[0,\"x\"],[2.5,\"y\"],[101,\"z\"],[3,\"\"],\"lixo\",[4,\"ok\"]]"), [{ copias: 4, nome: "ok" }]);
  assert.deepEqual(loteDaUrl("não é json"), []);
});
