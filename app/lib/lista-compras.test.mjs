import test from "node:test";
import assert from "node:assert/strict";
import { interpretarLista, lerItem, casarComCadastro, sugestoesDoMinimo, mensagemWhatsApp, linkWhatsApp, aplicarCompra, proximaLista } from "./lista-compras.mjs";

test("lê o jeito que o dono fala a lista", () => {
  const itens = interpretarLista("Jhon, minha lista de compras para hoje é: 10 kg de arroz, feijão 5 kg, 3 abacaxis, 2 caixas de tomate e alface");
  assert.deepEqual(itens, [
    { nome: "Arroz", quantidade: 10, unidade: "kg" },
    { nome: "Feijão", quantidade: 5, unidade: "kg" },
    { nome: "Abacaxis", quantidade: 3, unidade: "un" },
    { nome: "Tomate", quantidade: 2, unidade: "cx" },
    { nome: "Alface", quantidade: null, unidade: null },
  ]);
  assert.deepEqual(lerItem("1,5 litros de leite"), { nome: "Leite", quantidade: 1.5, unidade: "L" });
  assert.deepEqual(interpretarLista("preciso comprar\n- carvão\n- gelo 10 sacos").map((i) => i.nome), ["Carvão", "Gelo"]);
});

test("liga ao cadastro e sugere o que está abaixo do mínimo", () => {
  const cad = { arroz: { id: "i1", nome: "Arroz agulhinha" } };
  const lista = casarComCadastro(interpretarLista("arroz 10 kg, alface"), (n) => cad[n.toLowerCase()] || null);
  assert.deepEqual(lista.map((i) => [i.insumoId, i.nomeCadastro, i.status]), [["i1", "Arroz agulhinha", "pendente"], [null, null, "pendente"]]);
  const sug = sugestoesDoMinimo(lista, [{ insumo_id: "i1", produto: "Arroz" }, { insumo_id: "i9", produto: "Óleo", saldo: 1, minimo: 6, unidade: "L" }]);
  assert.deepEqual(sug.map((s) => s.produto), ["Óleo"]);
});

test("mensagem e link do WhatsApp", () => {
  const lista = casarComCadastro(interpretarLista("arroz 10 kg, alface"), () => null);
  const msg = mensagemWhatsApp(lista, { casa: "Sel de Estrela", data: "2026-11-14" });
  assert.match(msg, /Lista de compras · Sel de Estrela · 14\/11/);
  assert.match(msg, /• Arroz: 10 kg/);
  assert.match(msg, /• Alface\n/);
  assert.match(linkWhatsApp(msg, "(45) 99867-4041"), /^https:\/\/wa\.me\/5545998674041\?text=/);
  assert.match(linkWhatsApp(msg), /^https:\/\/wa\.me\/\?text=/);
});

test("'comprei tudo, faltou o tomate e a alface'", () => {
  const lista = casarComCadastro(interpretarLista("arroz 10 kg, feijão 5 kg, tomate 2 cx, alface"), () => null);
  const r = aplicarCompra(lista, "Jhon, comprei tudo, faltou o tomate e a alface");
  assert.deepEqual(r.vieram.map((i) => i.nome), ["Arroz", "Feijão"]);
  assert.deepEqual(r.faltaram.map((i) => i.nome), ["Tomate", "Alface"]);
  assert.deepEqual(r.lista.map((i) => i.status), ["comprado", "comprado", "faltou", "faltou"]);
  assert.deepEqual(proximaLista(r.lista).map((i) => [i.nome, i.status]), [["Tomate", "pendente"], ["Alface", "pendente"]]);
});

test("'comprei só o arroz' e 'comprei tudo'", () => {
  const lista = casarComCadastro(interpretarLista("arroz 10 kg, feijões 5 kg"), () => null);
  assert.deepEqual(aplicarCompra(lista, "comprei só o arroz").faltaram.map((i) => i.nome), ["Feijões"]);
  assert.deepEqual(aplicarCompra(lista, "acabei de comprar tudo").vieram.length, 2);
  const nada = aplicarCompra(lista, "comprei tudo, faltou o queijo");
  assert.equal(nada.naoAchou, "o queijo");
  assert.equal(nada.vieram.length, 2);
});
