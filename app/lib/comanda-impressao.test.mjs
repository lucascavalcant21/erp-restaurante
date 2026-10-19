// Via da cozinha: o que imprime, o que não repete e o HTML escapado.
import test from "node:test";
import assert from "node:assert/strict";
import { itensParaImprimir, marcarImpressos, htmlDaVia, htmlDasVias } from "./comanda-impressao.mjs";

const ticket = (id, itens, extra = {}) => ({ id, origem: "Salão", identificacao: "Mesa 4", cliente: null, itens, ...extra });
const item = (id, extra = {}) => ({ id, nome: `Prato ${id}`, quantidade: 1, observacao: null, status: "pendente", ...extra });

test("só imprime item que ainda não saiu; ticket sem novidade fica de fora", () => {
  const fila = [ticket("A", [item("a1"), item("a2")]), ticket("B", [item("b1")])];
  const r = itensParaImprimir(fila, new Set(["a1", "b1"]));
  assert.deepEqual(r.map((t) => t.id), ["A"]);
  assert.deepEqual(r[0].itens.map((i) => i.id), ["a2"]);
  assert.equal(r[0].acrescimo, true, "a comanda já tinha via: é acréscimo");
});

test("pedido novo inteiro sai numa via só, sem marca de acréscimo", () => {
  const r = itensParaImprimir([ticket("C", [item("c1"), item("c2")])], []);
  assert.equal(r.length, 1);
  assert.equal(r[0].itens.length, 2);
  assert.equal(r[0].acrescimo, false);
});

test("item entregue não imprime; fila vazia ou nula não quebra", () => {
  assert.deepEqual(itensParaImprimir([ticket("D", [item("d1", { status: "entregue" })])], []), []);
  assert.deepEqual(itensParaImprimir(null, null), []);
});

test("marcados como impressos não repetem e a lista guarda só os mais recentes", () => {
  let lista = marcarImpressos([], ["x1", "x2"]);
  lista = marcarImpressos(lista, ["x2", "x3"]);
  assert.deepEqual(lista, ["x1", "x2", "x3"]);
  assert.deepEqual(marcarImpressos(["a", "b", "c"], ["d"], 3), ["b", "c", "d"]);
  assert.deepEqual(marcarImpressos(new Set(["a"]), ["b"]), ["a", "b"]);
});

test("via escapa nome e observação digitados pelo cliente", () => {
  const html = htmlDaVia(ticket("E", [item("e1", { nome: "Moqueca", observacao: "<img src=x onerror=alert(1)>" })], { cliente: "<script>x()</script>Ana" }), { unidade: "Sel & Estrela" });
  assert.ok(!html.includes("<img src=x"), "observação não vira tag");
  assert.ok(!html.includes("<script>x()"), "nome não vira script");
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(html.includes("Sel &amp; Estrela"));
  assert.ok(html.includes("COZINHA") && html.includes("Mesa 4") && html.includes("1x</span> Moqueca"));
});

test("via do bar, 58 mm e acréscimo", () => {
  const html = htmlDaVia(ticket("F", [item("f1")]), { setor: "bar", largura: "58mm", acrescimo: true });
  assert.ok(html.includes("BAR · ACRÉSCIMO"));
  assert.ok(html.includes("width:58mm"));
});

test("várias vias num documento só, uma por página", () => {
  const html = htmlDasVias([ticket("G", [item("g1")]), ticket("H", [item("h1")], { acrescimo: true })]);
  assert.equal((html.match(/class="via"/g) || []).length, 2);
  assert.ok(html.includes("page-break-before:always"));
  assert.ok(html.includes("COZINHA · ACRÉSCIMO"));
});
